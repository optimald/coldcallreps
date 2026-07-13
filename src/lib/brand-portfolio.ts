import 'server-only';

import type { UserProfile } from '@prisma/client';
import { loadDeskEconomicsForBrands } from '@/lib/desk-economics-load';
import {
  buildBrandEconomics,
  formatUsd,
  riskScore,
  type BrandEconomics,
} from '@/lib/desk-economics';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadBrandPortfolio(profile: UserProfile) {
  const brands = await prisma.brand.findMany({
    where: { ownerId: profile.id },
    select: { id: true, slug: true, name: true, logoUrl: true, ownerId: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  const owned = brands.filter((brand) => canManageBrand(profile, brand.ownerId));

  if (owned.length === 0) {
    return {
      brandCount: 0,
      kpis: {
        openCampaigns: 0,
        pendingApplications: 0,
        activeSdrs: 0,
        leads: 0,
        callsToday: 0,
        bookings: 0,
        escrowBalanceCents: 0,
        escrowLabel: '$0',
        goalsPerWeek: 0,
        costPerGoalLabel: '—',
        brandsAtRisk: 0,
      },
      dialVolume: [],
      brands: [],
      exceptions: [],
      activity: { applications: [], calls: [] },
    };
  }

  const brandIds = owned.map((brand) => brand.id);
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
    callsWeek,
    recentApps,
    recentCalls,
    wallets,
    campaignByBrand,
  ] = await Promise.all([
    prisma.campaign.count({
      where: { brandId: { in: brandIds }, status: 'OPEN' },
    }),
    prisma.campaignApplication.count({
      where: {
        campaign: { brandId: { in: brandIds } },
        status: 'APPLIED',
      },
    }),
    prisma.campaignApplication.count({
      where: {
        campaign: { brandId: { in: brandIds } },
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
    }),
    prisma.prospect.count({
      where: {
        brandId: { in: brandIds },
        NOT: { source: 'training' },
      },
    }),
    prisma.callLog.count({
      where: {
        brandId: { in: brandIds },
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.calendarBooking.count({
      where: { brandId: { in: brandIds } },
    }),
    prisma.callLog.findMany({
      where: {
        brandId: { in: brandIds },
        createdAt: { gte: weekAgo },
      },
      select: { createdAt: true },
    }),
    prisma.campaignApplication.findMany({
      where: { campaign: { brandId: { in: brandIds } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { displayName: true } },
        campaign: {
          select: {
            id: true,
            title: true,
            brandId: true,
            brand: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    }),
    prisma.callLog.findMany({
      where: { brandId: { in: brandIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        brandId: true,
        createdAt: true,
        status: true,
        duration: true,
        prospect: { select: { companyName: true } },
        user: { select: { displayName: true } },
        brand: { select: { id: true, slug: true, name: true } },
      },
    }),
    Promise.all(owned.map((brand) => getOrCreateBrandWallet(brand.id))),
    prisma.campaign.groupBy({
      by: ['brandId'],
      where: { brandId: { in: brandIds }, status: 'OPEN' },
      _count: true,
    }),
  ]);

  const openByBrand = Object.fromEntries(
    campaignByBrand.map((row) => [row.brandId, row._count])
  );
  const escrowBalanceCents = wallets.reduce(
    (sum, wallet) => sum + wallet.balanceCents,
    0
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

  const economicsByBrand = await loadDeskEconomicsForBrands(owned, now);

  const brandRows = owned.map((brand, index) => {
    const economics =
      economicsByBrand.get(brand.id) ||
      buildBrandEconomics({
        brandKey: brand.slug || brand.id,
        leadsCreatedInPeriod: 0,
        goalsInPeriod: 0,
        spendInPeriodCents: 0,
        dialReadyLeads: 0,
        callsInPeriod: 0,
        activeSdrs: 0,
        pendingApplications: 0,
        openCampaigns: 0,
        budgetCents: null,
        spentCents: 0,
        series: [],
      });
    return {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: brand.logoUrl,
      openCampaigns: openByBrand[brand.id] || 0,
      walletLabel: `$${(wallets[index].balanceCents / 100).toFixed(0)}`,
      balanceCents: wallets[index].balanceCents,
      economics,
      risk: riskScore(economics),
    };
  });

  brandRows.sort((a, b) => b.risk - a.risk);

  const goalsPerWeek = brandRows.reduce(
    (sum, b) => sum + b.economics.goalsInPeriod,
    0
  );
  const spendPerWeek = brandRows.reduce(
    (sum, b) => sum + b.economics.spendInPeriodCents,
    0
  );
  const costPerGoalLabel =
    goalsPerWeek > 0 ? formatUsd(Math.round(spendPerWeek / goalsPerWeek)) : '—';
  const brandsAtRisk = brandRows.filter((b) => b.risk >= 50).length;

  const exceptions = brandRows
    .flatMap((b) =>
      b.economics.signals
        .filter((s) => s.tone === 'bad' || s.tone === 'warn')
        .slice(0, 2)
        .map((s) => ({
          brandId: b.id,
          brandKey: b.slug || b.id,
          brandName: b.name,
          logoUrl: b.logoUrl,
          signal: s,
        }))
    )
    .sort((a, b) => b.signal.priority - a.signal.priority)
    .slice(0, 8);

  return {
    brandCount: owned.length,
    kpis: {
      openCampaigns,
      pendingApplications: pendingApps,
      activeSdrs: activeApps,
      leads,
      callsToday,
      bookings,
      escrowBalanceCents,
      escrowLabel: `$${(escrowBalanceCents / 100).toFixed(0)}`,
      goalsPerWeek,
      costPerGoalLabel,
      brandsAtRisk,
    },
    dialVolume: [...byDay.entries()].map(([key, count]) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
      }),
      count,
    })),
    brands: brandRows,
    exceptions,
    activity: {
      applications: recentApps.map((application) => ({
        id: application.id,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        repName: application.user.displayName || 'SDR',
        campaignTitle: application.campaign.title,
        brandName: application.campaign.brand.name,
        brandKey:
          application.campaign.brand.slug || application.campaign.brand.id,
      })),
      calls: recentCalls.map((call) => ({
        id: call.id,
        status: call.status,
        createdAt: call.createdAt.toISOString(),
        durationSec: call.duration,
        companyName: call.prospect?.companyName || 'Lead',
        repName: call.user?.displayName || 'SDR',
        brandName: call.brand?.name || 'Brand',
        brandKey: call.brand ? call.brand.slug || call.brand.id : '',
      })),
    },
  };
}

export type BrandPortfolioPayload = Awaited<
  ReturnType<typeof loadBrandPortfolio>
>;
