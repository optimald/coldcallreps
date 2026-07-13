import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireManager(profileId: string, orgId: string | null) {
  if (!orgId) throw new Error('ORG_REQUIRED');
  const academy = await prisma.academy.findFirst({ where: { orgId } });
  if (!academy) throw new Error('NO_ACADEMY');
  const me = await prisma.academyMember.findUnique({
    where: { academyId_userId: { academyId: academy.id, userId: profileId } },
  });
  if (me?.role !== 'manager') throw new Error('FORBIDDEN');
  return academy;
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const academy = await requireManager(profile.id, profile.orgId);
    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const focusAreas = Array.isArray(body.focusAreas)
      ? body.focusAreas.map(String).slice(0, 12)
      : ['standard'];

    const maxSort = await prisma.academyCurriculum.aggregate({
      where: { academyId: academy.id },
      _max: { sortOrder: true },
    });

    const curriculum = await prisma.academyCurriculum.create({
      data: {
        academyId: academy.id,
        title: title.slice(0, 160),
        focusAreas: JSON.stringify(focusAreas),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ curriculum });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }
    if (error.message === 'ORG_REQUIRED') {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }
    if (error.message === 'NO_ACADEMY') {
      return NextResponse.json({ error: 'Create an academy first' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const academy = await requireManager(profile.id, profile.orgId);
    const body = await req.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.academyCurriculum.findFirst({
      where: { id, academyId: academy.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const curriculum = await prisma.academyCurriculum.update({
      where: { id },
      data: {
        title: body.title ? String(body.title).slice(0, 160) : undefined,
        focusAreas: Array.isArray(body.focusAreas)
          ? JSON.stringify(body.focusAreas.map(String).slice(0, 12))
          : undefined,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      },
    });
    return NextResponse.json({ curriculum });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profile = await requireUser();
    const academy = await requireManager(profile.id, profile.orgId);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const existing = await prisma.academyCurriculum.findFirst({
      where: { id, academyId: academy.id },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.academyCurriculum.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
