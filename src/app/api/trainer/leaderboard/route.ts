import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { weekStartUTC } from '@/lib/points';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const scope = searchParams.get('scope') || 'global'; // global | org | focus
    const focus = searchParams.get('focus') || undefined;
    const orgId = searchParams.get('orgId') || undefined;
    const period = searchParams.get('period') || 'week'; // week | all

    const since =
      period === 'week'
        ? weekStartUTC()
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const sessionWhere: any = { createdAt: { gte: since } };
    if (focus) sessionWhere.focusArea = focus;

    const sessions = await prisma.trainerSession.findMany({
      where: sessionWhere,
      select: {
        userId: true,
        overallScore: true,
        pointsEarned: true,
        focusArea: true,
      },
    });

    const byUser = new Map<
      string,
      { points: number; sessions: number; scoreSum: number }
    >();

    for (const s of sessions) {
      const cur = byUser.get(s.userId) || { points: 0, sessions: 0, scoreSum: 0 };
      cur.points += s.pointsEarned || s.overallScore;
      cur.sessions += 1;
      cur.scoreSum += s.overallScore;
      byUser.set(s.userId, cur);
    }

    let userIds = [...byUser.keys()];
    if (scope === 'org' && orgId) {
      const orgUsers = await prisma.userProfile.findMany({
        where: { orgId },
        select: { id: true },
      });
      const orgSet = new Set(orgUsers.map((u) => u.id));
      userIds = userIds.filter((id) => orgSet.has(id));
    }

    const profiles = await prisma.userProfile.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        badges: true,
        hiringBoardOptIn: true,
        currentStreak: true,
      },
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const leaderboard = userIds
      .map((userId) => {
        const stats = byUser.get(userId)!;
        const p = profileMap.get(userId);
        return {
          userId,
          displayName: p?.displayName || 'Rep',
          totalPoints: stats.points,
          totalSessions: stats.sessions,
          avgScore: stats.sessions ? Math.round(stats.scoreSum / stats.sessions) : 0,
          streak: p?.currentStreak || 0,
          badges: (() => {
            try {
              return JSON.parse(p?.badges || '[]');
            } catch {
              return [];
            }
          })(),
          hiringBoard: Boolean(p?.hiringBoardOptIn),
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map((row, i) => ({ rank: i + 1, ...row }));

    return NextResponse.json({
      leaderboard,
      scope,
      focus: focus || null,
      period,
      weekStart: since.toISOString(),
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
