import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canCreateTournament } from '@/lib/roles';

export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { entries: true } },
        entries: {
          orderBy: { score: 'desc' },
          take: 5,
          include: { user: { select: { displayName: true } } },
        },
      },
    });
    return NextResponse.json({ tournaments });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();

    if (body.action === 'create' || body.name) {
      if (!canCreateTournament(profile)) {
        return NextResponse.json(
          {
            error: 'Manager, Brand, or Superadmin role required to create tournaments.',
            code: 'ROLE_REQUIRED',
          },
          { status: 403 }
        );
      }
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const tournament = await prisma.tournament.create({
        data: {
          name: name.slice(0, 160),
          description: body.description ? String(body.description).slice(0, 2000) : null,
          focusArea: body.focusArea ? String(body.focusArea).slice(0, 64) : null,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          active: body.active !== false,
        },
      });
      return NextResponse.json({ tournament });
    }

    const { tournamentId } = body;
    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId or name required' }, { status: 400 });
    }
    const tid = String(tournamentId);
    const tournament = await prisma.tournament.findUnique({ where: { id: tid } });
    if (!tournament || !tournament.active) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const [entry] = await prisma.$transaction([
      prisma.tournamentEntry.upsert({
        where: {
          tournamentId_userId: {
            tournamentId: tid,
            userId: profile.id,
          },
        },
        create: {
          tournamentId: tid,
          userId: profile.id,
          score: 0,
        },
        update: {},
      }),
      prisma.seasonPass.upsert({
        where: {
          userId_seasonKey: {
            userId: profile.id,
            seasonKey: tid,
          },
        },
        create: {
          userId: profile.id,
          seasonKey: tid,
          active: true,
        },
        update: { active: true },
      }),
    ]);
    return NextResponse.json({ entry, seasonPass: { seasonKey: tid, active: true } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
