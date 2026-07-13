import 'server-only';

import { loadCampaignSpendStats } from '@/lib/campaign-spend';
import {
  buildBrandEconomics,
  type BrandEconomics,
  type DeskDayPoint,
} from '@/lib/desk-economics';
import { prisma } from '@/lib/prisma';

const PERIOD_DAYS = 7;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodStart(now = new Date(), days = PERIOD_DAYS): Date {
  const d = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptySeries(since: Date, days = PERIOD_DAYS): DeskDayPoint[] {
  const out: DeskDayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setDate(since.getDate() + i);
    const key = dayKey(date);
    out.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      leads: 0,
      goals: 0,
      dials: 0,
      spendCents: 0,
    });
  }
  return out;
}

function countsAsVerifiedGoal(goalType: string | null | undefined, kind: 'booking' | 'claim') {
  const g = (goalType || 'BOOKED_MEETING').toUpperCase();
  if (kind === 'booking') return g === 'BOOKED_MEETING' || g === 'BOTH';
  return g === 'BOOKED_MEETING' || g === 'BOTH' || g === 'QUALIFIED_LEAD';
}

/**
 * Load desk economics for one or many brands (shared by overview + portfolio).
 */
export async function loadDeskEconomicsForBrands(
  brands: { id: string; slug: string | null }[],
  now: Date = new Date()
): Promise<Map<string, BrandEconomics>> {
  const out = new Map<string, BrandEconomics>();
  if (brands.length === 0) return out;

  const brandIds = brands.map((b) => b.id);
  const keyById = Object.fromEntries(
    brands.map((b) => [b.id, b.slug || b.id])
  );
  const since = periodStart(now);

  const [
    openCampaigns,
    leadsRows,
    dialReady,
    callRows,
    bookingsPeriod,
    claimsPeriod,
    payoutsPeriod,
    activeApps,
    pendingApps,
    brandCreditRows,
    enrichedReady,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { brandId: { in: brandIds }, status: 'OPEN' },
      select: {
        id: true,
        brandId: true,
        budgetCents: true,
        budgetMode: true,
        dailyBudgetCents: true,
        payoutCents: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.prospect.findMany({
      where: {
        brandId: { in: brandIds },
        createdAt: { gte: since },
        NOT: { source: 'training' },
      },
      select: { brandId: true, createdAt: true },
    }),
    prisma.prospect.groupBy({
      by: ['brandId'],
      where: {
        brandId: { in: brandIds },
        outreachReady: true,
        NOT: { source: 'training' },
      },
      _count: true,
    }),
    prisma.callLog.findMany({
      where: {
        brandId: { in: brandIds },
        createdAt: { gte: since },
      },
      select: { brandId: true, createdAt: true, status: true, duration: true, outcome: true },
    }),
    prisma.calendarBooking.findMany({
      where: {
        brandId: { in: brandIds },
        createdAt: { gte: since },
      },
      select: {
        brandId: true,
        campaignId: true,
        createdAt: true,
      },
    }),
    prisma.appointmentClaim.findMany({
      where: {
        campaign: { brandId: { in: brandIds } },
        status: { in: ['PENDING_AUDIT', 'PASSED', 'PAID', 'FAILED'] },
        createdAt: { gte: since },
      },
      select: {
        status: true,
        createdAt: true,
        campaign: { select: { brandId: true, goalType: true } },
      },
    }),
    prisma.campaignPayout.findMany({
      where: {
        campaign: { brandId: { in: brandIds } },
        status: { in: ['PENDING', 'PAID'] },
        OR: [
          { paidAt: { gte: since } },
          { AND: [{ paidAt: null }, { createdAt: { gte: since } }] },
        ],
      },
      select: {
        grossCents: true,
        paidAt: true,
        createdAt: true,
        campaign: { select: { brandId: true } },
      },
    }),
    prisma.campaignApplication.groupBy({
      by: ['campaignId'],
      where: {
        campaign: { brandId: { in: brandIds } },
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
      _count: true,
    }),
    prisma.campaignApplication.groupBy({
      by: ['campaignId'],
      where: {
        campaign: { brandId: { in: brandIds } },
        status: 'APPLIED',
      },
      _count: true,
    }),
    prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: {
        id: true,
        leadCreditsAllotment: true,
        leadCreditsPack: true,
        leadCreditsUsedPeriod: true,
      },
    }),
    prisma.prospect.groupBy({
      by: ['brandId'],
      where: {
        brandId: { in: brandIds },
        enrichmentStatus: 'done',
        NOT: { source: 'training' },
      },
      _count: true,
    }),
  ]);

  const bookingCampaignIds = [
    ...new Set(
      bookingsPeriod
        .map((b) => b.campaignId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const bookingCampaigns =
    bookingCampaignIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: bookingCampaignIds } },
          select: { id: true, goalType: true },
        })
      : [];
  const bookingGoalByCampaign = Object.fromEntries(
    bookingCampaigns.map((c) => [c.id, c.goalType])
  );

  const campaignIds = openCampaigns.map((c) => c.id);
  const spendByCampaign = await loadCampaignSpendStats(campaignIds, now);
  const campaignBrand = Object.fromEntries(
    openCampaigns.map((c) => [c.id, c.brandId])
  );

  const dialReadyBy = Object.fromEntries(
    dialReady.map((r) => [r.brandId!, r._count])
  );

  const seriesByBrand: Record<string, DeskDayPoint[]> = {};
  for (const id of brandIds) {
    seriesByBrand[id] = emptySeries(since);
  }
  const indexByBrandKey: Record<string, Record<string, number>> = {};
  for (const id of brandIds) {
    indexByBrandKey[id] = Object.fromEntries(
      seriesByBrand[id].map((p, i) => [p.key, i])
    );
  }

  function bump(
    brandId: string,
    at: Date,
    field: 'leads' | 'goals' | 'dials' | 'spendCents',
    amount = 1
  ) {
    const series = seriesByBrand[brandId];
    if (!series) return;
    const idx = indexByBrandKey[brandId][dayKey(at)];
    if (idx == null) return;
    series[idx][field] += amount;
  }

  for (const row of leadsRows) {
    if (!row.brandId) continue;
    bump(row.brandId, row.createdAt, 'leads');
  }

  function isConnection(row: {
    status: string | null;
    duration: number | null;
    outcome: string | null;
  }) {
    const s = (row.status || '').toLowerCase();
    const o = (row.outcome || '').toLowerCase();
    if (s === 'completed' || s === 'connected' || s === 'appointment_set') return true;
    if ((row.duration || 0) >= 15) return true;
    if (
      o === 'appointment_set' ||
      o === 'interested' ||
      o === 'callback' ||
      o === 'meeting_booked'
    ) {
      return true;
    }
    return false;
  }

  const connectionsBy: Record<string, number> = {};
  for (const id of brandIds) connectionsBy[id] = 0;
  for (const row of callRows) {
    if (!row.brandId) continue;
    bump(row.brandId, row.createdAt, 'dials');
    if (isConnection(row)) {
      connectionsBy[row.brandId] = (connectionsBy[row.brandId] || 0) + 1;
    }
  }

  const goalsBy: Record<string, number> = {};
  const auditPassedBy: Record<string, number> = {};
  const auditTotalBy: Record<string, number> = {};
  for (const id of brandIds) {
    goalsBy[id] = 0;
    auditPassedBy[id] = 0;
    auditTotalBy[id] = 0;
  }
  for (const b of bookingsPeriod) {
    const goalType = b.campaignId
      ? bookingGoalByCampaign[b.campaignId]
      : 'BOOKED_MEETING';
    if (!countsAsVerifiedGoal(goalType, 'booking')) continue;
    goalsBy[b.brandId] = (goalsBy[b.brandId] || 0) + 1;
    bump(b.brandId, b.createdAt, 'goals');
  }
  for (const c of claimsPeriod) {
    const brandId = c.campaign.brandId;
    if (c.status === 'FAILED' || c.status === 'PASSED' || c.status === 'PAID') {
      auditTotalBy[brandId] = (auditTotalBy[brandId] || 0) + 1;
      if (c.status === 'PASSED' || c.status === 'PAID') {
        auditPassedBy[brandId] = (auditPassedBy[brandId] || 0) + 1;
      }
    }
    if (c.status === 'FAILED') continue;
    if (!countsAsVerifiedGoal(c.campaign.goalType, 'claim')) continue;
    goalsBy[brandId] = (goalsBy[brandId] || 0) + 1;
    bump(brandId, c.createdAt, 'goals');
  }

  const creditsBy = Object.fromEntries(
    brandCreditRows.map((b) => [
      b.id,
      {
        used: b.leadCreditsUsedPeriod || 0,
        allotment: (b.leadCreditsAllotment || 0) + (b.leadCreditsPack || 0),
      },
    ])
  );
  const enrichedBy = Object.fromEntries(
    enrichedReady.map((r) => [r.brandId!, r._count])
  );

  const spendPeriodBy: Record<string, number> = {};
  for (const id of brandIds) spendPeriodBy[id] = 0;
  for (const p of payoutsPeriod) {
    const brandId = p.campaign.brandId;
    const cents = p.grossCents || 0;
    spendPeriodBy[brandId] = (spendPeriodBy[brandId] || 0) + cents;
    bump(brandId, p.paidAt || p.createdAt, 'spendCents', cents);
  }

  const leadsCreatedBy: Record<string, number> = {};
  const callsBy: Record<string, number> = {};
  for (const id of brandIds) {
    leadsCreatedBy[id] = seriesByBrand[id].reduce((s, d) => s + d.leads, 0);
    callsBy[id] = seriesByBrand[id].reduce((s, d) => s + d.dials, 0);
  }

  const activeByBrand: Record<string, number> = {};
  const pendingByBrand: Record<string, number> = {};
  for (const id of brandIds) {
    activeByBrand[id] = 0;
    pendingByBrand[id] = 0;
  }
  const appCampaignIds = [
    ...new Set([
      ...activeApps.map((a) => a.campaignId),
      ...pendingApps.map((a) => a.campaignId),
    ]),
  ];
  const appCampaigns =
    appCampaignIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: appCampaignIds } },
          select: { id: true, brandId: true },
        })
      : [];
  const appCampBrand = Object.fromEntries(
    appCampaigns.map((c) => [c.id, c.brandId])
  );
  for (const row of activeApps) {
    const brandId = appCampBrand[row.campaignId] || campaignBrand[row.campaignId];
    if (!brandId) continue;
    activeByBrand[brandId] = (activeByBrand[brandId] || 0) + row._count;
  }
  for (const row of pendingApps) {
    const brandId = appCampBrand[row.campaignId] || campaignBrand[row.campaignId];
    if (!brandId) continue;
    pendingByBrand[brandId] = (pendingByBrand[brandId] || 0) + row._count;
  }

  const openByBrand: Record<
    string,
    {
      count: number;
      budgetCents: number | null;
      spentCents: number;
      primaryCampaignId: string | null;
    }
  > = {};
  for (const id of brandIds) {
    openByBrand[id] = {
      count: 0,
      budgetCents: 0,
      spentCents: 0,
      primaryCampaignId: null,
    };
  }
  for (const c of openCampaigns) {
    const row = openByBrand[c.brandId];
    if (!row) continue;
    row.count += 1;
    if (!row.primaryCampaignId) row.primaryCampaignId = c.id;
    row.spentCents += spendByCampaign.get(c.id)?.spentCents || 0;
    if (c.budgetCents != null && c.budgetCents > 0) {
      row.budgetCents = (row.budgetCents || 0) + c.budgetCents;
    }
  }
  for (const id of brandIds) {
    const row = openByBrand[id];
    if (row.budgetCents === 0) {
      const anyOpen = openCampaigns.some((c) => c.brandId === id);
      const anyCapped = openCampaigns.some(
        (c) => c.brandId === id && c.budgetCents != null && c.budgetCents > 0
      );
      if (!anyOpen || !anyCapped) row.budgetCents = null;
    }
  }

  for (const brand of brands) {
    const open = openByBrand[brand.id];
    out.set(
      brand.id,
      buildBrandEconomics({
        brandKey: keyById[brand.id],
        periodDays: PERIOD_DAYS,
        leadsCreatedInPeriod: leadsCreatedBy[brand.id] || 0,
        goalsInPeriod: goalsBy[brand.id] || 0,
        spendInPeriodCents: spendPeriodBy[brand.id] || 0,
        dialReadyLeads: dialReadyBy[brand.id] || 0,
        callsInPeriod: callsBy[brand.id] || 0,
        activeSdrs: activeByBrand[brand.id] || 0,
        pendingApplications: pendingByBrand[brand.id] || 0,
        openCampaigns: open.count,
        budgetCents: open.budgetCents,
        spentCents: open.spentCents,
        primaryCampaignId: open.primaryCampaignId,
        series: seriesByBrand[brand.id],
        vitals: {
          connections: connectionsBy[brand.id] || 0,
          leadCreditsUsed: creditsBy[brand.id]?.used || 0,
          leadCreditsAllotment: creditsBy[brand.id]?.allotment || 0,
          auditPassed: auditPassedBy[brand.id] || 0,
          auditTotal: auditTotalBy[brand.id] || 0,
          enrichedLeads: enrichedBy[brand.id] || dialReadyBy[brand.id] || 0,
        },
      })
    );
  }

  return out;
}

export async function loadDeskEconomicsForBrand(
  brand: { id: string; slug: string | null },
  now: Date = new Date()
): Promise<BrandEconomics> {
  const map = await loadDeskEconomicsForBrands([brand], now);
  return (
    map.get(brand.id) ||
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
      series: emptySeries(periodStart(now)),
    })
  );
}

/** Merge series across brands for portfolio-level charts. */
export function mergeDeskSeries(list: BrandEconomics[]): DeskDayPoint[] {
  if (list.length === 0) return emptySeries(periodStart());
  const base = list[0].series.map((p) => ({ ...p }));
  for (let i = 1; i < list.length; i++) {
    const series = list[i].series;
    for (let d = 0; d < base.length; d++) {
      const point = series[d];
      if (!point) continue;
      base[d].leads += point.leads;
      base[d].goals += point.goals;
      base[d].dials += point.dials;
      base[d].spendCents += point.spendCents;
    }
  }
  return base;
}
