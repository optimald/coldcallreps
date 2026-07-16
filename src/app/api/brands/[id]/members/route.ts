import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, canManageBrandId } from '@/lib/roles';
import { rateLimit } from '@/lib/rate-limit';
import { trackEvent } from '@/lib/posthog/analytics';

type Ctx = { params: Promise<{ id: string }> };

/** GET — list brand members (owner + BrandMember rows). */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: brandId } = await ctx.params;
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, email: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const allowed = await canManageBrandId(profile, brandId);
    if (!allowed && !canManageBrand(profile, brand.ownerId)) {
      // viewers can also list
      const viewer = await prisma.brandMember.findFirst({
        where: { brandId, userId: profile.id },
      });
      if (!viewer && brand.ownerId !== profile.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({
      owner: brand.owner,
      members: brand.members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        createdAt: m.createdAt,
      })),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — invite/add a member by email. Owner or admin only.
 * Body: { email, role?: 'admin' | 'viewer' }
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: brandId } = await ctx.params;
    const rl = rateLimit({
      key: `brand-members:${profile.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many invites' }, { status: 429 });
    }

    if (!(await canManageBrandId(profile, brandId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const role = body.role === 'viewer' ? 'viewer' : 'admin';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const user = await prisma.userProfile.findFirst({
      where: { email },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'No account with that email yet — they must sign up first.' },
        { status: 404 }
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { ownerId: true },
    });
    if (brand?.ownerId === user.id) {
      return NextResponse.json({ error: 'User is already the brand owner' }, { status: 400 });
    }

    const existingMember = await prisma.brandMember.findUnique({
      where: { brandId_userId: { brandId, userId: user.id } },
      select: { id: true },
    });

    const member = await prisma.brandMember.upsert({
      where: { brandId_userId: { brandId, userId: user.id } },
      create: {
        brandId,
        userId: user.id,
        role,
        invitedBy: profile.id,
      },
      update: { role },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    if (!existingMember) {
      trackEvent(profile.id, 'team_member_invited', {
        role: 'BRAND',
        brandId,
        memberUserId: user.id,
        memberRole: role,
      });
    }

    return NextResponse.json({
      member: {
        id: member.id,
        role: member.role,
        user: member.user,
        createdAt: member.createdAt,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[brand members]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE — remove member. Body/query: memberId or userId */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: brandId } = await ctx.params;
    if (!(await canManageBrandId(profile, brandId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');
    const userId = searchParams.get('userId');
    if (!memberId && !userId) {
      return NextResponse.json({ error: 'memberId or userId required' }, { status: 400 });
    }
    await prisma.brandMember.deleteMany({
      where: {
        brandId,
        ...(memberId ? { id: memberId } : { userId: String(userId) }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
