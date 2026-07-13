/**
 * In-memory sample data for brand desk Demo mode.
 * Never written to Postgres — Live mode always uses real API/DB data.
 *
 * Canonical brands: MeridianOps (SaaS), Harborline (insurance), SummitShield (home).
 * Prefer getDemoBrandFixture(slug) / getDemoCampaigns(slug) for per-brand data.
 */

import {
  CANONICAL_DEMO_BRANDS,
  resolveDemoBrandKey,
} from '@/lib/demo/canonical-brands';
import { buildAllDemoLeads, buildDemoLeadsForBrand } from '@/lib/demo/demo-leads-by-brand';
import {
  getAllDemoApplications,
  getAllDemoCampaigns,
  getAllDemoPipelineJobs,
  getAllDemoPayouts,
  getAllDemoTeam,
  getDemoBrandFixture,
  getFixtureCallsBoard,
  getFixtureEconomics,
  type DemoApplication,
  type DemoCallsBoard,
  type DemoCampaign,
  type DemoKpis,
  type DemoPipelineJob,
  type DemoPayout,
  type DemoTeamMember,
} from '@/lib/demo/demo-brand-fixtures';
import { formatUsd, riskScore, utcDayKey, weekdayLabelFromDayKey } from '@/lib/desk-economics';
import type { DemoLeadRow } from '@/lib/demo/demo-leads-by-brand';
import type { VerifiedGoalRow } from '@/lib/verified-goals-shared';

export type {
  DemoApplication,
  DemoCallsBoard,
  DemoCampaign,
  DemoKpis,
  DemoPipelineJob,
  DemoPayout,
  DemoTeamMember,
};
export type DemoLead = DemoLeadRow;

export const DEMO_MSG = 'Demo mode — read-only sample';

export {
  CANONICAL_DEMO_BRANDS,
  getDemoBrandFixture,
  resolveDemoBrandKey,
};

export const DEMO_CAMPAIGNS: DemoCampaign[] = getAllDemoCampaigns();
export const DEMO_LEADS = buildAllDemoLeads(45);
export const DEMO_APPLICATIONS: DemoApplication[] = getAllDemoApplications();
export const DEMO_TEAM: DemoTeamMember[] = getAllDemoTeam();
export const DEMO_PAYOUTS: DemoPayout[] = getAllDemoPayouts();
export const DEMO_PIPELINE_JOBS: DemoPipelineJob[] = getAllDemoPipelineJobs();

export const DEMO_KPIS: DemoKpis = {
  openCampaigns: 6,
  pendingApplications: 5,
  leads: DEMO_LEADS.length,
  callsToday: 28,
  escrowBalanceCents: 520000,
  escrowLabel: '$5,200.00',
  leadCreditsUsed: 45,
  leadCreditsAvailable: 100,
};

export function getDemoCampaigns(brandKey: string): DemoCampaign[] {
  return getDemoBrandFixture(brandKey).campaigns;
}

export function getDemoLeads(brandKey: string) {
  return buildDemoLeadsForBrand(brandKey, 45);
}

export function getDemoApplications(brandKey: string): DemoApplication[] {
  return getDemoBrandFixture(brandKey).applications;
}

export function getDemoTeam(brandKey: string): DemoTeamMember[] {
  return getDemoBrandFixture(brandKey).team;
}

export type DemoTeamMemberWithMetrics = DemoTeamMember & {
  brandKey?: string;
  brandName?: string;
  verifiedGoals: number;
  campaigns: (DemoTeamMember['campaigns'][number] & {
    brandKey?: string;
    brandName?: string;
    dials: number;
    verifiedGoals: number;
    lastCallAt: string | null;
  })[];
};

/** Attach per-campaign dials + verified goals for team table nesting. */
export function enrichDemoTeamMetrics(
  brandKey: string,
  brandName?: string,
  members?: DemoTeamMember[]
): DemoTeamMemberWithMetrics[] {
  const key = resolveDemoBrandKey(brandKey);
  const name =
    brandName ||
    CANONICAL_DEMO_BRANDS.find((b) => b.slug === key)?.name ||
    'Demo brand';
  const team = members || getDemoTeam(key);
  const board = getDemoCallsBoard(key, name);
  const goals = getDemoVerifiedGoals(key, name);
  const callRows = [...(board.active || []), ...(board.past || [])];

  return team.map((m) => {
    const campaigns = m.campaigns.map((c, i) => {
      const campCalls = callRows.filter(
        (row) => row.sdrId === m.userId && row.campaignId === c.id
      );
      const fromBoard = campCalls.length;
      // Fall back to a stable split of roster dials when board has no per-campaign rows.
      const share =
        fromBoard > 0
          ? fromBoard
          : Math.max(
              0,
              Math.floor(m.dials / Math.max(1, m.campaigns.length)) +
                (i === 0 ? m.dials % Math.max(1, m.campaigns.length) : 0)
            );
      const campGoals = goals.filter(
        (g) => g.repUserId === m.userId && g.campaignId === c.id
      ).length;
      const lastFromBoard = campCalls
        .map((row) => row.createdAt || row.updatedAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      return {
        ...c,
        brandKey: key,
        brandName: name,
        dials: share,
        verifiedGoals: campGoals,
        lastCallAt: lastFromBoard || (i === 0 ? m.lastCallAt : null),
      };
    });
    const verifiedGoals = campaigns.reduce((s, c) => s + c.verifiedGoals, 0);
    const dials = campaigns.reduce((s, c) => s + c.dials, 0) || m.dials;
    const lastCallAt =
      campaigns
        .map((c) => c.lastCallAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ||
      m.lastCallAt;
    return {
      ...m,
      brandKey: key,
      brandName: name,
      dials,
      verifiedGoals,
      lastCallAt,
      campaigns,
    };
  });
}

export function getDemoPayouts(brandKey: string): DemoPayout[] {
  return getDemoBrandFixture(brandKey).payouts;
}

export function getDemoPipelineJobs(brandKey: string): DemoPipelineJob[] {
  return getDemoBrandFixture(brandKey).pipelineJobs;
}

export function getDemoKpis(brandKey: string): DemoKpis {
  return getDemoBrandFixture(brandKey).kpis;
}

export function getDemoEconomics(brandKey?: string) {
  return getFixtureEconomics(brandKey || CANONICAL_DEMO_BRANDS[0].slug);
}

export function getDemoCallsBoard(brandKey: string, brandName: string) {
  return getFixtureCallsBoard(brandKey, brandName);
}

/** Demo verified goals (payout-eligible outcomes) for a brand. */
export function getDemoVerifiedGoals(brandKey: string, brandName?: string): VerifiedGoalRow[] {
  const key = resolveDemoBrandKey(brandKey);
  const name =
    brandName ||
    CANONICAL_DEMO_BRANDS.find((b) => b.slug === key)?.name ||
    'Demo brand';
  const board = getFixtureCallsBoard(key, name);
  const campaigns = getDemoCampaigns(key);
  const payoutByCamp = Object.fromEntries(
    getDemoPayouts(key).map((p) => [p.campaignId, p])
  );
  const campTitle = (id: string | null | undefined) =>
    campaigns.find((c) => c.id === id)?.title || null;
  const campPayout = (id: string | null | undefined) => {
    const camp = campaigns.find((c) => c.id === id);
    const pay = id ? payoutByCamp[id] : null;
    return {
      cents: pay?.grossCents ?? null,
      status: pay?.status ?? null,
      title: camp?.title || null,
    };
  };

  const fromUpcoming: VerifiedGoalRow[] = board.upcoming
    .filter((u) => u.kind === 'booking')
    .map((u) => {
      const pay = campPayout(u.campaignId);
      return {
        id: `demo-goal-${u.id}`,
        kind: 'booking' as const,
        title: u.title,
        companyName: u.companyName || u.title,
        repName: u.sdrName || 'SDR',
        repUserId: u.sdrId || null,
        status: 'BOOKED',
        at: u.startsAt,
        campaignId: u.campaignId,
        campaignTitle: u.campaignTitle || pay.title,
        brandId: board.brand.id,
        brandName: name,
        brandKey: key,
        payoutCents: pay.cents,
        payoutStatus: pay.status,
      };
    });

  const fromPast: VerifiedGoalRow[] = board.past
    .filter((c) => {
      const o = (c.outcome || '').toLowerCase();
      return o.includes('book') || o === 'interested' || o.includes('qualified');
    })
    .map((c) => {
      const pay = campPayout(c.campaignId);
      const isBook = (c.outcome || '').toLowerCase().includes('book');
      return {
        id: `demo-goal-${c.id}`,
        kind: (isBook ? 'claim' : 'call') as VerifiedGoalRow['kind'],
        title: c.campaignTitle || c.outcome || 'Goal',
        companyName: c.companyName || 'Lead',
        repName: c.sdrName || 'SDR',
        repUserId: c.sdrId || null,
        status: isBook ? 'PASSED' : c.outcome || 'QUALIFIED',
        at: c.createdAt || new Date().toISOString(),
        campaignId: c.campaignId,
        campaignTitle: c.campaignTitle || campTitle(c.campaignId),
        brandId: board.brand.id,
        brandName: name,
        brandKey: key,
        payoutCents: isBook ? pay.cents : null,
        payoutStatus: isBook ? pay.status || 'PENDING' : null,
      };
    });

  return [...fromUpcoming, ...fromPast].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

/** Demo SDR verified goals across all demo brands. */
export function getDemoRepVerifiedGoals(): VerifiedGoalRow[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => getDemoVerifiedGoals(b.slug, b.name)).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

/** Demo sidebar pills for a brand desk. */
export function getDemoBrandNavCounts(
  brandKey: string,
  brandsCount = CANONICAL_DEMO_BRANDS.length
): {
  leads: number;
  generateLeads: number;
  liveCalls: number;
  campaigns: number;
  playbooks: number;
  verifiedGoals: number;
  recruit: number;
  team: number;
  payouts: number;
  brands: number;
} {
  const fix = getDemoBrandFixture(brandKey);
  const generateLeads = fix.pipelineJobs.filter(
    (j) => j.status === 'queued' || j.status === 'running'
  ).length;
  const payouts = fix.payouts.filter((p) => p.status === 'PENDING').length;
  return {
    leads: fix.kpis.leads,
    generateLeads: generateLeads || 2,
    liveCalls: 0,
    campaigns: fix.kpis.openCampaigns,
    playbooks: 2,
    verifiedGoals: getDemoVerifiedGoals(brandKey).length,
    recruit: fix.kpis.pendingApplications,
    team: fix.team.length,
    payouts,
    brands: brandsCount,
  };
}

/** Demo SDR sidebar pills. */
export function getDemoRepNavCounts(): {
  brandDeals: number;
  coldCall: number;
  verifiedGoals: number;
  earnings: number;
} {
  return {
    brandDeals: 2,
    coldCall: 6,
    verifiedGoals: getDemoRepVerifiedGoals().length,
    earnings: 1,
  };
}

export function isDemoEntityId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('demo-'));
}

export type DemoStats = {
  openCount: number;
  pendingApps: number;
  activeApps: number;
  leadCount: number;
  callsToday: number;
  bookings: number;
  paidOutCents: number;
  connectRate: string;
  acceptRate: string;
  bookRate: string;
  avgLabel: string;
  campaignCount: number;
  appCount: number;
  callCount: number;
  rejectedApps: number;
  pipeline: { label: string; value: number }[];
  days: { key: string; label: string; count: number }[];
  perSdr: {
    userId: string;
    name: string;
    slug: string | null;
    verified: boolean;
    campaigns: number;
    dials: number;
    meetings: number;
    completed: number;
    payouts: number;
    payoutCents: number;
    avgDuration: number | null;
    lastAt: string | null;
    statuses: string[];
  }[];
};

export function getDemoStats(brandKey?: string): DemoStats {
  const fix = getDemoBrandFixture(brandKey || CANONICAL_DEMO_BRANDS[0].slug);
  const econ = fix.economics;
  const weekday = (daysBack: number) => weekdayLabelFromDayKey(utcDayKey(daysBack));
  return {
    openCount: fix.kpis.openCampaigns,
    pendingApps: fix.kpis.pendingApplications,
    activeApps: fix.team.length,
    leadCount: fix.kpis.leads,
    callsToday: fix.kpis.callsToday,
    bookings: econ.goalsInPeriod,
    paidOutCents: fix.payouts
      .filter((p) => p.status === 'PAID' || p.status === 'APPROVED')
      .reduce((s, p) => s + p.grossCents, 0),
    connectRate: '42%',
    acceptRate: '60%',
    bookRate: '18%',
    avgLabel: '2m 14s',
    campaignCount: fix.campaigns.length,
    appCount: fix.applications.length,
    callCount: Math.round(econ.avgCallsPerDay * 7),
    rejectedApps: fix.applications.filter((a) => a.status === 'REJECTED').length,
    pipeline: [
      { label: 'Applied', value: fix.kpis.pendingApplications },
      { label: 'Active', value: fix.team.length },
      { label: 'Rejected', value: 1 },
    ],
    days: (econ.series || []).map((d, i) => ({
      key: d.key,
      label: d.label || weekday(6 - i),
      count: d.dials,
    })),
    perSdr: fix.team.map((t, i) => ({
      userId: t.userId,
      name: t.name,
      slug: t.slug,
      verified: true,
      campaigns: t.campaigns.length,
      dials: t.dials,
      meetings: Math.max(1, Math.floor(t.dials / 12)),
      completed: Math.max(1, Math.floor(t.dials * 0.42)),
      payouts: Math.max(1, Math.floor(t.dials / 15)),
      payoutCents: 8500 + i * 1200,
      avgDuration: 134,
      lastAt: new Date(Date.now() - i * 86400_000).toISOString(),
      statuses: t.campaigns.some((c) => c.status === 'ACTIVE') ? ['ACTIVE'] : ['APPLIED'],
    })),
  };
}

/** Portfolio home payload for Demo desk (SSR-safe; UTC day labels). */
export function buildDemoPortfolio() {
  const stats = getDemoStats('demo-meridianops');
  const brands = CANONICAL_DEMO_BRANDS.map((b) => {
    const economics = getDemoEconomics(b.slug);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      logoUrl: b.logoUrl,
      openCampaigns: 2,
      walletLabel: '$0',
      balanceCents: 0,
      economics,
      risk: riskScore(economics),
    };
  });

  brands[0].walletLabel = '$3,100';
  brands[0].balanceCents = 310000;
  brands[1].walletLabel = '$2,450';
  brands[1].balanceCents = 245000;
  brands[2].walletLabel = '$1,100';
  brands[2].balanceCents = 110000;

  brands.sort((a, b) => b.risk - a.risk);
  const walletTotal = brands.reduce((s, b) => s + b.balanceCents, 0);
  const goalsPerWeek = brands.reduce((s, b) => s + b.economics.goalsInPeriod, 0);
  const spendPerWeek = brands.reduce((s, b) => s + b.economics.spendInPeriodCents, 0);

  const exceptions = brands
    .flatMap((b) =>
      b.economics.signals
        .filter((s) => s.tone === 'bad' || s.tone === 'warn')
        .slice(0, 2)
        .map((s) => ({
          brandId: b.id,
          brandKey: b.slug,
          brandName: b.name,
          logoUrl: b.logoUrl,
          signal: s,
        }))
    )
    .sort((a, b) => b.signal.priority - a.signal.priority)
    .slice(0, 8);

  return {
    brandCount: brands.length,
    kpis: {
      openCampaigns: brands.reduce((s, b) => s + b.openCampaigns, 0),
      pendingApplications: DEMO_KPIS.pendingApplications,
      activeSdrs: DEMO_TEAM.length,
      leads: DEMO_KPIS.leads,
      callsToday: DEMO_KPIS.callsToday,
      bookings: stats.bookings,
      escrowLabel: `$${(walletTotal / 100).toFixed(0)}`,
      goalsPerWeek,
      costPerGoalLabel:
        goalsPerWeek > 0 ? formatUsd(Math.round(spendPerWeek / goalsPerWeek)) : '—',
      brandsAtRisk: brands.filter((b) => b.risk >= 50).length,
    },
    dialVolume: stats.days,
    brands,
    exceptions,
    activity: {
      applications: DEMO_APPLICATIONS.slice(0, 5).map((a, i) => ({
        id: a.id,
        status: a.status,
        createdAt: a.createdAt,
        repName: a.displayName,
        campaignTitle: a.campaignTitle,
        brandName: brands[i % brands.length]?.name || 'MeridianOps',
        brandKey: brands[i % brands.length]?.slug || 'demo-meridianops',
      })),
      calls: [] as {
        id: string;
        status: string;
        createdAt: string;
        durationSec: number | null;
        companyName: string;
        repName: string;
        brandName: string;
        brandKey: string;
      }[],
    },
  };
}
