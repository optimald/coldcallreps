import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: profile.id },
    });
    if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const existing = await prisma.prospect.findFirst({
      where: { id, userId: profile.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.companyName != null) data.companyName = String(body.companyName).trim().slice(0, 160);
    if (body.industry !== undefined) data.industry = body.industry ? String(body.industry).slice(0, 80) : null;
    if (body.city !== undefined) data.city = body.city ? String(body.city).slice(0, 80) : null;
    if (body.state !== undefined) data.state = body.state ? String(body.state).slice(0, 40) : null;
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).slice(0, 40) : null;
    if (body.website !== undefined) data.website = body.website ? String(body.website).slice(0, 300) : null;
    if (body.ownerName !== undefined)
      data.ownerName = body.ownerName ? String(body.ownerName).slice(0, 80) : null;
    if (body.ownerTitle !== undefined)
      data.ownerTitle = body.ownerTitle ? String(body.ownerTitle).slice(0, 80) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 4000) : null;
    if (body.status !== undefined) data.status = String(body.status).slice(0, 32);
    if (body.imageUrl !== undefined)
      data.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 500) : null;

    if (data.companyName === '') {
      return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    }

    const prospect = await prisma.prospect.update({
      where: { id },
      data,
    });
    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const existing = await prisma.prospect.findFirst({
      where: { id, userId: profile.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
