import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json(
        { error: 'Only the brand owner can create bounties' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const bounty = await prisma.bounty.create({
      data: {
        brandId: brand.id,
        title: title.slice(0, 160),
        description: body.description ? String(body.description).slice(0, 2000) : null,
        rewardCents: Math.max(0, Number(body.rewardCents || 0)),
        minScore: Math.min(100, Math.max(50, Number(body.minScore || 80))),
        active: body.active !== false,
      },
    });

    return NextResponse.json({ bounty });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
