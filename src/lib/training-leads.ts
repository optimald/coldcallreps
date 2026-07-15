/**
 * Training leads — practice contacts (not paid campaign dials).
 *
 * Marked with Prospect.source = 'training'. Attached to demo brands
 * (slug demo-*) so reps can practice cold calls without a gig.
 *
 * Seed via: npm run seed:demo-brands
 */

import { prisma } from './prisma';
import {
  serializeHooksPayload,
  synthesizeTrainingIntel,
} from '@/lib/prospect-intel';

export const TRAINING_SOURCE = 'training' as const;

/** Max practice leads shown in the SDR Call Queue (anti cherry-pick). */
export const PRACTICE_QUEUE_LIMIT = 8;

/** Synthetic owner for platform-seeded training prospects (not a Clerk login). */
export const PLATFORM_SEED_USER_ID = 'platform_training_seed';

export function isSyntheticUserId(id: string | null | undefined): boolean {
  return id === PLATFORM_SEED_USER_ID;
}

export function isSyntheticUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e.endsWith('.local') || e === 'seed@coldcallreps.local';
}

/** Exclude seed / placeholder rows from ops directories and KPIs. */
export function realUserWhere() {
  return {
    NOT: {
      OR: [
        { id: PLATFORM_SEED_USER_ID },
        { email: 'seed@coldcallreps.local' },
      ],
    },
  };
}

/** Exclude demo-* brands from ops directories and KPIs. */
export function realBrandWhere() {
  return {
    NOT: { slug: { startsWith: 'demo-' } },
  };
}

export type TrainingLeadSeed = {
  /** Matches demo brand slug from seed-demo-brands */
  brandSlug: string;
  companyName: string;
  ownerName: string;
  ownerTitle: string;
  city: string;
  state: string;
  industry: string;
  /** Fictional 555 numbers — safe for demos; may not complete on Twilio. */
  phone: string;
  website: string;
  hooks: string[];
  notes: string;
};

export const TRAINING_LEAD_SEEDS: TrainingLeadSeed[] = [
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Northwind Analytics',
    ownerName: 'Priya Shah',
    ownerTitle: 'VP Sales',
    city: 'Austin',
    state: 'TX',
    industry: 'B2B SaaS',
    phone: '+1555010101',
    website: 'https://example.com/northwind-analytics',
    hooks: [
      'Forecast variance spiked last two quarters',
      'RevOps hire still ramping on Salesforce hygiene',
      'SDR→AE handoff leakage called out in QBR notes',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Cascade Pipeline Co',
    ownerName: 'Marcus Chen',
    ownerTitle: 'Head of RevOps',
    city: 'Denver',
    state: 'CO',
    industry: 'B2B SaaS',
    phone: '+1555010102',
    website: 'https://example.com/cascade-pipeline',
    hooks: [
      'Built internal dashboards that leadership still disputes',
      'CRM stage definitions differ by region',
      'Looking at Clari / Gong stack add-ons',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Brightline CRM Labs',
    ownerName: 'Elena Ruiz',
    ownerTitle: 'CRO',
    city: 'Chicago',
    state: 'IL',
    industry: 'B2B SaaS',
    phone: '+1555010103',
    website: 'https://example.com/brightline-crm',
    hooks: [
      'Missed board forecast by 12% last quarter',
      'New CRO mandate: single source of pipeline truth',
      'Open to overlay tools, not rip-and-replace',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Helix Revenue Systems',
    ownerName: 'Devon Blake',
    ownerTitle: 'Sales Ops Manager',
    city: 'Seattle',
    state: 'WA',
    industry: 'B2B SaaS',
    phone: '+1555010104',
    website: 'https://example.com/helix-revenue',
    hooks: [
      'Stage aging reports ignored by AEs',
      'New territory model broke forecast rollups',
      'Evaluating MeridianOps vs building more Tableau',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Orbit Quota Inc',
    ownerName: 'Samira Nasser',
    ownerTitle: 'VP Sales',
    city: 'Boston',
    state: 'MA',
    industry: 'B2B SaaS',
    phone: '+1555010105',
    website: 'https://example.com/orbit-quota',
    hooks: [
      'Board asked for weekly forecast confidence score',
      'SDR team doubled; AE accept rates dropped',
      'Security review already cleared for CRM overlays',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-meridianops',
    companyName: 'Ledgerline SaaS',
    ownerName: 'Chris Okonkwo',
    ownerTitle: 'CRO',
    city: 'Atlanta',
    state: 'GA',
    industry: 'B2B SaaS',
    phone: '+1555010106',
    website: 'https://example.com/ledgerline-saas',
    hooks: [
      'Series C board wants pipeline hygiene before next raise',
      'RevOps shared across Sales + CS — handoff gaps',
      'Tried Gong forecast add-on; still manual cleanup',
    ],
    notes: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Lakeview Benefits Group',
    ownerName: 'James Okonkwo',
    ownerTitle: 'Agency Principal',
    city: 'Tampa',
    state: 'FL',
    industry: 'Insurance',
    phone: '+1555010201',
    website: 'https://example.com/lakeview-benefits',
    hooks: [
      'Medicare Advantage AEP coming up',
      'Wants more commercial P&C cross-sell',
      'Busy season — short window for appointments',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Summit Family Insurance',
    ownerName: 'Rachel Kim',
    ownerTitle: 'Managing Partner',
    city: 'Phoenix',
    state: 'AZ',
    industry: 'Insurance',
    phone: '+1555010202',
    website: 'https://example.com/summit-family-ins',
    hooks: [
      'Life + commercial book under pressure',
      'Looking for dial-ready appointment setters',
      'Gatekeeper screens unknown numbers hard',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Coastal Employer Benefits',
    ownerName: 'Miguel Santos',
    ownerTitle: 'Benefits Director',
    city: 'Miami',
    state: 'FL',
    industry: 'Insurance',
    phone: '+1555010203',
    website: 'https://example.com/coastal-employer-benefits',
    hooks: [
      'Group renewal up 18% YoY',
      'Owner wants side-by-side before anniversary',
      'Spouse/CFO must join licensed review',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Prairie Key Person Cover',
    ownerName: 'Helen Vargas',
    ownerTitle: 'Business Owner',
    city: 'Dallas',
    state: 'TX',
    industry: 'Insurance',
    phone: '+1555010204',
    website: 'https://example.com/prairie-key-person',
    hooks: [
      'Buy-sell agreement outdated after partner buyout',
      'Payroll risk if key person out 90 days',
      'Prefers educate-first, no product dump on cold call',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Sunbelt Medicare Advisors',
    ownerName: 'Patricia Nguyen',
    ownerTitle: 'Household decision-maker',
    city: 'Orlando',
    state: 'FL',
    industry: 'Insurance',
    phone: '+1555010205',
    website: 'https://example.com/sunbelt-medicare',
    hooks: [
      'Turning 65 in 4 months — comparing Advantage options',
      'Primary doctor network is non-negotiable',
      'Husband wants to be on the licensed review',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-harborline',
    companyName: 'Ridgeline Commercial Risk',
    ownerName: 'Omar Haddad',
    ownerTitle: 'Agency Owner',
    city: 'Charlotte',
    state: 'NC',
    industry: 'Insurance',
    phone: '+1555010206',
    website: 'https://example.com/ridgeline-commercial',
    hooks: [
      'Commercial package renewals clustering next quarter',
      'Needs appointment setters who sound licensed',
      'Do-not-call list hygiene matters',
    ],
    notes: 'Training lead — Harborline insurance practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Oakridge Residence',
    ownerName: 'Tom Bradley',
    ownerTitle: 'Homeowner',
    city: 'Dallas',
    state: 'TX',
    industry: 'Home services',
    phone: '+1555010301',
    website: 'https://example.com/oakridge-residence',
    hooks: [
      'Roof 14 years old; hail season nearby',
      'HVAC repair bills stacked this summer',
      'Spouse wants to be on any quote call',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Cedar Creek Home',
    ownerName: 'Amy Delgado',
    ownerTitle: 'Homeowner',
    city: 'Houston',
    state: 'TX',
    industry: 'Home services',
    phone: '+1555010302',
    website: 'https://example.com/cedar-creek-home',
    hooks: [
      'Summer electric bill spiked — solar curious',
      'Wants inspection first, not a hard sell',
      'Financing preferred over cash',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Maple Street Property',
    ownerName: 'Chris Nguyen',
    ownerTitle: 'Homeowner',
    city: 'Atlanta',
    state: 'GA',
    industry: 'Home services',
    phone: '+1555010303',
    website: 'https://example.com/maple-street-property',
    hooks: [
      'Storm claim adjuster visit still open',
      'Comparing 2–3 local contractors',
      'Needs both decision-makers for numbers',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Willow Bend Estate',
    ownerName: 'Dana Foster',
    ownerTitle: 'Homeowner',
    city: 'Denver',
    state: 'CO',
    industry: 'Home services',
    phone: '+1555010304',
    website: 'https://example.com/willow-bend-estate',
    hooks: [
      'Hail damage visible on south slope',
      'Insurance adjuster scheduled next week',
      'Wants free inspection before claim close',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Redrock HVAC Residence',
    ownerName: 'Luis Ortega',
    ownerTitle: 'Homeowner',
    city: 'Phoenix',
    state: 'AZ',
    industry: 'Home services',
    phone: '+1555010305',
    website: 'https://example.com/redrock-hvac',
    hooks: [
      'System is 15 years old; two repairs this year',
      'Summer peak — urgency for load calc',
      'Financing quote needed with spouse present',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
  {
    brandSlug: 'demo-summitshield',
    companyName: 'Bayou Solar Interest',
    ownerName: 'Keisha Brooks',
    ownerTitle: 'Homeowner',
    city: 'New Orleans',
    state: 'LA',
    industry: 'Home services',
    phone: '+1555010306',
    website: 'https://example.com/bayou-solar',
    hooks: [
      'Utility rate hike — comparing solar payback',
      'Does not want cash outlay; wants monthly math',
      'Site survey only if both owners available',
    ],
    notes: 'Training lead — SummitShield home services practice. Not a real prospect.',
  },
];

const BRAND_PROFILES: Record<
  string,
  {
    industry: string;
    titles: string[];
    cities: [string, string][];
    companyParts: [string[], string[]];
    hooks: string[][];
    note: string;
    phoneBase: number;
  }
> = {
  'demo-meridianops': {
    industry: 'B2B SaaS',
    titles: ['VP Sales', 'CRO', 'Head of RevOps', 'Sales Ops Manager', 'Director of Sales'],
    cities: [
      ['Austin', 'TX'],
      ['Denver', 'CO'],
      ['Chicago', 'IL'],
      ['Seattle', 'WA'],
      ['Boston', 'MA'],
      ['Atlanta', 'GA'],
      ['San Francisco', 'CA'],
      ['Raleigh', 'NC'],
      ['Minneapolis', 'MN'],
      ['Nashville', 'TN'],
    ],
    companyParts: [
      ['North', 'Bright', 'Helix', 'Orbit', 'Ledger', 'Quantum', 'Signal', 'Forge', 'Pulse', 'Nimbus'],
      ['Analytics', 'Pipeline', 'Revenue', 'Quota', 'Forecast', 'CRM', 'Growth', 'Ops', 'Metrics', 'Funnel'],
    ],
    hooks: [
      ['Forecast variance spiked last two quarters', 'RevOps hire still ramping', 'SDR→AE handoff leakage'],
      ['Board wants weekly forecast confidence', 'CRM stage definitions differ by region', 'Evaluating overlay tools'],
      ['Series C diligence on pipeline hygiene', 'AE accept rates dropped after SDR hire', 'Manual forecast cleanup every Friday'],
    ],
    note: 'Training lead — MeridianOps ICP practice. Not a real prospect.',
    phoneBase: 10101,
  },
  'demo-harborline': {
    industry: 'Insurance',
    titles: ['Agency Principal', 'Managing Partner', 'Benefits Director', 'Owner', 'Producer'],
    cities: [
      ['Tampa', 'FL'],
      ['Phoenix', 'AZ'],
      ['Miami', 'FL'],
      ['Dallas', 'TX'],
      ['Charlotte', 'NC'],
      ['Columbus', 'OH'],
      ['Orlando', 'FL'],
      ['Houston', 'TX'],
      ['Jacksonville', 'FL'],
      ['Indianapolis', 'IN'],
    ],
    companyParts: [
      ['Lakeview', 'Summit', 'Coastal', 'Harbor', 'Pioneer', 'Cedar', 'Ridge', 'Valley', 'Metro', 'Patriot'],
      ['Benefits', 'Insurance', 'Agency', 'Coverage', 'Group', 'Brokerage', 'Protection', 'Assurance'],
    ],
    hooks: [
      ['Medicare Advantage AEP coming up', 'Wants commercial cross-sell', 'Short window for appointments'],
      ['Group renewal up YoY', 'Spouse/CFO must join licensed review', 'Gatekeeper screens unknown numbers'],
      ['Book pressure before anniversary', 'Looking for dial-ready setters', 'Prefers morning callbacks'],
    ],
    note: 'Training lead — Harborline insurance practice. Not a real prospect.',
    phoneBase: 10201,
  },
  'demo-summitshield': {
    industry: 'Home services',
    titles: ['Homeowner', 'Property Manager', 'Decision Maker', 'Co-owner'],
    cities: [
      ['Houston', 'TX'],
      ['Dallas', 'TX'],
      ['New Orleans', 'LA'],
      ['Oklahoma City', 'OK'],
      ['Birmingham', 'AL'],
      ['Memphis', 'TN'],
      ['Kansas City', 'MO'],
      ['Tulsa', 'OK'],
      ['Little Rock', 'AR'],
      ['Shreveport', 'LA'],
    ],
    companyParts: [
      ['Oak', 'Pine', 'Bayou', 'Prairie', 'Cypress', 'Magnolia', 'River', 'Stone', 'Willow', 'Maple'],
      ['Residence', 'Homestead', 'Property', 'Estates', 'House', 'Manor', 'Cottage', 'Lodge'],
    ],
    hooks: [
      ['Storm damage claim still open', 'Roof age past warranty', 'Both decision-makers for numbers'],
      ['Utility rate hike — comparing solar payback', 'Wants monthly math not cash outlay', 'Site survey if both owners free'],
      ['HVAC failing in peak season', 'Neighbor just booked inspection', 'Prefers evening appointment'],
    ],
    note: 'Training lead — SummitShield home services practice. Not a real prospect.',
    phoneBase: 10301,
  },
};

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Jamie', 'Reese',
  'Cameron', 'Drew', 'Harper', 'Parker', 'Skyler', 'Rowan', 'Sage', 'Blake', 'Finley', 'Emery',
  'Kai', 'Noah', 'Mia', 'Liam', 'Sofia', 'Elena', 'Marcus', 'Priya', 'Devon', 'Samira',
];
const LAST_NAMES = [
  'Nguyen', 'Patel', 'Garcia', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore',
  'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Lee', 'Walker',
  'Hall', 'Allen', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams',
];

/** Target size for the shared practice catalog — queue of 8 recycles through this pool. */
export const TARGET_TRAINING_LEADS = 100;

function slugifyCompany(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Expand handcrafted seeds to a ~100-lead realistic practice catalog. */
export function buildTrainingLeadCatalog(target = TARGET_TRAINING_LEADS): TrainingLeadSeed[] {
  const out: TrainingLeadSeed[] = [...TRAINING_LEAD_SEEDS];
  const seen = new Set(out.map((s) => s.companyName.toLowerCase()));
  const brandSlugs = Object.keys(BRAND_PROFILES);
  let n = 0;

  while (out.length < target && n < target * 4) {
    const brandSlug = brandSlugs[n % brandSlugs.length];
    const profile = BRAND_PROFILES[brandSlug];
    const [lefts, rights] = profile.companyParts;
    const left = lefts[Math.floor(n / brandSlugs.length) % lefts.length];
    const right = rights[(n * 3 + 1) % rights.length];
    const suffix = ['Co', 'Inc', 'Group', 'Labs', 'LLC', 'Partners'][n % 6];
    const companyName = `${left} ${right} ${suffix}`.replace(/\s+/g, ' ').trim();
    const key = companyName.toLowerCase();
    n += 1;
    if (seen.has(key)) continue;
    seen.add(key);

    const city = profile.cities[n % profile.cities.length];
    const first = FIRST_NAMES[n % FIRST_NAMES.length];
    const last = LAST_NAMES[(n * 7) % LAST_NAMES.length];
    const hooks = profile.hooks[n % profile.hooks.length];
    const phoneNum = profile.phoneBase + (out.length % 800);
    out.push({
      brandSlug,
      companyName,
      ownerName: `${first} ${last}`,
      ownerTitle: profile.titles[n % profile.titles.length],
      city: city[0],
      state: city[1],
      industry: profile.industry,
      phone: `+1555${String(phoneNum).padStart(7, '0')}`,
      website: `https://example.com/${slugifyCompany(companyName)}`,
      hooks: [...hooks],
      notes: profile.note,
    });
  }

  return out.slice(0, target);
}

/** Full practice catalog (handcrafted + generated). */
export const TRAINING_LEAD_CATALOG = buildTrainingLeadCatalog();

export async function ensurePlatformSeedUser() {
  // Placeholder FK owner for training prospects only — never a real ops login.
  return prisma.userProfile.upsert({
    where: { id: PLATFORM_SEED_USER_ID },
    create: {
      id: PLATFORM_SEED_USER_ID,
      email: 'seed@coldcallreps.local',
      displayName: 'Platform Training Seed',
      platformRole: 'REP',
      opsRole: null,
      referralCode: 'PLATFORMSEED',
      minutesRemaining: 0,
    },
    update: {
      displayName: 'Platform Training Seed',
      platformRole: 'REP',
      opsRole: null,
      email: 'seed@coldcallreps.local',
    },
  });
}

/**
 * Ensure platform practice leads exist for every SDR Call Queue.
 * Tops up to TARGET_TRAINING_LEADS so the recycled 8-slot queue never starves.
 */
export async function ensureTrainingLeadsAvailable() {
  const existing = await prisma.prospect.count({
    where: { source: TRAINING_SOURCE },
  });
  if (existing >= TARGET_TRAINING_LEADS) {
    return { seeded: false as const, existing };
  }

  const demoBrands = await prisma.brand.count({
    where: { slug: { startsWith: 'demo-' } },
  });
  if (demoBrands === 0) {
    const { seedDemoBrands } = await import('./seed-demo-brands');
    await seedDemoBrands();
  } else {
    await seedTrainingLeads();
  }

  const after = await prisma.prospect.count({
    where: { source: TRAINING_SOURCE },
  });
  return { seeded: true as const, existing: after };
}

/** Idempotent seed of training leads onto demo brands. */
export async function seedTrainingLeads() {
  const user = await ensurePlatformSeedUser();
  const brands = await prisma.brand.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(brands.map((b) => [b.slug, b.id]));
  const catalog = TRAINING_LEAD_CATALOG;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of catalog) {
    const brandId = bySlug.get(seed.brandSlug);
    if (!brandId) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.prospect.findFirst({
      where: {
        brandId,
        source: TRAINING_SOURCE,
        companyName: seed.companyName,
      },
      select: { id: true },
    });

    const data = {
      userId: user.id,
      brandId,
      campaignId: null as string | null,
      companyName: seed.companyName,
      ownerName: seed.ownerName,
      ownerTitle: seed.ownerTitle,
      city: seed.city,
      state: seed.state,
      industry: seed.industry,
      phone: seed.phone,
      website: seed.website,
      hooksJSON: serializeHooksPayload(
        seed.hooks,
        synthesizeTrainingIntel({
          companyName: seed.companyName,
          website: seed.website,
          phone: seed.phone,
        })
      ),
      notes: seed.notes,
      status: 'new',
      enrichmentStatus: 'done',
      scrapeStatus: 'completed',
      webScanStatus: 'completed',
      qualifyPhase1: true,
      qualifyPhase2: true,
      qualifyPhase3: true,
      outreachReady: true,
      reviewRating: 3.8 + ((seed.companyName.length % 12) / 10),
      reviewCount: 12 + (seed.companyName.length % 80),
      source: TRAINING_SOURCE,
    };

    if (existing) {
      await prisma.prospect.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.prospect.create({ data });
      created += 1;
    }
  }

  return { created, updated, skipped, total: catalog.length };
}

const trainingLeadSelect = {
  id: true,
  companyName: true,
  phone: true,
  website: true,
  ownerName: true,
  ownerTitle: true,
  city: true,
  state: true,
  industry: true,
  status: true,
  brandId: true,
  campaignId: true,
  enrichmentStatus: true,
  outreachReady: true,
  bookingUrlFound: true,
  reviewRating: true,
  reviewCount: true,
  hooksJSON: true,
  notes: true,
  source: true,
  brand: { select: { id: true, name: true, slug: true } },
} as const;

/** Platform + brand training leads visible for practice. */
export async function listTrainingLeads(opts?: {
  brandId?: string;
  take?: number;
  skip?: number;
  /** Brand managers: platform demos (ownerId null) + their brands only. */
  ownerUserId?: string;
  /**
   * Cap + stable per-user window for the shared practice queue.
   * Prevents SDRs from paging/refreshing through the full catalog.
   */
  practiceQueueUserId?: string;
  /** Extra window rotation (multiples of PRACTICE_QUEUE_LIMIT) through the catalog. */
  practiceQueueRotate?: number;
}) {
  const where = {
    source: TRAINING_SOURCE,
    ...(opts?.brandId ? { brandId: opts.brandId } : {}),
    ...(opts?.ownerUserId && !opts?.brandId
      ? {
          OR: [
            { brand: { ownerId: null } },
            { brand: { ownerId: opts.ownerUserId } },
          ],
        }
      : {}),
  };

  const total = await prisma.prospect.count({ where });

  let take = Math.min(opts?.take ?? 80, 200);
  let skip = Math.max(opts?.skip ?? 0, 0);
  let hasMore = false;

  if (opts?.practiceQueueUserId && !opts.brandId) {
    take = PRACTICE_QUEUE_LIMIT;
    const base = practiceQueueOffset(opts.practiceQueueUserId, total, PRACTICE_QUEUE_LIMIT);
    const rotate = Math.max(0, opts.practiceQueueRotate || 0);
    const maxStart = Math.max(0, total - PRACTICE_QUEUE_LIMIT);
    skip =
      total <= PRACTICE_QUEUE_LIMIT
        ? 0
        : (base + rotate * PRACTICE_QUEUE_LIMIT) % (maxStart + 1);
    hasMore = false;
  }

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: [{ brandId: 'asc' }, { companyName: 'asc' }],
    take,
    skip,
    select: trainingLeadSelect,
  });

  if (!opts?.practiceQueueUserId || opts.brandId) {
    hasMore = skip + prospects.length < total;
  }

  return {
    prospects,
    total: opts?.practiceQueueUserId && !opts.brandId
      ? Math.min(total, PRACTICE_QUEUE_LIMIT)
      : total,
    catalogTotal: total,
    hasMore,
  };
}

/** Stable offset so the same SDR starts on a consistent 8-lead window. */
function practiceQueueOffset(userId: string, total: number, size: number): number {
  if (total <= size) return 0;
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % (total - size + 1);
}

export type TrainingLeadRow = Awaited<ReturnType<typeof listTrainingLeads>>['prospects'][number];
