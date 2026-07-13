import 'server-only';

import type { UserProfile } from '@prisma/client';
import { loadDeskEconomicsForBrand } from '@/lib/desk-economics-load';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadBrandOverview(
  profile: UserProfile,
  idOrSlug: string
) {
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, name: true, ownerId: true, logoUrl: true },
  });
  if (!brand) return null;
  if (!canManageBrand(profile, brand.ownerId)) throw new Error('FORBIDDEN');

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    openCampaigns,
    pendingApps,
    activeApps,
    leads,
    callsToday,
    bookings,
    wallet,
    callsWeek,
    recentApps,
    recentCalls,
    campaigns,
    recentBookings,
    recentClaims,
  ] = await Promise.all([
    prisma.campaign.count({ where: { brandId: brand.id, status: 'OPEN' } }),
    prisma.campaignApplication.count({
      where: { campaign: { brandId: brand.id }, status: 'APPLIED' },
    }),
    prisma.campaignApplication.count({
      where: {
        campaign: { brandId: brand.id },
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
    }),
    prisma.prospect.count({
      where: { brandId: brand.id, NOT: { source: 'training' } },
    }),
    prisma.callLog.count({
      where: { brandId: brand.id, createdAt: { gte: startOfDay } },
    }),
    prisma.calendarBooking.count({ where: { brandId: brand.id } }),
    getOrCreateBrandWallet(brand.id),
    prisma.callLog.findMany({
      where: { brandId: brand.id, createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    }),
    prisma.campaignApplication.findMany({
      where: { campaign: { brandId: brand.id } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: { select: { displayName: true } },
        campaign: { select: { id: true, title: true } },
      },
    }),
    prisma.callLog.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
      take: 14,
      select: {
        id: true,
        createdAt: true,
        status: true,
        outcome: true,
        duration: true,
        prospect: { select: { companyName: true } },
        user: { select: { displayName: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { brandId: brand.id },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.calendarBooking.findMany({
      where: { brandId: brand.id },
      orderBy: { startsAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        meetLink: true,
        campaignId: true,
        createdByUserId: true,
      },
    }),
    prisma.appointmentClaim.findMany({
      where: {
        campaign: { brandId: brand.id },
        status: { in: ['PENDING_AUDIT', 'PASSED', 'PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        prospectName: true,
        meetingAt: true,
        createdAt: true,
        repUserId: true,
        campaign: { select: { id: true, title: true } },
      },
    }),
  ]);

  const bookerIds = [
    ...new Set([
      ...recentBookings.map((booking) => booking.createdByUserId),
      ...recentClaims.map((claim) => claim.repUserId),
    ]),
  ];
  const bookers =
    bookerIds.length > 0
      ? await prisma.userProfile.findMany({
          where: { id: { in: bookerIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const nameById = Object.fromEntries(
    bookers.map((user) => [user.id, user.displayName || 'SDR'])
  );

  const byDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekAgo);
    date.setDate(weekAgo.getDate() + i);
    byDay.set(dayKey(date), 0);
  }
  for (const call of callsWeek) {
    const key = dayKey(call.createdAt);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const days = [...byDay.entries()].map(([key, count]) => ({
    key,
    label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
    }),
    count,
  }));

  const goalFromBookings = recentBookings.map((booking) => ({
    id: `book-${booking.id}`,
    kind: 'booking' as const,
    title: booking.title,
    companyName:
      booking.title.replace(/^Intro\s*·\s*/i, '').trim() || booking.title,
    repName: nameById[booking.createdByUserId] || 'SDR',
    status: 'BOOKED',
    at: booking.startsAt.toISOString(),
    campaignId: booking.campaignId,
  }));
  const goalFromClaims = recentClaims.map((claim) => ({
    id: `claim-${claim.id}`,
    kind: 'claim' as const,
    title: claim.campaign.title,
    companyName: claim.prospectName || claim.campaign.title,
    repName: nameById[claim.repUserId] || 'SDR',
    status: claim.status,
    at: (claim.meetingAt || claim.createdAt).toISOString(),
    campaignId: claim.campaign.id,
  }));
  const goalFromCalls = recentCalls
    .filter((call) => {
      const outcome = (call.outcome || '').toLowerCase();
      const status = (call.status || '').toLowerCase();
      return (
        outcome.includes('book') ||
        outcome.includes('appointment') ||
        status === 'appointment_set' ||
        outcome === 'interested'
      );
    })
    .map((call) => ({
      id: `call-goal-${call.id}`,
      kind: 'call' as const,
      title: call.outcome || call.status,
      companyName: call.prospect?.companyName || 'Lead',
      repName: call.user?.displayName || 'SDR',
      status: call.outcome || call.status,
      at: call.createdAt.toISOString(),
      campaignId: null as string | null,
    }));
  const goals = [...goalFromBookings, ...goalFromClaims, ...goalFromCalls]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  const economics = await loadDeskEconomicsForBrand(brand, now);

  return {
    brand: {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: brand.logoUrl,
    },
    kpis: {
      openCampaigns,
      pendingApplications: pendingApps,
      activeSdrs: activeApps,
      leads,
      callsToday,
      bookings,
      escrowBalanceCents: wallet.balanceCents,
      escrowLabel: `$${(wallet.balanceCents / 100).toFixed(0)}`,
    },
    economics,
    dialVolume: days,
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      updatedAt: campaign.updatedAt.toISOString(),
    })),
    activity: {
      applications: recentApps.map((application) => ({
        id: application.id,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        repName: application.user.displayName || 'SDR',
        campaignId: application.campaign.id,
        campaignTitle: application.campaign.title,
      })),
      calls: recentCalls.map((call) => ({
        id: call.id,
        status: call.status,
        outcome: call.outcome,
        createdAt: call.createdAt.toISOString(),
        durationSec: call.duration,
        companyName: call.prospect?.companyName || 'Lead',
        repName: call.user?.displayName || 'SDR',
      })),
    },
    goals,
  };
}

export type BrandOverviewPayload = NonNullable<
  Awaited<ReturnType<typeof loadBrandOverview>>
>;
