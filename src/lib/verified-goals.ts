import 'server-only';

import { prisma } from '@/lib/prisma';
import type { VerifiedGoalRow } from '@/lib/verified-goals-shared';

export type { VerifiedGoalRow } from '@/lib/verified-goals-shared';
export { goalDisposition } from '@/lib/verified-goals-shared';

function isGoalCallOutcome(outcome: string | null | undefined, status: string | null | undefined) {
  const o = (outcome || '').toLowerCase();
  const s = (status || '').toLowerCase();
  return (
    o.includes('book') ||
    o.includes('appointment') ||
    s === 'appointment_set' ||
    o === 'interested' ||
    o.includes('qualified')
  );
}

type LoadOpts = {
  brandId?: string;
  repUserId?: string;
  take?: number;
};

/**
 * Verified goals = payout-eligible outcomes:
 * calendar bookings, appointment claims (pending/passed/paid), and dials with book/qualified dispositions.
 */
export async function loadVerifiedGoals(opts: LoadOpts = {}): Promise<VerifiedGoalRow[]> {
  const take = Math.min(Math.max(opts.take ?? 80, 1), 200);
  const brandWhere = opts.brandId ? { brandId: opts.brandId } : undefined;
  const claimCampaignWhere = opts.brandId
    ? { campaign: { brandId: opts.brandId } }
    : undefined;

  const [bookings, claims, calls] = await Promise.all([
    prisma.calendarBooking.findMany({
      where: {
        ...(brandWhere || {}),
        ...(opts.repUserId ? { createdByUserId: opts.repUserId } : {}),
      },
      orderBy: { startsAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        startsAt: true,
        campaignId: true,
        brandId: true,
        createdByUserId: true,
      },
    }),
    prisma.appointmentClaim.findMany({
      where: {
        ...(claimCampaignWhere || {}),
        ...(opts.repUserId ? { repUserId: opts.repUserId } : {}),
        status: { in: ['PENDING_AUDIT', 'PASSED', 'PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        prospectName: true,
        meetingAt: true,
        createdAt: true,
        repUserId: true,
        campaign: {
          select: {
            id: true,
            title: true,
            brandId: true,
            payoutCents: true,
            brand: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.callLog.findMany({
      where: {
        ...(brandWhere || {}),
        ...(opts.repUserId ? { userId: opts.repUserId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take * 2, 200),
      select: {
        id: true,
        status: true,
        outcome: true,
        createdAt: true,
        brandId: true,
        userId: true,
        user: { select: { displayName: true } },
        prospect: { select: { companyName: true } },
        brand: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const brandIds = [
    ...new Set([
      ...bookings.map((b) => b.brandId),
      ...claims.map((c) => c.campaign.brandId),
      ...calls.map((c) => c.brandId).filter(Boolean),
    ]),
  ] as string[];
  const campaignIds = [
    ...new Set([
      ...bookings.map((b) => b.campaignId).filter(Boolean),
      ...claims.map((c) => c.campaign.id),
    ]),
  ] as string[];
  const repIds = [
    ...new Set([
      ...bookings.map((b) => b.createdByUserId),
      ...claims.map((c) => c.repUserId),
      ...calls.map((c) => c.userId).filter(Boolean),
    ]),
  ] as string[];

  const [brands, campaigns, reps, payouts] = await Promise.all([
    brandIds.length
      ? prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
    campaignIds.length
      ? prisma.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, title: true, payoutCents: true },
        })
      : Promise.resolve([]),
    repIds.length
      ? prisma.userProfile.findMany({
          where: { id: { in: repIds } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]),
    opts.repUserId || opts.brandId
      ? prisma.campaignPayout.findMany({
          where: {
            ...(opts.repUserId ? { repUserId: opts.repUserId } : {}),
            ...(opts.brandId ? { campaign: { brandId: opts.brandId } } : {}),
            status: { in: ['PENDING', 'PAID'] },
          },
          take: 100,
          select: {
            id: true,
            status: true,
            grossCents: true,
            campaignId: true,
            applicationId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const brandById = Object.fromEntries(
    brands.map((b) => [b.id, b])
  );
  const campaignById = Object.fromEntries(
    campaigns.map((c) => [c.id, c])
  );
  const nameById = Object.fromEntries(
    reps.map((u) => [u.id, u.displayName || 'SDR'])
  );
  const payoutByCampaign = Object.fromEntries(
    payouts.map((p) => [p.campaignId, p])
  );

  const fromBookings: VerifiedGoalRow[] = bookings.map((booking) => {
    const brand = brandById[booking.brandId];
    const campaign = booking.campaignId ? campaignById[booking.campaignId] : null;
    const payout = booking.campaignId ? payoutByCampaign[booking.campaignId] : null;
    return {
      id: `book-${booking.id}`,
      kind: 'booking' as const,
      title: booking.title,
      companyName:
        booking.title.replace(/^Intro\s*·\s*/i, '').trim() || booking.title,
      repName: nameById[booking.createdByUserId] || 'SDR',
      repUserId: booking.createdByUserId,
      status: 'BOOKED',
      at: booking.startsAt.toISOString(),
      campaignId: booking.campaignId,
      campaignTitle: campaign?.title || null,
      brandId: booking.brandId,
      brandName: brand?.name || null,
      brandKey: brand?.slug || brand?.id || null,
      payoutCents: campaign?.payoutCents ?? payout?.grossCents ?? null,
      payoutStatus: payout?.status || null,
    };
  });

  const fromClaims: VerifiedGoalRow[] = claims.map((claim) => {
    const brand = claim.campaign.brand;
    const payout = payoutByCampaign[claim.campaign.id];
    return {
      id: `claim-${claim.id}`,
      kind: 'claim' as const,
      title: claim.campaign.title,
      companyName: claim.prospectName || claim.campaign.title,
      repName: nameById[claim.repUserId] || 'SDR',
      repUserId: claim.repUserId,
      status: claim.status,
      at: (claim.meetingAt || claim.createdAt).toISOString(),
      campaignId: claim.campaign.id,
      campaignTitle: claim.campaign.title,
      brandId: brand.id,
      brandName: brand.name,
      brandKey: brand.slug || brand.id,
      payoutCents: claim.campaign.payoutCents ?? payout?.grossCents ?? null,
      payoutStatus: claim.status === 'PAID' ? 'PAID' : payout?.status || null,
    };
  });

  const fromCalls: VerifiedGoalRow[] = calls
    .filter((call) => isGoalCallOutcome(call.outcome, call.status))
    .map((call) => {
      const brand = call.brand;
      return {
        id: `call-goal-${call.id}`,
        kind: 'call' as const,
        title: call.outcome || call.status,
        companyName: call.prospect?.companyName || 'Lead',
        repName: call.user?.displayName || nameById[call.userId || ''] || 'SDR',
        repUserId: call.userId,
        status: call.outcome || call.status,
        at: call.createdAt.toISOString(),
        campaignId: null,
        campaignTitle: null,
        brandId: call.brandId,
        brandName: brand?.name || null,
        brandKey: brand?.slug || brand?.id || null,
        payoutCents: null,
        payoutStatus: null,
      };
    });

  return [...fromBookings, ...fromClaims, ...fromCalls]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, take);
}
