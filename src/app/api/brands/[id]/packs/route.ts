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
      return NextResponse.json({ error: 'Only the brand owner can create packs' }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const pack = await prisma.productPack.create({
      data: {
        brandId: brand.id,
        name: name.slice(0, 120),
        icpJSON: JSON.stringify(body.icp || {}),
        scriptsJSON: JSON.stringify(Array.isArray(body.scripts) ? body.scripts : []),
        objectionsJSON: JSON.stringify(Array.isArray(body.objections) ? body.objections : []),
        active: body.active !== false,
      },
    });

    return NextResponse.json({ pack });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
