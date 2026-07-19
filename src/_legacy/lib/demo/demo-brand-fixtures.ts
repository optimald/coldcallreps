/**
 * In-memory demo fixtures for the three canonical high-ticket brands.
 * Never written to Postgres — desk Demo mode only.
 */

import {
  CANONICAL_DEMO_BRANDS,
  resolveDemoBrandKey,
} from '@/lib/demo/canonical-brands';
import { buildDemoLeadsForBrand } from '@/lib/demo/demo-leads-by-brand';
import {
  buildBrandEconomics,
  utcDayKey,
  weekdayLabelFromDayKey,
  type BrandEconomics,
} from '@/lib/desk-economics';

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400_000).toISOString();
}

export type DemoCampaign = {
  id: string;
  title: string;
  description: string;
  status: string;
  payoutLabel: string;
  goalLabel: string;
  applicationCount: number;
  bookingLink?: string | null;
  targetVertical?: string | null;
  targetLocation?: string | null;
  escrowLabel?: string | null;
  dateRangeLabel?: string | null;
  budgetLabel?: string | null;
  remainingOverallCents?: number | null;
  activateOn?: boolean;
  budgetMode?: string;
  budgetCents?: number | null;
  dailyBudgetCents?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  progress?: {
    targeting: number;
    conditioning: number;
    dialingReady: number;
    dialingActive: number;
    booked: number;
    dials?: number;
    maxAwards?: number | null;
  };
};

export type DemoApplication = {
  id: string;
  status: string;
  campaignId: string;
  campaignTitle: string;
  displayName: string;
  profileSlug: string | null;
  createdAt: string;
};

export type DemoTeamMember = {
  userId: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  campaigns: { id: string; title: string; status: string }[];
  dials: number;
  lastCallAt: string | null;
};

export type DemoPayout = {
  id: string;
  status: string;
  grossCents: number;
  campaignId: string;
  campaignTitle: string;
  sdrName: string;
  sdrId: string;
  createdAt: string;
};

export type DemoKpis = {
  openCampaigns: number;
  pendingApplications: number;
  leads: number;
  callsToday: number;
  escrowBalanceCents: number;
  escrowLabel: string;
  /** Lead credits used this period */
  leadCreditsUsed?: number;
  /** Lead credits available this period (allotment) */
  leadCreditsAvailable?: number;
};

export type DemoUpcomingCall = {
  id: string;
  kind: 'booking' | 'callback';
  title: string;
  startsAt: string;
  endsAt: string | null;
  meetLink: string | null;
  htmlLink: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string | null;
  companyName: string | null;
  prospectId: string | null;
};

export type DemoCallRow = {
  id: string;
  status: string;
  direction: string;
  outcome: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string;
  companyName: string | null;
  contactName: string | null;
  prospectId: string | null;
  toNumber: string | null;
  fromNumber: string | null;
};

export type DemoCallsBoard = {
  upcoming: DemoUpcomingCall[];
  active: DemoCallRow[];
  past: DemoCallRow[];
  polledAt: string;
};

export type DemoPipelineJob = {
  id: string;
  brandId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  query: string;
  location: string;
  status: string;
  savedCount: number;
  readyCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type BrandFixture = {
  campaigns: DemoCampaign[];
  applications: DemoApplication[];
  team: DemoTeamMember[];
  payouts: DemoPayout[];
  pipelineJobs: DemoPipelineJob[];
  kpis: DemoKpis;
};

function camp(
  partial: Omit<DemoCampaign, 'budgetMode' | 'endsAt'> &
    Partial<Pick<DemoCampaign, 'budgetMode' | 'endsAt'>>
): DemoCampaign {
  return { budgetMode: 'OVERALL', endsAt: null, ...partial };
}

function app(
  id: string,
  status: string,
  campaignId: string,
  campaignTitle: string,
  displayName: string,
  ago: number
): DemoApplication {
  return { id, status, campaignId, campaignTitle, displayName, profileSlug: null, createdAt: daysAgo(ago) };
}

function demoAvatar(name: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=e8e4dc`;
}

function member(
  userId: string,
  name: string,
  campaigns: DemoTeamMember['campaigns'],
  dials: number,
  lastAgo: number
): DemoTeamMember {
  return {
    userId,
    name,
    slug: null,
    avatarUrl: demoAvatar(name),
    campaigns,
    dials,
    lastCallAt: daysAgo(lastAgo),
  };
}

function pay(
  id: string,
  status: string,
  grossCents: number,
  campaignId: string,
  campaignTitle: string,
  sdrName: string,
  sdrId: string,
  ago: number
): DemoPayout {
  return {
    id,
    status,
    grossCents,
    campaignId,
    campaignTitle,
    sdrName,
    sdrId,
    createdAt: daysAgo(ago),
  };
}

function job(
  id: string,
  brandId: string,
  campaignId: string | null,
  campaignTitle: string | null,
  query: string,
  location: string,
  status: string,
  savedCount: number,
  readyCount: number,
  ago: number,
  errorMessage: string | null = null
): DemoPipelineJob {
  const createdAt = status === 'running' ? hoursFromNow(-0.4) : daysAgo(ago);
  return {
    id,
    brandId,
    campaignId,
    campaignTitle,
    query,
    location,
    status,
    savedCount,
    readyCount,
    errorMessage,
    createdAt,
    completedAt: status === 'running' ? null : daysAgo(ago),
  };
}

const MERIDIAN: BrandFixture = {
  campaigns: [
    camp({
      id: 'demo-camp-meridian-ql',
      title: 'RevOps qualified lead wave',
      description: 'Book discovery with mid-market sales orgs evaluating pipeline / forecast tooling.',
      status: 'OPEN',
      activateOn: true,
      payoutLabel: '$30',
      goalLabel: 'Qualified lead',
      applicationCount: 5,
      bookingLink: 'https://cal.com/meridianops/ql',
      targetVertical: 'B2B SaaS / RevOps',
      targetLocation: 'United States',
      escrowLabel: '$1,200',
      dateRangeLabel: 'Jul 1 – Ongoing',
      budgetLabel: '$4k',
      budgetCents: 400000,
      remainingOverallCents: 305000,
      startsAt: daysAgo(14),
      progress: { targeting: 48, conditioning: 22, dialingReady: 32, dialingActive: 14, booked: 6, dials: 128, maxAwards: 80 },
    }),
    camp({
      id: 'demo-camp-meridian-ent',
      title: 'Enterprise booked meeting',
      description: 'AE-ready intros with 200+ seat sales orgs. Higher ACV; longer cycle.',
      status: 'OPEN',
      activateOn: true,
      payoutLabel: '$250',
      goalLabel: 'Booked meeting',
      applicationCount: 3,
      bookingLink: 'https://cal.com/meridianops/ent',
      targetVertical: 'Enterprise SaaS buyers',
      targetLocation: 'United States',
      escrowLabel: '$2,500',
      dateRangeLabel: 'Jun 20 – Ongoing',
      budgetLabel: '$5k',
      budgetCents: 500000,
      remainingOverallCents: 410000,
      startsAt: daysAgo(22),
      progress: { targeting: 18, conditioning: 9, dialingReady: 11, dialingActive: 4, booked: 2, dials: 41, maxAwards: 20 },
    }),
  ],
  applications: [
    app('demo-app-mer-1', 'APPLIED', 'demo-camp-meridian-ql', 'RevOps qualified lead wave', 'Maya Chen', 1),
    app('demo-app-mer-2', 'ACTIVE', 'demo-camp-meridian-ql', 'RevOps qualified lead wave', 'Dev Patel', 7),
    app('demo-app-mer-3', 'APPLIED', 'demo-camp-meridian-ent', 'Enterprise booked meeting', 'Alex Kim', 2),
  ],
  team: [
    member('demo-user-mer-dev', 'Dev Patel', [{ id: 'demo-camp-meridian-ql', title: 'RevOps qualified lead wave', status: 'ACTIVE' }], 52, 0),
    member('demo-user-jordan', 'Jordan Lee', [
      { id: 'demo-camp-meridian-ql', title: 'RevOps qualified lead wave', status: 'ACTIVE' },
      { id: 'demo-camp-meridian-ent', title: 'Enterprise booked meeting', status: 'ACTIVE' },
    ], 38, 0),
    member('demo-user-riley', 'Riley Quinn', [{ id: 'demo-camp-meridian-ent', title: 'Enterprise booked meeting', status: 'ACTIVE' }], 21, 1),
  ],
  payouts: [
    pay('demo-pay-mer-1', 'PAID', 3000, 'demo-camp-meridian-ql', 'RevOps qualified lead wave', 'Dev Patel', 'demo-user-mer-dev', 4),
    pay('demo-pay-mer-2', 'APPROVED', 25000, 'demo-camp-meridian-ent', 'Enterprise booked meeting', 'Jordan Lee', 'demo-user-jordan', 2),
    pay('demo-pay-mer-3', 'PENDING', 3000, 'demo-camp-meridian-ql', 'RevOps qualified lead wave', 'Riley Quinn', 'demo-user-riley', 0),
  ],
  pipelineJobs: [
    job('demo-job-mer-1', 'demo-brand-meridianops', 'demo-camp-meridian-ql', 'RevOps qualified lead wave', 'B2B SaaS sales ops teams', 'United States', 'completed', 36, 28, 3),
    job('demo-job-mer-2', 'demo-brand-meridianops', 'demo-camp-meridian-ent', 'Enterprise booked meeting', 'enterprise CRO / VP Sales', 'San Francisco Bay Area', 'running', 9, 3, 0),
  ],
  kpis: { openCampaigns: 2, pendingApplications: 2, leads: 45, callsToday: 18, escrowBalanceCents: 370000, escrowLabel: '$3,700.00', leadCreditsUsed: 45, leadCreditsAvailable: 100 },
};

const HARBOR: BrandFixture = {
  campaigns: [
    camp({
      id: 'demo-camp-harbor-life',
      title: 'Term / life agency wave',
      description: 'Book discovery with independent life agencies and BGA desks writing $5M+ face.',
      status: 'OPEN',
      activateOn: true,
      payoutLabel: '$175',
      goalLabel: 'Booked meeting',
      applicationCount: 6,
      bookingLink: 'https://cal.com/harborline/life',
      targetVertical: 'independent life insurance agencies',
      targetLocation: 'Austin, TX',
      escrowLabel: '$3,500',
      dateRangeLabel: 'Jul 1 – Ongoing',
      budgetLabel: '$2.4k',
      budgetCents: 240000,
      remainingOverallCents: 178000,
      startsAt: daysAgo(12),
      progress: { targeting: 24, conditioning: 12, dialingReady: 18, dialingActive: 9, booked: 4, dials: 86, maxAwards: 40 },
    }),
    camp({
      id: 'demo-camp-harbor-ma',
      title: 'Medicare Advantage enrollments',
      description: 'AEP-ready MA appointment sets with agency principals. Paused for creative refresh.',
      status: 'PAUSED',
      activateOn: false,
      payoutLabel: '$125',
      goalLabel: 'Booked meeting',
      applicationCount: 2,
      bookingLink: 'https://cal.com/harborline/ma',
      targetVertical: 'Medicare Advantage agencies',
      targetLocation: 'Florida',
      escrowLabel: '$0',
      dateRangeLabel: 'May 1 – Ongoing',
      budgetLabel: '$1.5k',
      budgetCents: 150000,
      remainingOverallCents: 150000,
      startsAt: daysAgo(40),
      progress: { targeting: 10, conditioning: 4, dialingReady: 3, dialingActive: 0, booked: 0, dials: 14, maxAwards: 25 },
    }),
  ],
  applications: [
    app('demo-app-har-1', 'APPLIED', 'demo-camp-harbor-life', 'Term / life agency wave', 'Ava Martinez', 1),
    app('demo-app-har-2', 'ACTIVE', 'demo-camp-harbor-life', 'Term / life agency wave', 'Sam Rivera', 8),
    app('demo-app-har-3', 'APPLIED', 'demo-camp-harbor-ma', 'Medicare Advantage enrollments', 'Noah Patel', 3),
  ],
  team: [
    member('demo-user-har-sam', 'Sam Rivera', [{ id: 'demo-camp-harbor-life', title: 'Term / life agency wave', status: 'ACTIVE' }], 47, 0),
    member('demo-user-jordan', 'Jordan Lee', [{ id: 'demo-camp-harbor-life', title: 'Term / life agency wave', status: 'ACTIVE' }], 31, 1),
    member('demo-user-riley', 'Riley Quinn', [{ id: 'demo-camp-harbor-life', title: 'Term / life agency wave', status: 'ACTIVE' }], 18, 2),
  ],
  payouts: [
    pay('demo-pay-har-1', 'PAID', 17500, 'demo-camp-harbor-life', 'Term / life agency wave', 'Sam Rivera', 'demo-user-har-sam', 3),
    pay('demo-pay-har-2', 'APPROVED', 17500, 'demo-camp-harbor-life', 'Term / life agency wave', 'Jordan Lee', 'demo-user-jordan', 1),
    pay('demo-pay-har-3', 'PENDING', 12500, 'demo-camp-harbor-ma', 'Medicare Advantage enrollments', 'Riley Quinn', 'demo-user-riley', 0),
  ],
  pipelineJobs: [
    job('demo-job-har-1', 'demo-brand-harborline', 'demo-camp-harbor-life', 'Term / life agency wave', 'independent life insurance agencies', 'Austin, TX', 'completed', 24, 18, 2),
    job('demo-job-har-2', 'demo-brand-harborline', 'demo-camp-harbor-ma', 'Medicare Advantage enrollments', 'Medicare Advantage agencies', 'Florida', 'completed', 16, 11, 1),
    job('demo-job-har-3', 'demo-brand-harborline', null, null, 'final expense agencies', 'Texas', 'failed', 0, 0, 5, 'Maps API rate limited — retry later'),
  ],
  kpis: { openCampaigns: 1, pendingApplications: 2, leads: 45, callsToday: 14, escrowBalanceCents: 245000, escrowLabel: '$2,450.00', leadCreditsUsed: 28, leadCreditsAvailable: 100 },
};

const SUMMIT: BrandFixture = {
  campaigns: [
    camp({
      id: 'demo-camp-summit-roof',
      title: 'Roof inspection set',
      description: 'Set in-home / virtual roof inspections for storm and aging-roof homeowners.',
      status: 'OPEN',
      activateOn: true,
      payoutLabel: '$85',
      goalLabel: 'Inspection set',
      applicationCount: 4,
      bookingLink: 'https://cal.com/summitshield/roof',
      targetVertical: 'residential roofing',
      targetLocation: 'Denver, CO',
      escrowLabel: '$1,700',
      dateRangeLabel: 'Jul 1 – Ongoing',
      budgetLabel: '$1.8k',
      budgetCents: 180000,
      remainingOverallCents: 135000,
      startsAt: daysAgo(10),
      progress: { targeting: 54, conditioning: 28, dialingReady: 42, dialingActive: 16, booked: 5, dials: 112, maxAwards: 60 },
    }),
    camp({
      id: 'demo-camp-summit-hvac',
      title: 'HVAC appointment wave',
      description: 'Book replacement consults for aging HVAC systems. Peak-season capacity limited.',
      status: 'OPEN',
      activateOn: true,
      payoutLabel: '$75',
      goalLabel: 'Appointment set',
      applicationCount: 3,
      bookingLink: 'https://cal.com/summitshield/hvac',
      targetVertical: 'residential HVAC',
      targetLocation: 'Phoenix, AZ',
      escrowLabel: '$1,200',
      dateRangeLabel: 'Jun 15 – Ongoing',
      budgetLabel: '$1.2k',
      budgetCents: 120000,
      remainingOverallCents: 90000,
      startsAt: daysAgo(28),
      progress: { targeting: 30, conditioning: 14, dialingReady: 18, dialingActive: 7, booked: 3, dials: 64, maxAwards: 40 },
    }),
  ],
  applications: [
    app('demo-app-sum-1', 'APPLIED', 'demo-camp-summit-roof', 'Roof inspection set', 'Casey Brooks', 1),
    app('demo-app-sum-2', 'ACTIVE', 'demo-camp-summit-roof', 'Roof inspection set', 'Elena Ruiz', 6),
    app('demo-app-sum-3', 'ACTIVE', 'demo-camp-summit-hvac', 'HVAC appointment wave', 'Marcus Chen', 9),
  ],
  team: [
    member('demo-user-sum-elena', 'Elena Ruiz', [{ id: 'demo-camp-summit-roof', title: 'Roof inspection set', status: 'ACTIVE' }], 44, 0),
    member('demo-user-sum-marcus', 'Marcus Chen', [
      { id: 'demo-camp-summit-hvac', title: 'HVAC appointment wave', status: 'ACTIVE' },
      { id: 'demo-camp-summit-roof', title: 'Roof inspection set', status: 'ACTIVE' },
    ], 36, 0),
  ],
  payouts: [
    pay('demo-pay-sum-1', 'PAID', 8500, 'demo-camp-summit-roof', 'Roof inspection set', 'Elena Ruiz', 'demo-user-sum-elena', 3),
    pay('demo-pay-sum-2', 'APPROVED', 7500, 'demo-camp-summit-hvac', 'HVAC appointment wave', 'Marcus Chen', 'demo-user-sum-marcus', 1),
    pay('demo-pay-sum-3', 'PENDING', 8500, 'demo-camp-summit-roof', 'Roof inspection set', 'Elena Ruiz', 'demo-user-sum-elena', 0),
  ],
  pipelineJobs: [
    job('demo-job-sum-1', 'demo-brand-summitshield', 'demo-camp-summit-roof', 'Roof inspection set', 'residential homes hail damage', 'Denver, CO', 'completed', 42, 34, 2),
    job('demo-job-sum-2', 'demo-brand-summitshield', 'demo-camp-summit-hvac', 'HVAC appointment wave', 'homes aging HVAC systems', 'Phoenix, AZ', 'running', 12, 5, 0),
  ],
  kpis: { openCampaigns: 2, pendingApplications: 1, leads: 45, callsToday: 22, escrowBalanceCents: 180000, escrowLabel: '$1,800.00', leadCreditsUsed: 12, leadCreditsAvailable: 100 },
};

const FIXTURES: Record<string, BrandFixture> = {
  'demo-meridianops': MERIDIAN,
  'demo-harborline': HARBOR,
  'demo-summitshield': SUMMIT,
};

type EconSpec = {
  budgetCents: number;
  spentCents: number;
  dialReady: number;
  goalsPerWeek: number;
  dials: number[];
  leads: number[];
  goals: number[];
  spend: number[];
  primaryCampaignId: string;
  activeSdrs: number;
  pendingApplications: number;
  openCampaigns: number;
};

const ECON: Record<string, EconSpec> = {
  'demo-meridianops': {
    budgetCents: 400000, spentCents: 95000, dialReady: 32, goalsPerWeek: 4,
    dials: [11, 16, 14, 22, 18, 15, 18], leads: [2, 3, 2, 4, 2, 3, 2], goals: [0, 1, 0, 1, 1, 0, 1],
    spend: [0, 25000, 0, 25000, 15000, 0, 30000], primaryCampaignId: 'demo-camp-meridian-ql',
    activeSdrs: 3, pendingApplications: 2, openCampaigns: 2,
  },
  'demo-harborline': {
    budgetCents: 240000, spentCents: 62000, dialReady: 18, goalsPerWeek: 3,
    dials: [9, 14, 11, 18, 15, 12, 14], leads: [1, 2, 1, 3, 1, 2, 1], goals: [0, 1, 0, 1, 0, 0, 1],
    spend: [0, 17500, 0, 17500, 0, 0, 17500], primaryCampaignId: 'demo-camp-harbor-life',
    activeSdrs: 3, pendingApplications: 2, openCampaigns: 1,
  },
  'demo-summitshield': {
    budgetCents: 180000, spentCents: 45000, dialReady: 42, goalsPerWeek: 2,
    dials: [14, 18, 16, 24, 20, 17, 22], leads: [3, 4, 2, 5, 3, 4, 3], goals: [0, 1, 0, 0, 1, 0, 0],
    spend: [0, 8500, 0, 0, 8500, 0, 7500], primaryCampaignId: 'demo-camp-summit-roof',
    activeSdrs: 2, pendingApplications: 1, openCampaigns: 2,
  },
};

export function getFixtureEconomics(brandSlug: string): BrandEconomics {
  const slug = resolveDemoBrandKey(brandSlug);
  const spec = ECON[slug] ?? ECON['demo-meridianops'];
  const series = [6, 5, 4, 3, 2, 1, 0].map((back, i) => {
    const key = utcDayKey(back);
    return {
      key,
      label: weekdayLabelFromDayKey(key),
      leads: spec.leads[i],
      goals: spec.goals[i],
      dials: spec.dials[i],
      spendCents: spec.spend[i],
    };
  });
  return buildBrandEconomics({
    brandKey: slug,
    periodDays: 7,
    leadsCreatedInPeriod: spec.leads.reduce((a, b) => a + b, 0),
    goalsInPeriod: spec.goals.reduce((a, b) => a + b, 0) || spec.goalsPerWeek,
    spendInPeriodCents: spec.spend.reduce((a, b) => a + b, 0),
    dialReadyLeads: spec.dialReady,
    callsInPeriod: spec.dials.reduce((a, b) => a + b, 0),
    activeSdrs: spec.activeSdrs,
    pendingApplications: spec.pendingApplications,
    openCampaigns: spec.openCampaigns,
    budgetCents: spec.budgetCents,
    spentCents: spec.spentCents,
    primaryCampaignId: spec.primaryCampaignId,
    series,
    vitals: {
      connections: Math.round(spec.dials.reduce((a, b) => a + b, 0) * 0.38),
      leadCreditsUsed: Math.round(spec.dialReady * 1.4),
      leadCreditsAllotment: 1000,
      auditPassed: Math.max(1, Math.round((spec.goals.reduce((a, b) => a + b, 0) || spec.goalsPerWeek) * 0.85)),
      auditTotal: Math.max(1, (spec.goals.reduce((a, b) => a + b, 0) || spec.goalsPerWeek) + 1),
      enrichedLeads: Math.max(spec.dialReady + 12, spec.leads.reduce((a, b) => a + b, 0) + 20),
    },
  });
}

type CallsCtx = {
  campId: string;
  campTitle: string;
  companies: [string, string, string, string];
  contacts: [string, string, string];
  sdrs: [{ id: string; name: string }, { id: string; name: string }];
  phones: [string, string, string];
};

const CALLS: Record<string, CallsCtx> = {
  'demo-meridianops': {
    campId: 'demo-camp-meridian-ql',
    campTitle: 'RevOps qualified lead wave',
    companies: ['Northwind Analytics', 'Brightline CRM Labs', 'Quorum Forecast', 'Relayboard Inc'],
    contacts: ['Priya Shah', 'Marcus Chen', 'Elena Ruiz'],
    sdrs: [
      { id: 'demo-user-mer-dev', name: 'Dev Patel' },
      { id: 'demo-user-jordan', name: 'Jordan Lee' },
    ],
    phones: ['+1 (415) 555-0142', '+1 (512) 555-0198', '+1 (206) 555-0133'],
  },
  'demo-harborline': {
    campId: 'demo-camp-harbor-life',
    campTitle: 'Term / life agency wave',
    companies: ['Lakeview Benefits Group', 'Prairie Shield Agency', 'Beacon Family Protection', 'Redwood Life Solutions'],
    contacts: ['James Okonkwo', 'Rachel Kim', 'Amy Delgado'],
    sdrs: [
      { id: 'demo-user-har-sam', name: 'Sam Rivera' },
      { id: 'demo-user-jordan', name: 'Jordan Lee' },
    ],
    phones: ['+1 (512) 555-0164', '+1 (214) 555-0177', '+1 (813) 555-0188'],
  },
  'demo-summitshield': {
    campId: 'demo-camp-summit-roof',
    campTitle: 'Roof inspection set',
    companies: ['Oakridge Residence', 'Cedar Creek Home', 'Riverbend Estate', 'Hillcrest Family Home'],
    contacts: ['Tom Bradley', 'Chris Nguyen', 'Jordan Lee'],
    sdrs: [
      { id: 'demo-user-sum-elena', name: 'Elena Ruiz' },
      { id: 'demo-user-sum-marcus', name: 'Marcus Chen' },
    ],
    phones: ['+1 (303) 555-0110', '+1 (480) 555-0144', '+1 (720) 555-0155'],
  },
};

export function getFixtureCallsBoard(
  brandSlug: string,
  brandName: string
): DemoCallsBoard & { brand: { id: string; slug: string; name: string } } {
  const slug = resolveDemoBrandKey(brandSlug);
  const ctx = CALLS[slug] ?? CALLS['demo-meridianops'];
  const [sdrA, sdrB] = ctx.sdrs;
  const p = `demo-lead-${slug}`;
  return {
    brand: { id: `demo-brand-${slug.replace(/^demo-/, '')}`, slug, name: brandName },
    polledAt: new Date().toISOString(),
    upcoming: [
      {
        id: `demo-up-${slug}-1`, kind: 'booking', title: `Intro · ${ctx.companies[0]}`,
        startsAt: hoursFromNow(2.5), endsAt: hoursFromNow(3), meetLink: null, htmlLink: null,
        campaignId: ctx.campId, campaignTitle: ctx.campTitle, sdrName: sdrA.name, sdrId: sdrA.id,
        companyName: ctx.companies[0], prospectId: `${p}-1`,
      },
      {
        id: `demo-up-${slug}-2`, kind: 'callback', title: `Callback · ${ctx.companies[1]}`,
        startsAt: hoursFromNow(5), endsAt: null, meetLink: null, htmlLink: null,
        campaignId: ctx.campId, campaignTitle: ctx.campTitle, sdrName: sdrB.name, sdrId: sdrB.id,
        companyName: ctx.companies[1], prospectId: `${p}-2`,
      },
    ],
    active: [{
      id: `demo-active-${slug}-1`, status: 'in-progress', direction: 'outbound', outcome: null,
      duration: 142, createdAt: hoursFromNow(-0.08), updatedAt: hoursFromNow(-0.01),
      campaignId: ctx.campId, campaignTitle: ctx.campTitle, sdrName: sdrA.name, sdrId: sdrA.id,
      companyName: ctx.companies[2], contactName: ctx.contacts[0], prospectId: `${p}-3`,
      toNumber: ctx.phones[0], fromNumber: '+1 (415) 555-0100',
    }],
    past: [
      {
        id: `demo-past-${slug}-1`, status: 'completed', direction: 'outbound', outcome: 'meeting_booked',
        duration: 386, createdAt: hoursFromNow(-3), updatedAt: hoursFromNow(-3),
        campaignId: ctx.campId, campaignTitle: ctx.campTitle, sdrName: sdrA.name, sdrId: sdrA.id,
        companyName: ctx.companies[3], contactName: ctx.contacts[1], prospectId: `${p}-4`,
        toNumber: ctx.phones[1], fromNumber: '+1 (415) 555-0100',
      },
      {
        id: `demo-past-${slug}-2`, status: 'completed', direction: 'outbound', outcome: 'no_answer',
        duration: 28, createdAt: hoursFromNow(-5), updatedAt: hoursFromNow(-5),
        campaignId: ctx.campId, campaignTitle: ctx.campTitle, sdrName: sdrB.name, sdrId: sdrB.id,
        companyName: ctx.companies[0], contactName: ctx.contacts[2], prospectId: `${p}-5`,
        toNumber: ctx.phones[2], fromNumber: '+1 (415) 555-0100',
      },
    ],
  };
}

export function getDemoBrandFixture(brandKey: string): {
  brand: (typeof CANONICAL_DEMO_BRANDS)[0];
  campaigns: DemoCampaign[];
  leads: ReturnType<typeof buildDemoLeadsForBrand>;
  applications: DemoApplication[];
  team: DemoTeamMember[];
  payouts: DemoPayout[];
  pipelineJobs: DemoPipelineJob[];
  kpis: DemoKpis;
  economics: BrandEconomics;
  callsBoard: ReturnType<typeof getFixtureCallsBoard>;
} {
  const slug = resolveDemoBrandKey(brandKey);
  const brand = CANONICAL_DEMO_BRANDS.find((b) => b.slug === slug) ?? CANONICAL_DEMO_BRANDS[0];
  const fixture = FIXTURES[brand.slug] ?? MERIDIAN;
  return {
    brand,
    campaigns: fixture.campaigns,
    leads: buildDemoLeadsForBrand(brand.slug, 45),
    applications: fixture.applications,
    team: fixture.team,
    payouts: fixture.payouts,
    pipelineJobs: fixture.pipelineJobs,
    kpis: fixture.kpis,
    economics: getFixtureEconomics(brand.slug),
    callsBoard: getFixtureCallsBoard(brand.slug, brand.name),
  };
}

export function getAllDemoCampaigns(): DemoCampaign[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => FIXTURES[b.slug]?.campaigns ?? []);
}
export function getAllDemoApplications(): DemoApplication[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => FIXTURES[b.slug]?.applications ?? []);
}
export function getAllDemoTeam(): DemoTeamMember[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => FIXTURES[b.slug]?.team ?? []);
}
export function getAllDemoPayouts(): DemoPayout[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => FIXTURES[b.slug]?.payouts ?? []);
}
export function getAllDemoPipelineJobs(): DemoPipelineJob[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => FIXTURES[b.slug]?.pipelineJobs ?? []);
}
