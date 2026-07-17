import 'server-only';

import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { BrandNavCounts, RepNavCounts } from '@/lib/roles';

/** Action queues: hide when empty. */
export function actionBadge(n: number | null | undefined): number | null {
  if (n == null || n <= 0) return null;
  return n;
}

/** Inventory: show totals including zero when provided. */
export function inventoryBadge(n: number | null | undefined): number | null {
  if (n == null) return null;
  return n;
}

/** Live-only: hide zero noise. */
export function liveBadge(n: number | null | undefined): number | null {
  return actionBadge(n);
}

export async function loadBrandNavCounts(brandId: string): Promise<BrandNavCounts> {
  const [
    leads,
    generateLeads,
    liveCalls,
    campaigns,
    playbooks,
    recruit,
    team,
    payouts,
    verifiedGoals,
  ] = await Promise.all([
    prisma.prospect.count({
      where: { brandId, NOT: { source: 'training' } },
    }),
    prisma.pipelineJob.count({
      where: { brandId, status: { in: ['queued', 'running'] } },
    }),
    prisma.callLog.count({
      where: {
        brandId,
        status: { in: ['initiated', 'ringing', 'in-progress', 'in_progress'] },
      },
    }),
    prisma.campaign.count({
      where: { brandId, status: { in: ['DRAFT', 'OPEN', 'PAUSED'] } },
    }),
    prisma.playbook.count({ where: { brandId } }),
    prisma.campaignApplication.count({
      where: { campaign: { brandId }, status: 'APPLIED' },
    }),
    prisma.campaignApplication.count({
      where: {
        campaign: { brandId },
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
    }),
    prisma.campaignPayout.count({
      where: { campaign: { brandId }, status: 'PENDING' },
    }),
    prisma.appointmentClaim.count({
      where: {
        campaign: { brandId },
        status: { in: ['PENDING_AUDIT', 'PASSED', 'PAID'] },
      },
    }),
  ]);

  return {
    leads,
    generateLeads,
    liveCalls,
    campaigns,
    playbooks,
    recruit,
    team,
    payouts,
    verifiedGoals,
  };
}

export async function loadRepNavCounts(profile: UserProfile): Promise<RepNavCounts> {
  const now = new Date();
  const [brandDeals, coldCall, earnings, verifiedGoals] = await Promise.all([
    prisma.talentInterest.count({
      where: { toUserId: profile.id, status: 'interested' },
    }),
    prisma.prospect.count({
      where: {
        checkedOutByUserId: profile.id,
        checkedOutUntil: { gt: now },
        status: { not: 'done' },
        NOT: { source: 'training' },
      },
    }),
    prisma.campaignPayout.count({
      where: {
        application: { userId: profile.id },
        status: 'PENDING',
      },
    }),
    prisma.appointmentClaim.count({
      where: {
        repUserId: profile.id,
        status: { in: ['PENDING_AUDIT', 'PASSED', 'PAID'] },
      },
    }),
  ]);

  return {
    /** Brands that shortlisted you from Recruit. */
    brandDeals,
    coldCall,
    earnings,
    verifiedGoals,
  };
}
