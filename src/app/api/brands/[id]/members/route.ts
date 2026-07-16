import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, canManageBrandId } from '@/lib/roles';

type Ctx = { params: Promise<{ id: string }> };

/** GET — list brand owner (BrandMember table not yet deployed on this branch). */
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
      },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const allowed = await canManageBrandId(profile, brandId);
    if (!allowed && !canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({
      brandId: brand.id,
      owner: brand.owner
        ? {
            id: brand.owner.id,
            email: brand.owner.email,
            displayName: brand.owner.displayName,
            role: 'owner',
          }
        : null,
      members: [],
      notice: 'Team member invites require the BrandMember schema migration.',
    });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[brand members]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Brand member invites are not available until schema migration.' },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Brand member removal is not available until schema migration.' },
    { status: 501 }
  );
}
