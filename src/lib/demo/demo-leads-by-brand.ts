/**
 * Procedural demo leads per high-ticket vertical (desk Demo mode).
 */

import { serializeHooksPayload, type ProspectIntel } from '@/lib/prospect-intel';
import {
  CANONICAL_DEMO_BRANDS,
  resolveDemoBrandKey,
  type DemoVertical,
} from '@/lib/demo/canonical-brands';

export type DemoLeadRow = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  ownerName: string | null;
  ownerTitle?: string | null;
  ownerEmail?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  campaignId?: string | null;
  brandSlug?: string;
  reviewRating?: number | null;
  reviewCount?: number | null;
  enrichmentStatus?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  outreachReady?: boolean | null;
  source?: string | null;
  hooksJSON?: string | null;
  status?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastDisposition?: string | null;
  attemptCount?: number;
  callCount?: number;
};

const CITIES: [string, string][] = [
  ['Austin', 'TX'],
  ['Dallas', 'TX'],
  ['Denver', 'CO'],
  ['Phoenix', 'AZ'],
  ['Nashville', 'TN'],
  ['Charlotte', 'NC'],
  ['Tampa', 'FL'],
  ['Chicago', 'IL'],
  ['Atlanta', 'GA'],
  ['Seattle', 'WA'],
];

const OWNERS = [
  'Jordan Lee',
  'Sam Rivera',
  'Priya Shah',
  'Marcus Chen',
  'Elena Ruiz',
  'James Okonkwo',
  'Rachel Kim',
  'Amy Delgado',
  'Tom Bradley',
  'Chris Nguyen',
];

type VerticalPool = {
  vertical: DemoVertical;
  industry: string;
  companies: string[];
  titles: string[];
  campaignIds: string[];
  hooks: string[][];
};

const POOLS: VerticalPool[] = [
  {
    vertical: 'saas',
    industry: 'B2B SaaS',
    companies: [
      'Northwind Analytics',
      'Cascade Pipeline Co',
      'Brightline CRM Labs',
      'Quorum Forecast',
      'Relayboard Inc',
      'Stackframe Systems',
      'Orbit Quota',
      'Pinnacle RevTools',
      'Ledgerline SaaS',
      'Vector Stage Ops',
      'Copperline Revenue',
      'Nimbus Deal Desk',
      'Aperture Quota',
      'Keystone Pipeline',
      'Driftwood Metrics',
    ],
    titles: ['VP Sales', 'CRO', 'Head of RevOps', 'Sales Ops Manager'],
    campaignIds: ['demo-camp-meridian-ql', 'demo-camp-meridian-ent'],
    hooks: [
      ['Forecast variance spiked last two quarters', 'CRM stage definitions differ by region'],
      ['SDR→AE handoff leakage in QBRs', 'Built internal dashboards leadership disputes'],
      ['New CRO mandate: single pipeline truth', 'Open to overlay tools, not rip-and-replace'],
      ['Missed board forecast by 12%', 'Looking at Clari / Gong stack add-ons'],
      ['Stale deals bloating commit', 'RevOps hire still ramping on Salesforce hygiene'],
    ],
  },
  {
    vertical: 'insurance',
    industry: 'Insurance',
    companies: [
      'Lakeview Benefits Group',
      'Summit Family Insurance',
      'Prairie Shield Agency',
      'Beacon Family Protection',
      'Redwood Life Solutions',
      'Horizon Annuity Desk',
      'Atlas Benefits Collective',
      'Crestview Life Office',
      'Oakmont Estate Advisors',
      'Blue Ridge Life Co',
      'Pacific Trust Brokers',
      'Ironwood Insurance Group',
      'Lumen Financial Services',
      'Pioneer Mutual Brokers',
      'Evergreen Legacy Partners',
    ],
    titles: ['Agency Principal', 'Managing Partner', 'Benefits Director', 'Owner'],
    campaignIds: ['demo-camp-harbor-life', 'demo-camp-harbor-ma'],
    hooks: [
      ['Medicare Advantage AEP coming up', 'Wants more commercial cross-sell'],
      ['Life + commercial book under pressure', 'Gatekeeper screens unknown numbers'],
      ['Group renewal up 14%', 'Looking for dial-ready appointment setters'],
      ['Key-person coverage gap on payroll', 'Spouse joins benefit decisions'],
      ['Busy season — short appointment windows', 'Already has a broker relationship'],
    ],
  },
  {
    vertical: 'home_services',
    industry: 'Home services',
    companies: [
      'Oakridge Residence',
      'Cedar Creek Home',
      'Maple Hollow Property',
      'Riverbend Estate',
      'Sunset Ridge House',
      'Hillcrest Family Home',
      'Willow Park Residence',
      'Stonebridge Property',
      'Cypress Lane Home',
      'Fairview Manor',
      'Lakeshore Residence',
      'Pinecrest House',
      'Ashford Property',
      'Brookside Home',
      'Highland Grove Estate',
    ],
    titles: ['Homeowner', 'Property decision-maker', 'Co-owner'],
    campaignIds: ['demo-camp-summit-roof', 'demo-camp-summit-hvac'],
    hooks: [
      ['Roof 14 years old; hail season nearby', 'Spouse wants to be on quote call'],
      ['HVAC repair bills stacked this summer', 'Financing preferred over cash'],
      ['Summer electric bill spiked — solar curious', 'Wants inspection first, not hard sell'],
      ['Storm adjuster visit still open', 'Got three quotes already'],
      ['System 12+ years; peak season risk', 'Local contractor trust matters'],
    ],
  },
];

function demoHooks(hooks: string[], intel: ProspectIntel): string {
  return serializeHooksPayload(hooks, intel);
}

function buildPoolLeads(
  pool: VerticalPool,
  brandSlug: string,
  count: number,
  idOffset: number
): DemoLeadRow[] {
  const out: DemoLeadRow[] = [];
  for (let i = 0; i < count; i++) {
    const n = idOffset + i + 1;
    const company = pool.companies[i % pool.companies.length];
    const [city, state] = CITIES[i % CITIES.length];
    const owner = OWNERS[i % OWNERS.length];
    const title = pool.titles[i % pool.titles.length];
    const campaignId = pool.campaignIds[i % pool.campaignIds.length];
    const hooks = pool.hooks[i % pool.hooks.length];
    const ready = i % 5 !== 4;
    const daysAgo = i % 14;
    const created = new Date(Date.now() - daysAgo * 86400_000).toISOString();
    const intel: ProspectIntel = {
      score: 62 + (i % 28),
      health: 55 + (i % 35),
      signals: hooks,
    };
    out.push({
      id: `demo-lead-${brandSlug}-${n}`,
      companyName: company,
      phone: `+1555${String(1000000 + n).slice(0, 7)}`,
      website: `https://example.com/${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      ownerName: owner,
      ownerTitle: title,
      ownerEmail: `${owner.split(' ')[0].toLowerCase()}@example.com`,
      city,
      state,
      industry: pool.industry,
      campaignId,
      brandSlug,
      reviewRating: 3.6 + ((i % 12) / 10),
      reviewCount: 8 + (i % 40) * 3,
      enrichmentStatus: ready ? 'done' : i % 3 === 0 ? 'pending' : 'none',
      scrapeStatus: 'completed',
      webScanStatus: ready ? 'completed' : 'in_progress',
      qualifyPhase1: true,
      qualifyPhase2: ready || i % 2 === 0,
      qualifyPhase3: ready,
      outreachReady: ready,
      source: i % 11 === 0 ? 'manual' : i % 7 === 0 ? 'import' : 'maps',
      hooksJSON: demoHooks(hooks, intel),
      status: ready ? (i % 7 === 0 ? 'dialing' : 'new') : 'warming',
      notes: `Demo · ${pool.industry}`,
      createdAt: created,
      updatedAt: created,
      lastDisposition: i % 9 === 0 ? 'no_answer' : i % 11 === 0 ? 'callback' : null,
      attemptCount: i % 4,
      callCount: i % 5,
    });
  }
  return out;
}

const CACHE = new Map<string, DemoLeadRow[]>();

/** ~45 dial-ready-heavy leads per brand. */
export function buildDemoLeadsForBrand(brandKey: string, count = 45): DemoLeadRow[] {
  const slug = resolveDemoBrandKey(brandKey);
  const cached = CACHE.get(`${slug}:${count}`);
  if (cached) return cached;

  const brand = CANONICAL_DEMO_BRANDS.find((b) => b.slug === slug)!;
  const pool = POOLS.find((p) => p.vertical === brand.vertical)!;
  const offset =
    brand.vertical === 'saas' ? 0 : brand.vertical === 'insurance' ? 100 : 200;
  const leads = buildPoolLeads(pool, slug, count, offset);
  CACHE.set(`${slug}:${count}`, leads);
  return leads;
}

export function buildAllDemoLeads(perBrand = 45): DemoLeadRow[] {
  return CANONICAL_DEMO_BRANDS.flatMap((b) => buildDemoLeadsForBrand(b.slug, perBrand));
}

/** @deprecated Use buildDemoLeadsForBrand / buildAllDemoLeads */
export function buildAegisDemoLeads(count = 137): DemoLeadRow[] {
  return buildDemoLeadsForBrand('demo-harborline', Math.min(count, 60));
}
