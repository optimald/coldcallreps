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
import type { DemoLeadRow } from '@/lib/demo/demo-leads-by-brand';

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
  const weekday = (daysBack: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  };
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
