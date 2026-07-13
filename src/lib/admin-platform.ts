import 'server-only';

import { BRAND_LEAD_PLAN, PLAN } from '@/lib/product';
import {
  buildBrandEconomics,
  formatUsd,
  riskScore,
  type BrandEconomics,
} from '@/lib/desk-economics';
import { loadDeskEconomicsForBrands } from '@/lib/desk-economics-load';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number, from = new Date()): Date {
  const d = startOfUtcDay(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function moneyLabel(cents: number): string {
  return formatUsd(cents);
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

/** Platform command-center payload for SUPERADMIN. */
export async function loadAdminPlatformOverview() {
  const now = new Date();
  const startOfDay = startOfUtcDay(now);
  const day30 = daysAgo(29, now);
  const day7 = daysAgo(6, now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    brandCount,
    userCount,
    openCampaigns,
    activeSdrApps,
    outreachReady,
    dialers24h,
    callsToday,
    calls30d,
    completedCalls30d,
    claims30d,
    claimsFailed30d,
    payoutAggPaidMtd,
    payoutAggPaid30d,
    payoutPending,
    walletAgg,
    escrowLockedAgg,
    leadPlanGroups,
    sdrPlanGroups,
    reviewCallCount,
    failedJobs,
    flaggedSessions,
    brandsAtRiskSeed,
    recentAudits,
    prospects30d,
    dials30d,
    fraudClaims,
    pipelineFailedRecent,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.userProfile.count(),
    prisma.campaign.count({ where: { status: 'OPEN' } }),
    prisma.campaignApplication.count({
      where: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
    }),
    prisma.prospect.count({
      where: { outreachReady: true, NOT: { source: 'training' } },
    }),
    prisma.callLog.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.callLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.callLog.count({ where: { createdAt: { gte: day30 } } }),
    prisma.callLog.count({
      where: { createdAt: { gte: day30 }, status: 'completed' },
    }),
    prisma.appointmentClaim.count({ where: { createdAt: { gte: day30 } } }),
    prisma.appointmentClaim.count({
      where: { createdAt: { gte: day30 }, status: 'FAILED' },
    }),
    prisma.campaignPayout.aggregate({
      where: {
        status: 'PAID',
        OR: [
          { paidAt: { gte: monthStart } },
          { paidAt: null, updatedAt: { gte: monthStart } },
        ],
      },
      _sum: { grossCents: true, platformFeeCents: true, netCents: true },
    }),
    prisma.campaignPayout.aggregate({
      where: {
        status: 'PAID',
        OR: [
          { paidAt: { gte: day30 } },
          { paidAt: null, updatedAt: { gte: day30 } },
        ],
      },
      _sum: { grossCents: true, platformFeeCents: true, netCents: true },
    }),
    prisma.campaignPayout.aggregate({
      where: { status: 'PENDING' },
      _sum: { grossCents: true, platformFeeCents: true, netCents: true },
      _count: true,
    }),
    prisma.brandWallet.aggregate({ _sum: { balanceCents: true } }),
    prisma.campaign.aggregate({ _sum: { escrowLockedCents: true } }),
    prisma.brand.groupBy({ by: ['leadPlan'], _count: true }),
    prisma.userProfile.groupBy({ by: ['plan'], _count: true }),
    prisma.callLog.count({ where: { needsManualReview: true } }),
    prisma.pipelineJob.count({ where: { status: 'failed' } }),
    prisma.trainerSession.count({ where: { integrityFlags: { not: null } } }),
    prisma.brand.findMany({
      select: { id: true, slug: true, name: true, logoUrl: true },
      take: 80,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { actor: { select: { displayName: true, email: true } } },
    }),
    prisma.prospect.findMany({
      where: {
        createdAt: { gte: day30 },
        NOT: { source: 'training' },
      },
      select: { createdAt: true },
    }),
    prisma.callLog.findMany({
      where: { createdAt: { gte: day30 } },
      select: { createdAt: true },
    }),
    prisma.appointmentClaim.findMany({
      where: { createdAt: { gte: day30 } },
      select: { repUserId: true, status: true },
    }),
    prisma.pipelineJob.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        query: true,
        location: true,
        errorMessage: true,
        createdAt: true,
        brand: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const dialerCount24h = dialers24h.length;
  const leadToRepRatio =
    dialerCount24h > 0
      ? Math.round((outreachReady / dialerCount24h) * 10) / 10
      : outreachReady > 0
        ? outreachReady
        : null;

  const connectRatePct = pct(completedCalls30d, calls30d);
  const auditFailRatePct = pct(claimsFailed30d, claims30d);

  const walletCents = walletAgg._sum.balanceCents || 0;
  const escrowLockedCents = escrowLockedAgg._sum.escrowLockedCents || 0;
  const tvlCents = walletCents + escrowLockedCents;

  const gmvMtdCents = payoutAggPaidMtd._sum.grossCents || 0;
  const takeRateMtdCents = payoutAggPaidMtd._sum.platformFeeCents || 0;
  const gmv30dCents = payoutAggPaid30d._sum.grossCents || 0;
  const takeRate30dCents = payoutAggPaid30d._sum.platformFeeCents || 0;

  let leadPlanMrrCents = 0;
  for (const row of leadPlanGroups) {
    const n = row._count;
    if (row.leadPlan === 'LEAD_MONTHLY') {
      leadPlanMrrCents += n * BRAND_LEAD_PLAN.LEAD_MONTHLY.priceUsd * 100;
    } else if (row.leadPlan === 'LEAD_ANNUAL') {
      leadPlanMrrCents +=
        n * (BRAND_LEAD_PLAN.LEAD_ANNUAL.monthlyEquivalentUsd ?? 99) * 100;
    }
  }

  let sdrSubMrrCents = 0;
  for (const row of sdrPlanGroups) {
    const n = row._count;
    if (row.plan === 'STARTER') sdrSubMrrCents += n * PLAN.STARTER.price * 100;
    else if (row.plan === 'PRO') sdrSubMrrCents += n * PLAN.PRO.price * 100;
    else if (row.plan === 'TEAM') sdrSubMrrCents += n * PLAN.TEAM.price * 100;
  }

  const netRevenueMtdCents = takeRateMtdCents; // SaaS billed via Stripe — MRR shown separately
  const estimatedMrrCents = leadPlanMrrCents + sdrSubMrrCents;

  // Liquidity series (30d)
  const seriesMap = new Map<string, { leads: number; dials: number }>();
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(29 - i, now);
    seriesMap.set(dayKey(d), { leads: 0, dials: 0 });
  }
  for (const p of prospects30d) {
    const k = dayKey(p.createdAt);
    const row = seriesMap.get(k);
    if (row) row.leads += 1;
  }
  for (const c of dials30d) {
    const k = dayKey(c.createdAt);
    const row = seriesMap.get(k);
    if (row) row.dials += 1;
  }
  const liquiditySeries = [...seriesMap.entries()].map(([key, v]) => ({
    key,
    label: new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    leads: v.leads,
    dials: v.dials,
    goals: 0,
    spendCents: 0,
  }));

  // Fraud scatter: bookings vs fail rate per SDR
  const byRep = new Map<string, { total: number; failed: number }>();
  for (const c of fraudClaims) {
    const row = byRep.get(c.repUserId) || { total: 0, failed: 0 };
    row.total += 1;
    if (c.status === 'FAILED') row.failed += 1;
    byRep.set(c.repUserId, row);
  }
  const repIds = [...byRep.keys()].slice(0, 40);
  const repProfiles =
    repIds.length > 0
      ? await prisma.userProfile.findMany({
          where: { id: { in: repIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
  const nameById = Object.fromEntries(
    repProfiles.map((r) => [r.id, r.displayName || r.email || 'SDR'])
  );
  const fraudScatter = [...byRep.entries()]
    .map(([repUserId, v]) => ({
      repUserId,
      name: nameById[repUserId] || 'SDR',
      bookings: v.total,
      failRatePct: v.total > 0 ? Math.round((v.failed / v.total) * 1000) / 10 : 0,
      failed: v.failed,
    }))
    .filter((r) => r.bookings >= 1)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 30);

  // Brands at risk (economics on recent brands sample — full matrix on /admin/brands)
  let brandsAtRisk = 0;
  let exceptions: Array<{
    brandId: string;
    brandKey: string;
    brandName: string;
    label: string;
    detail: string;
    tone: string;
  }> = [];
  if (brandsAtRiskSeed.length > 0) {
    const economics = await loadDeskEconomicsForBrands(brandsAtRiskSeed, now);
    for (const brand of brandsAtRiskSeed) {
      const e = economics.get(brand.id);
      if (!e) continue;
      const risk = riskScore(e);
      if (risk >= 50) brandsAtRisk += 1;
    }
    exceptions = brandsAtRiskSeed
      .flatMap((brand) => {
        const e = economics.get(brand.id);
        if (!e) return [];
        return e.signals
          .filter((s) => s.tone === 'bad' || s.tone === 'warn')
          .slice(0, 1)
          .map((s) => ({
            brandId: brand.id,
            brandKey: brand.slug || brand.id,
            brandName: brand.name,
            label: s.label,
            detail: s.detail,
            tone: s.tone,
          }));
      })
      .slice(0, 8);
  }

  const alerts: Array<{
    id: string;
    severity: 'info' | 'warn' | 'bad';
    title: string;
    detail: string;
    href?: string;
  }> = [];

  if (reviewCallCount > 0) {
    alerts.push({
      id: 'review-queue',
      severity: 'warn',
      title: `${reviewCallCount} call${reviewCallCount === 1 ? '' : 's'} need review`,
      detail: 'AI audit flagged appointments for human referee.',
      href: '/admin/review',
    });
  }
  if ((payoutPending._count || 0) > 0) {
    alerts.push({
      id: 'pending-payouts',
      severity: 'warn',
      title: `${payoutPending._count} pending payout${payoutPending._count === 1 ? '' : 's'}`,
      detail: `${moneyLabel(payoutPending._sum.grossCents || 0)} gross waiting on Connect / escrow.`,
      href: '/admin/brands',
    });
  }
  if (failedJobs > 0) {
    alerts.push({
      id: 'pipeline-failed',
      severity: 'bad',
      title: `${failedJobs} failed pipeline job${failedJobs === 1 ? '' : 's'}`,
      detail: 'Maps scrape / enrich jobs need attention.',
      href: '/admin/brands',
    });
  }
  if (flaggedSessions > 0) {
    alerts.push({
      id: 'flagged-sessions',
      severity: 'info',
      title: `${flaggedSessions} integrity-flagged practice session${flaggedSessions === 1 ? '' : 's'}`,
      detail: 'Review in Users / sessions when volume spikes.',
      href: '/admin/users',
    });
  }
  if (brandsAtRisk > 0) {
    alerts.push({
      id: 'brands-at-risk',
      severity: 'warn',
      title: `${brandsAtRisk} brand${brandsAtRisk === 1 ? '' : 's'} at risk`,
      detail: 'Low runway, exhausted budget, or stalled goals.',
      href: '/admin/brands',
    });
  }

  return {
    kpis: {
      brandCount,
      userCount,
      openCampaigns,
      activeSdrs: activeSdrApps,
      outreachReady,
      dialers24h: dialerCount24h,
      leadToRepRatio,
      callsToday,
      connectRatePct,
      auditFailRatePct,
      claims30d,
      claimsFailed30d,
      tvlCents,
      tvlLabel: moneyLabel(tvlCents),
      walletCents,
      escrowLockedCents,
      gmvMtdCents,
      gmvMtdLabel: moneyLabel(gmvMtdCents),
      gmv30dCents,
      gmv30dLabel: moneyLabel(gmv30dCents),
      takeRateMtdCents,
      takeRateMtdLabel: moneyLabel(takeRateMtdCents),
      takeRate30dCents,
      takeRate30dLabel: moneyLabel(takeRate30dCents),
      netRevenueMtdCents,
      netRevenueMtdLabel: moneyLabel(netRevenueMtdCents),
      leadPlanMrrCents,
      leadPlanMrrLabel: moneyLabel(leadPlanMrrCents),
      sdrSubMrrCents,
      sdrSubMrrLabel: moneyLabel(sdrSubMrrCents),
      estimatedMrrCents,
      estimatedMrrLabel: moneyLabel(estimatedMrrCents),
      pendingPayoutCount: payoutPending._count || 0,
      pendingPayoutGrossCents: payoutPending._sum.grossCents || 0,
      pendingPayoutLabel: moneyLabel(payoutPending._sum.grossCents || 0),
      reviewQueue: reviewCallCount,
      brandsAtRisk,
      failedJobs,
      flaggedSessions,
    },
    liquiditySeries,
    fraudScatter,
    alerts,
    exceptions,
    pipelineFailed: pipelineFailedRecent.map((j) => ({
      id: j.id,
      query: j.query,
      location: j.location,
      error: j.errorMessage,
      brandName: j.brand.name,
      brandKey: j.brand.slug || j.brand.id,
      createdAt: j.createdAt.toISOString(),
    })),
    audits: recentAudits.map((a) => ({
      id: a.id,
      action: a.action,
      targetId: a.targetId,
      createdAt: a.createdAt.toISOString(),
      actorEmail: a.actor?.email || 'system',
      actorName: a.actor?.displayName || null,
    })),
    period: { from: day30.toISOString(), to: now.toISOString() },
  };
}

/** Cross-brand matrix for SUPERADMIN. */
export async function loadAdminBrandsMatrix() {
  const now = new Date();
  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      ownerId: true,
      leadPlan: true,
      leadCreditsAllotment: true,
      leadCreditsPack: true,
      createdAt: true,
      owner: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });

  if (brands.length === 0) {
    return { brands: [], generatedAt: now.toISOString() };
  }

  const brandIds = brands.map((b) => b.id);
  const [wallets, openByBrand, activeSdrByBrand, readyByBrand, economics] =
    await Promise.all([
      Promise.all(brands.map((b) => getOrCreateBrandWallet(b.id))),
      prisma.campaign.groupBy({
        by: ['brandId'],
        where: { brandId: { in: brandIds }, status: 'OPEN' },
        _count: true,
      }),
      prisma.campaignApplication.groupBy({
        by: ['campaignId'],
        where: {
          status: { in: ['ACCEPTED', 'ACTIVE'] },
          campaign: { brandId: { in: brandIds } },
        },
        _count: true,
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
      loadDeskEconomicsForBrands(
        brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          logoUrl: b.logoUrl,
        })),
        now
      ),
    ]);

  // Map campaignId → brandId for active SDR counts
  const campaigns = await prisma.campaign.findMany({
    where: { brandId: { in: brandIds } },
    select: { id: true, brandId: true },
  });
  const campaignBrand = Object.fromEntries(campaigns.map((c) => [c.id, c.brandId]));
  const sdrCountByBrand: Record<string, number> = {};
  for (const row of activeSdrByBrand) {
    const brandId = campaignBrand[row.campaignId];
    if (!brandId) continue;
    sdrCountByBrand[brandId] = (sdrCountByBrand[brandId] || 0) + row._count;
  }

  const openMap = Object.fromEntries(openByBrand.map((r) => [r.brandId, r._count]));
  const readyMap = Object.fromEntries(
    readyByBrand.map((r) => [r.brandId!, r._count])
  );

  const emptyEconomics = buildBrandEconomics({
    brandKey: '—',
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

  const rows = brands.map((brand, i) => {
    const e = economics.get(brand.id) || emptyEconomics;
    const risk = riskScore(e);
    const credits =
      brand.leadCreditsAllotment + brand.leadCreditsPack;
    return {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: brand.logoUrl,
      ownerEmail: brand.owner?.email || null,
      ownerName: brand.owner?.displayName || null,
      leadPlan: brand.leadPlan,
      creditsRemaining: credits,
      openCampaigns: openMap[brand.id] || 0,
      activeSdrs: sdrCountByBrand[brand.id] || 0,
      dialReady: readyMap[brand.id] || e.dialReadyLeads || 0,
      balanceCents: wallets[i].balanceCents,
      walletLabel: moneyLabel(wallets[i].balanceCents),
      goals7d: e.goalsInPeriod,
      costPerGoalLabel:
        e.costPerGoalCents != null ? moneyLabel(e.costPerGoalCents) : '—',
      runwayDays: e.leadRunwayDays,
      risk,
      topSignal: e.signals.find(
        (s: BrandEconomics['signals'][number]) =>
          s.tone === 'bad' || s.tone === 'warn'
      ) || null,
      createdAt: brand.createdAt.toISOString(),
    };
  });

  rows.sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));

  return { brands: rows, generatedAt: now.toISOString() };
}

/** Manual review queue — CallLogs needing review + recent failed claims. */
export async function loadAdminReviewQueue() {
  const [calls, claims] = await Promise.all([
    prisma.callLog.findMany({
      where: { needsManualReview: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        status: true,
        outcome: true,
        duration: true,
        recordingUrl: true,
        transcript: true,
        aiAuditResult: true,
        createdAt: true,
        brandId: true,
        campaignId: true,
        prospectId: true,
        user: { select: { id: true, displayName: true, email: true } },
        brand: { select: { id: true, slug: true, name: true } },
        prospect: { select: { id: true, companyName: true } },
      },
    }),
    prisma.appointmentClaim.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        status: true,
        auditScore: true,
        auditJSON: true,
        failureReason: true,
        notes: true,
        transcriptSnippet: true,
        prospectName: true,
        meetingAt: true,
        callLogId: true,
        createdAt: true,
        campaignId: true,
        repUserId: true,
        campaign: {
          select: {
            id: true,
            title: true,
            brandId: true,
            brand: { select: { id: true, slug: true, name: true, ownerId: true } },
          },
        },
        application: {
          select: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    }),
  ]);

  return {
    calls: calls.map((c) => ({
      id: c.id,
      kind: 'call' as const,
      status: c.status,
      outcome: c.outcome,
      durationSec: c.duration,
      recordingUrl: c.recordingUrl,
      transcript: c.transcript,
      aiAuditResult: c.aiAuditResult,
      createdAt: c.createdAt.toISOString(),
      brandId: c.brandId,
      brandKey: c.brand ? c.brand.slug || c.brand.id : null,
      brandName: c.brand?.name || null,
      campaignId: c.campaignId,
      prospectId: c.prospectId,
      companyName: c.prospect?.companyName || null,
      repName: c.user.displayName || c.user.email || 'SDR',
      repEmail: c.user.email,
      repUserId: c.user.id,
    })),
    claims: claims.map((c) => ({
      id: c.id,
      kind: 'claim' as const,
      status: c.status,
      auditScore: c.auditScore,
      auditJSON: c.auditJSON,
      failureReason: c.failureReason,
      notes: c.notes,
      transcriptSnippet: c.transcriptSnippet,
      prospectName: c.prospectName,
      meetingAt: c.meetingAt?.toISOString() || null,
      callLogId: c.callLogId,
      createdAt: c.createdAt.toISOString(),
      campaignId: c.campaignId,
      campaignTitle: c.campaign.title,
      brandId: c.campaign.brandId,
      brandKey: c.campaign.brand.slug || c.campaign.brand.id,
      brandName: c.campaign.brand.name,
      brandOwnerId: c.campaign.brand.ownerId,
      repName:
        c.application.user.displayName || c.application.user.email || 'SDR',
      repEmail: c.application.user.email,
      repUserId: c.application.user.id,
    })),
  };
}
