import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrand, isSuperadmin } from '@/lib/roles';
import { TRAINING_SOURCE } from '@/lib/training-leads';

/** Brand IDs the user owns (or all for superadmin). */
export async function ownedBrandIds(profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>) {
  const brands = await prisma.brand.findMany({
    where: isSuperadmin(profile) ? {} : { ownerId: profile.id },
    select: { id: true, ownerId: true, name: true, slug: true },
    take: 50,
  });
  return brands;
}

/** Exclude training / practice contacts from paid campaign dial lists. */
export function campaignLeadWhere(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    NOT: { source: TRAINING_SOURCE },
  };
}

/** List/detail projection for mobile-friendly CRM payloads. */
export const PROSPECT_LIST_SELECT = {
  id: true,
  brandId: true,
  campaignId: true,
  companyName: true,
  industry: true,
  city: true,
  state: true,
  phone: true,
  website: true,
  ownerName: true,
  ownerTitle: true,
  reviewRating: true,
  reviewCount: true,
  hooksJSON: true,
  status: true,
  enrichmentStatus: true,
  scrapeStatus: true,
  webScanStatus: true,
  qualifyPhase1: true,
  qualifyPhase2: true,
  qualifyPhase3: true,
  outreachReady: true,
  bookingUrlFound: true,
  source: true,
  mapsPlaceId: true,
  attemptCount: true,
  nextCallAt: true,
  lastDisposition: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PROSPECT_DIAL_SELECT = {
  ...PROSPECT_LIST_SELECT,
  notes: true,
} as const;

/** True if profile can manage this brand's lead list. */
export async function canManageBrandLeads(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<boolean> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { ownerId: true },
  });
  if (!brand) return false;
  return canManageBrand(profile, brand.ownerId);
}

/**
 * Brand IDs an SDR may dial: campaigns where application is ACCEPTED or ACTIVE.
 */
export async function dialableBrandCampaigns(userId: string) {
  const apps = await prisma.campaignApplication.findMany({
    where: {
      userId,
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      campaign: { status: 'OPEN' },
    },
    select: {
      campaignId: true,
      campaign: {
        select: {
          id: true,
          brandId: true,
          title: true,
          packId: true,
          playbookId: true,
          status: true,
          startsAt: true,
          endsAt: true,
          callingHoursStartMin: true,
          callingHoursEndMin: true,
          callingTimezone: true,
          budgetCents: true,
          budgetMode: true,
          dailyBudgetCents: true,
          brand: { select: { name: true } },
        },
      },
    },
  });

  const { isCampaignDialNowEligible } = await import('@/lib/campaigns');
  const { loadCampaignSpendStats } = await import('@/lib/campaign-spend');
  const spend = await loadCampaignSpendStats(apps.map((a) => a.campaign.id));
  const now = new Date();

  return apps
    .filter((a) => {
      const s = spend.get(a.campaign.id) || { spentCents: 0, spentTodayCents: 0 };
      return isCampaignDialNowEligible({ ...a.campaign, ...s }, now).ok;
    })
    .map((a) => a.campaign);
}

/**
 * When an SDR has accepted OPEN campaigns that pass calendar/budget but all sit
 * outside daily calling hours — used for empty-queue messaging.
 */
export async function outsideCallingHoursGate(userId: string): Promise<{
  outsideCallingHours: boolean;
  callingHoursHint: string | null;
}> {
  const apps = await prisma.campaignApplication.findMany({
    where: {
      userId,
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      campaign: { status: 'OPEN' },
    },
    select: {
      campaignId: true,
      campaign: {
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          callingHoursStartMin: true,
          callingHoursEndMin: true,
          callingTimezone: true,
          budgetCents: true,
          budgetMode: true,
          dailyBudgetCents: true,
        },
      },
    },
  });
  if (apps.length === 0) {
    return { outsideCallingHours: false, callingHoursHint: null };
  }

  const { isCampaignDialEligible } = await import('@/lib/campaigns');
  const { formatCallingHoursLabel, isWithinCampaignCallingHours } = await import(
    '@/lib/calling-hours'
  );
  const { loadCampaignSpendStats } = await import('@/lib/campaign-spend');
  const spend = await loadCampaignSpendStats(apps.map((a) => a.campaignId));
  const now = new Date();

  const dialBaseOk = apps.filter((a) => {
    const s = spend.get(a.campaignId) || { spentCents: 0, spentTodayCents: 0 };
    return isCampaignDialEligible({ ...a.campaign, ...s }, now).ok;
  });
  const outsideCallingHours =
    dialBaseOk.length > 0 &&
    dialBaseOk.every((a) => !isWithinCampaignCallingHours(a.campaign, now));

  if (!outsideCallingHours) {
    return { outsideCallingHours: false, callingHoursHint: null };
  }

  const labels = dialBaseOk
    .map((a) => formatCallingHoursLabel(a.campaign))
    .filter(Boolean) as string[];

  return {
    outsideCallingHours: true,
    callingHoursHint:
      labels.length > 0
        ? `Calling window: ${labels[0]}. Queue unlocks automatically when hours open.`
        : null,
  };
}
