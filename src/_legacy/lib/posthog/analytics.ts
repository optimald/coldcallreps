import 'server-only';

import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  captureServerEvent,
  groupIdentifyServer,
  identifyServerUser,
  type PostHogGroups,
} from '@/lib/posthog/server';

/** Matches admin funnel integrity-cleared step. */
export const PRACTICE_GATE_SCORE = 60;

export const STREAK_MILESTONES = [3, 7, 30] as const;

type Role = 'REP' | 'BRAND';

export type TrackProperties = Record<string, unknown> & {
  role?: Role;
  /** When set, event is attributed to this brand group. */
  brandId?: string | null;
};

function analyticsRole(profile: Pick<UserProfile, 'platformRole'>): Role {
  return profile.platformRole === 'BRAND' || profile.platformRole === 'RECRUITER'
    ? 'BRAND'
    : 'REP';
}

/** Person properties used for funnel segmentation in PostHog. */
export function personPropertiesFromProfile(
  profile: Pick<
    UserProfile,
    | 'email'
    | 'displayName'
    | 'platformRole'
    | 'plan'
    | 'minutesRemaining'
    | 'minutesUsed'
    | 'currentStreak'
    | 'totalPoints'
    | 'repOnboardedAt'
    | 'referredByCode'
    | 'createdAt'
    | 'stripeSubscriptionId'
    | 'stripeConnectPayoutsEnabled'
  >
) {
  return {
    email: profile.email,
    name: profile.displayName,
    role: analyticsRole(profile),
    platform_role: profile.platformRole,
    plan: profile.plan,
    minutes_remaining: profile.minutesRemaining,
    minutes_used: profile.minutesUsed,
    current_streak: profile.currentStreak,
    total_points: profile.totalPoints,
    onboarded: Boolean(profile.repOnboardedAt),
    referred_by_code: profile.referredByCode,
    signup_date: profile.createdAt?.toISOString?.() ?? profile.createdAt,
    has_subscription: Boolean(profile.stripeSubscriptionId),
    connect_payouts_enabled: Boolean(profile.stripeConnectPayoutsEnabled),
  };
}

export function syncPersonProfile(
  profile: Parameters<typeof personPropertiesFromProfile>[0] & { id: string }
) {
  identifyServerUser(profile.id, personPropertiesFromProfile(profile));
}

export function identifyBrandGroup(
  brandId: string,
  properties?: Record<string, unknown>
) {
  groupIdentifyServer('brand', brandId, {
    name: properties?.name,
    ...properties,
  });
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: TrackProperties
) {
  const { brandId, ...rest } = properties || {};
  const brandKey = brandId || undefined;
  const groups: PostHogGroups | undefined = brandKey
    ? { brand: brandKey }
    : undefined;
  if (brandKey) {
    identifyBrandGroup(brandKey, { id: brandKey });
  }
  captureServerEvent(distinctId, event, rest, groups);
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
