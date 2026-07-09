import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);

    const sessions = await prisma.trainerSession.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        prospectId: true,
        scenarioType: true,
        focusArea: true,
        difficulty: true,
        overallScore: true,
        pointsEarned: true,
        duration: true,
        createdAt: true,
        prospect: { select: { companyName: true } },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        leadCompany: s.prospect?.companyName || null,
      })),
      minutesRemaining: profile.minutesRemaining,
      totalPoints: profile.totalPoints,
      streak: profile.currentStreak,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
