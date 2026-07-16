import 'server-only';

import { prisma } from '@/lib/prisma';
import { captureServerEvent } from '@/lib/posthog/server';

/** Matches admin funnel integrity-cleared step. */
export const PRACTICE_GATE_SCORE = 60;

export const STREAK_MILESTONES = [3, 7, 30] as const;

type Role = 'REP' | 'BRAND';

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown> & { role?: Role }
) {
  captureServerEvent(distinctId, event, properties);
}

export function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  return Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000
  );
}

export function trackReturnSession(
  userId: string,
  lastActivityAt: Date | null | undefined,
  surface: 'practice' | 'live_call',
  extra?: Record<string, unknown>
) {
  const gap = daysSince(lastActivityAt);
  if (gap == null || gap < 1) return;
  trackEvent(userId, 'return_session', {
    role: 'REP',
    daysSinceLastSession: gap,
    surface,
    ...extra,
  });
}

export function trackStreakMilestone(userId: string, streak: number) {
  if (!STREAK_MILESTONES.includes(streak as (typeof STREAK_MILESTONES)[number])) return;
  trackEvent(userId, 'streak_milestone', { role: 'REP', streak });
}

export async function isFirstTrainerSession(userId: string): Promise<boolean> {
  const count = await prisma.trainerSession.count({ where: { userId } });
  return count <= 1;
}

export async function isFirstLiveCall(userId: string): Promise<boolean> {
  const count = await prisma.callLog.count({ where: { userId } });
  return count <= 1;
}

export async function isFirstPayoutForRep(repUserId: string): Promise<boolean> {
  const count = await prisma.campaignPayout.count({
    where: { repUserId, status: 'PAID' },
  });
  return count <= 1;
}

export async function brandCampaignCount(brandId: string): Promise<number> {
  return prisma.campaign.count({ where: { brandId } });
}
