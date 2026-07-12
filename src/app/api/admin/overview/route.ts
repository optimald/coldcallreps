import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireSuperadmin();
    const [
      users,
      sessions,
      jobs,
      brands,
      recruiters,
      verified,
      flagged,
      audits,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.trainerSession.count(),
      prisma.jobPost.count({ where: { active: true } }),
      prisma.brand.count(),
      prisma.recruiterSeat.count({ where: { active: true } }),
      prisma.repProfile.count({ where: { verified: true } }),
      prisma.trainerSession.count({
        where: { integrityFlags: { not: null } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { actor: { select: { displayName: true, email: true } } },
      }),
    ]);

    const recentSessions = await prisma.trainerSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        overallScore: true,
        focusArea: true,
        duration: true,
        integrityFlags: true,
        createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
    });

    return NextResponse.json({
      stats: { users, sessions, jobs, brands, recruiters, verified, flagged },
      recentSessions,
      audits,
    });
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
