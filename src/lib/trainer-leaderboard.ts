import { hasBlockingIntegrity } from '@/lib/integrity-gate';
import { weekStartUTC } from '@/lib/points';
import { prisma } from '@/lib/prisma';

export type TrainerLeaderboardPeriod = 'week' | 'all';
export type TrainerLeaderboardScope = 'global' | 'org' | 'focus';

export type TrainerLeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  totalSessions: number;
  avgScore: number;
  streak: number;
  badges: string[];
  hiringBoard: boolean;
};

export async function loadTrainerLeaderboard({
  limit,
  period,
  scope,
  orgId,
  focus,
}: {
  limit: number;
  period: TrainerLeaderboardPeriod;
  scope: TrainerLeaderboardScope;
  orgId?: string | null;
  focus?: string;
}): Promise<{ leaderboard: TrainerLeaderboardRow[] }> {
  const resolvedLimit = Math.max(0, Math.min(limit, 100));
  const since =
    period === 'week'
      ? weekStartUTC()
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainerSession.findMany({
    where: {
      createdAt: { gte: since },
      ...(focus ? { focusArea: focus } : {}),
    },
    select: {
      userId: true,
      overallScore: true,
      pointsEarned: true,
      integrityFlags: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const byUser = new Map<
    string,
    { points: number; sessions: number; scoreSum: number }
  >();

  for (const session of sessions) {
    if (hasBlockingIntegrity(session.integrityFlags)) continue;
    const current = byUser.get(session.userId) || {
      points: 0,
      sessions: 0,
      scoreSum: 0,
    };
    current.points += session.pointsEarned || session.overallScore;
    current.sessions += 1;
    current.scoreSum += session.overallScore;
    byUser.set(session.userId, current);
  }

  let userIds = [...byUser.keys()];
  if (scope === 'org' && orgId) {
    const orgUsers = await prisma.userProfile.findMany({
      where: { orgId },
      select: { id: true },
    });
    const orgUserIds = new Set(orgUsers.map((user) => user.id));
    userIds = userIds.filter((id) => orgUserIds.has(id));
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
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const leaderboard = userIds
    .map((userId) => {
      const stats = byUser.get(userId)!;
      const profile = profileMap.get(userId);
      let badges: string[] = [];
      try {
        badges = JSON.parse(profile?.badges || '[]');
      } catch {
        badges = [];
      }

      return {
        userId,
        displayName: profile?.displayName || 'Rep',
        totalPoints: stats.points,
        totalSessions: stats.sessions,
        avgScore: stats.sessions ? Math.round(stats.scoreSum / stats.sessions) : 0,
        streak: profile?.currentStreak || 0,
        badges,
        hiringBoard: Boolean(profile?.hiringBoardOptIn),
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, resolvedLimit)
    .map((row, index) => ({ rank: index + 1, ...row }));

  return { leaderboard };
}
