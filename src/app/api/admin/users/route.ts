import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import type { PlatformRole } from '@prisma/client';

export async function GET(req: Request) {
  try {
    await requireSuperadmin();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const [users, recentSessions] = await Promise.all([
      prisma.userProfile.findMany({
        where: q
          ? {
              OR: [
                // SQLite/Turso: no case-insensitive mode — contains is enough for admin search
                { email: { contains: q } },
                { displayName: { contains: q } },
                { id: { contains: q } },
              ],
            }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          email: true,
          displayName: true,
          platformRole: true,
          plan: true,
          minutesRemaining: true,
          totalPoints: true,
          bountyCredits: true,
          hiringBoardOptIn: true,
          createdAt: true,
          repProfile: { select: { slug: true, verified: true } },
        },
      }),
      prisma.trainerSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          overallScore: true,
          focusArea: true,
          duration: true,
          integrityFlags: true,
          createdAt: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
    ]);
    return NextResponse.json({ users, recentSessions });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Superadmin required' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireSuperadmin();
    const body = await req.json();
    const userId = String(body.userId || '');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const data: {
      platformRole?: PlatformRole;
      minutesRemaining?: number;
      hiringBoardOptIn?: boolean;
    } = {};

    if (body.platformRole) {
      const roles: PlatformRole[] = ['REP', 'RECRUITER', 'BRAND', 'MANAGER', 'SUPERADMIN'];
      if (!roles.includes(body.platformRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      data.platformRole = body.platformRole;
    }
    if (typeof body.minutesRemaining === 'number') {
      data.minutesRemaining = Math.max(0, Math.min(10000, Math.floor(body.minutesRemaining)));
    }
    if (typeof body.hiringBoardOptIn === 'boolean') {
      data.hiringBoardOptIn = body.hiringBoardOptIn;
    }

    const updated = await prisma.userProfile.update({
      where: { id: userId },
      data,
    });

    if (typeof body.verified === 'boolean') {
      const rep = await prisma.repProfile.findUnique({ where: { userId } });
      if (rep) {
        await prisma.repProfile.update({
          where: { id: rep.id },
          data: { verified: body.verified },
        });
      }
    }

    await writeAudit({
      actorId: admin.id,
      action: 'admin.user.update',
      targetType: 'UserProfile',
      targetId: userId,
      meta: body,
    });

    return NextResponse.json({ user: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Superadmin required' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
