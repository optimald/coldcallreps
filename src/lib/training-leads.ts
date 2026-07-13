/**
 * Training leads — practice contacts (not paid campaign dials).
 *
 * Marked with Prospect.source = 'training'. Attached to demo brands
 * (slug demo-*) so reps can practice cold calls without a gig.
 *
 * Seed via: npm run seed:demo-brands
 */

import { prisma } from './prisma';

export const TRAINING_SOURCE = 'training' as const;

/** Synthetic owner for platform-seeded training prospects (not a Clerk user). */
export const PLATFORM_SEED_USER_ID = 'platform_training_seed';

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
];

export async function ensurePlatformSeedUser() {
  return prisma.userProfile.upsert({
    where: { id: PLATFORM_SEED_USER_ID },
    create: {
      id: PLATFORM_SEED_USER_ID,
      email: 'seed@coldcallreps.local',
      displayName: 'Platform Training Seed',
      platformRole: 'SUPERADMIN',
      referralCode: 'PLATFORMSEED',
      minutesRemaining: 0,
    },
    update: {
      displayName: 'Platform Training Seed',
    },
  });
}

/** Idempotent seed of training leads onto demo brands. */
export async function seedTrainingLeads() {
  const user = await ensurePlatformSeedUser();
  const brands = await prisma.brand.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(brands.map((b) => [b.slug, b.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of TRAINING_LEAD_SEEDS) {
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
      hooksJSON: JSON.stringify(seed.hooks),
      notes: seed.notes,
      status: 'new',
      enrichmentStatus: 'done',
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

  return { created, updated, skipped };
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
}) {
  const take = Math.min(opts?.take ?? 80, 200);
  const skip = Math.max(opts?.skip ?? 0, 0);
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

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: [{ brandId: 'asc' }, { companyName: 'asc' }],
      take,
      skip,
      select: trainingLeadSelect,
    }),
    prisma.prospect.count({ where }),
  ]);

  return {
    prospects,
    total,
    hasMore: skip + prospects.length < total,
  };
}

export type TrainingLeadRow = Awaited<ReturnType<typeof listTrainingLeads>>['prospects'][number];
