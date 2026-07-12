import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uniqueTeamSlug, checkTeamHandleAvailable } from '@/lib/profile-slug';
import { topUpOrgPool } from '@/lib/minutes';
import { PLAN } from '@/lib/product';

export async function GET() {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json({
        academy: null,
        notice: "Join or create a Clerk organization to unlock team academies + public /{slug} pages.",
      });
    }
    let academy = await prisma.academy.findFirst({
      where: { orgId: profile.orgId },
      include: {
        curricula: { orderBy: { sortOrder: 'asc' } },
        members: { take: 50 },
      },
    });

    // Backfill public slug for older academies
    if (academy && !academy.slug) {
      const slug = await uniqueTeamSlug(academy.name, profile.orgId);
      academy = await prisma.academy.update({
        where: { id: academy.id },
        data: { slug },
        include: {
          curricula: { orderBy: { sortOrder: 'asc' } },
          members: { take: 50 },
        },
      });
    }

    return NextResponse.json({
      academy,
      publicUrl: academy?.slug ? `/${academy.slug}` : null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json({
        error: 'Create or join a Clerk organization first (use the org switcher in the nav).',
        code: 'ORG_REQUIRED',
      }, { status: 400 });
    }
    if (profile.plan !== 'TEAM' && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json(
        {
          error: 'Org plan ($60/user/mo) required to create an academy.',
          code: 'PLAN_REQUIRED',
          checkoutTier: 'TEAM',
        },
        { status: 402 }
      );
    }
    const body = await req.json();
    const name = String(body.name || 'SDR Academy').slice(0, 120);
    const slug = await uniqueTeamSlug(body.slug || name, profile.orgId);

    const academy = await prisma.academy.create({
      data: {
        orgId: profile.orgId,
        name,
        slug,
        description: body.description ? String(body.description).slice(0, 500) : null,
        publicBio: body.publicBio ? String(body.publicBio).slice(0, 2000) : null,
        openToHire: body.openToHire === true,
        websiteUrl: body.websiteUrl ? String(body.websiteUrl).slice(0, 300) : null,
        members: {
          create: { userId: profile.id, role: 'manager' },
        },
        curricula: {
          create: [
            {
              title: 'Gatekeeper mastery',
              focusAreas: JSON.stringify(['gatekeeper', 'standard']),
              sortOrder: 0,
            },
            {
              title: 'Pricing & close',
              focusAreas: JSON.stringify(['pricing', 'budget_500']),
              sortOrder: 1,
            },
          ],
        },
      },
      include: { curricula: true, members: true },
    });

    // Ensure org minute pool exists for Team subscribers
    const existingPool = await prisma.orgMinutePool.findUnique({
      where: { orgId: profile.orgId },
    });
    if (!existingPool) {
      await topUpOrgPool(profile.orgId, PLAN.TEAM.minutes);
    }

    return NextResponse.json({ academy, publicUrl: `/${academy.slug}` });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Manager updates public team page fields. */
export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }
    const academy = await prisma.academy.findFirst({ where: { orgId: profile.orgId } });
    if (!academy) return NextResponse.json({ error: 'No academy' }, { status: 404 });

    const me = await prisma.academyMember.findUnique({
      where: { academyId_userId: { academyId: academy.id, userId: profile.id } },
    });
    if (me?.role !== 'manager' && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }

    const body = await req.json();
    let slug = academy.slug;
    if (body.slug != null && String(body.slug).trim()) {
      const check = await checkTeamHandleAvailable(String(body.slug), profile.orgId);
      if (!check.available || !check.handle) {
        return NextResponse.json(
          {
            error: check.error || 'Handle unavailable',
            handle: check.handle,
            suggestions: check.suggestions || [],
          },
          { status: 409 }
        );
      }
      slug = check.handle;
    } else if (!slug) {
      slug = await uniqueTeamSlug(academy.name, profile.orgId);
    }

    const updated = await prisma.academy.update({
      where: { id: academy.id },
      data: {
        slug,
        name: body.name ? String(body.name).slice(0, 120) : undefined,
        description: body.description != null ? String(body.description).slice(0, 500) : undefined,
        publicBio: body.publicBio != null ? String(body.publicBio).slice(0, 2000) : undefined,
        openToHire: typeof body.openToHire === 'boolean' ? body.openToHire : undefined,
        websiteUrl: body.websiteUrl != null ? String(body.websiteUrl).slice(0, 300) : undefined,
      },
    });

    return NextResponse.json({ academy: updated, publicUrl: `/${updated.slug}` });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
