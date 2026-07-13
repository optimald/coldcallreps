/**
 * Brand lead-credit meter (Maps scrape + enhanced enrichment).
 * Deduct on save only. Imports / manual adds are free.
 */

import { prisma } from '@/lib/prisma';
import {
  BRAND_LEAD_FREE_MONTHLY,
  BRAND_LEAD_PLAN,
  BRAND_LEAD_PLAN_ALLOTMENT,
  type BrandLeadPlanKey,
} from '@/lib/product';

export type LeadCreditSnapshot = {
  plan: BrandLeadPlanKey;
  allotmentRemaining: number;
  packRemaining: number;
  totalRemaining: number;
  usedThisPeriod: number;
  periodLimit: number;
  packExpiresAt: string | null;
  planPeriodEnd: string | null;
};

function asPlan(raw: string | null | undefined): BrandLeadPlanKey {
  if (raw === 'LEAD_MONTHLY' || raw === 'LEAD_ANNUAL') return raw;
  return 'FREE';
}

function periodLimitFor(plan: BrandLeadPlanKey): number {
  if (plan === 'LEAD_MONTHLY' || plan === 'LEAD_ANNUAL') return BRAND_LEAD_PLAN_ALLOTMENT;
  return BRAND_LEAD_FREE_MONTHLY;
}

function sameCalendarMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/** Ensure FREE allotment resets each calendar month; expire stale packs. */
export async function ensureLeadCreditPeriod(brandId: string): Promise<LeadCreditSnapshot> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error('Brand not found');

  const plan = asPlan(brand.leadPlan);
  const now = new Date();
  let allotment = brand.leadCreditsAllotment;
  let pack = brand.leadCreditsPack;
  let used = brand.leadCreditsUsedPeriod;
  let resetAt = brand.leadAllotmentResetAt;
  let packExpiresAt = brand.leadPackExpiresAt;

  const updates: Record<string, unknown> = {};

  if (packExpiresAt && packExpiresAt.getTime() < now.getTime() && pack > 0) {
    await prisma.brandLeadCreditLedger.create({
      data: {
        brandId,
        type: 'EXPIRE_PACK',
        amount: -pack,
        allotmentAfter: allotment,
        packAfter: 0,
        note: 'Pack credits expired (12-month shelf life)',
      },
    });
    pack = 0;
    packExpiresAt = null;
    updates.leadCreditsPack = 0;
    updates.leadPackExpiresAt = null;
  }

  const needsMonthReset =
    plan === 'FREE' && (!resetAt || !sameCalendarMonth(resetAt, now));
  if (needsMonthReset) {
    const limit = BRAND_LEAD_FREE_MONTHLY;
    allotment = limit;
    used = 0;
    resetAt = now;
    updates.leadCreditsAllotment = limit;
    updates.leadCreditsUsedPeriod = 0;
    updates.leadAllotmentResetAt = now;
    await prisma.brandLeadCreditLedger.create({
      data: {
        brandId,
        type: 'GRANT_ALLOTMENT',
        amount: limit,
        allotmentAfter: allotment,
        packAfter: pack,
        note: 'Free monthly allotment reset',
      },
    });
  }

  if (Object.keys(updates).length > 0) {
    await prisma.brand.update({ where: { id: brandId }, data: updates });
  }

  return {
    plan,
    allotmentRemaining: allotment,
    packRemaining: pack,
    totalRemaining: allotment + pack,
    usedThisPeriod: used,
    periodLimit: periodLimitFor(plan),
    packExpiresAt: packExpiresAt?.toISOString() ?? null,
    planPeriodEnd: brand.leadPlanPeriodEnd?.toISOString() ?? null,
  };
}

export async function getLeadCreditSnapshot(brandId: string): Promise<LeadCreditSnapshot> {
  return ensureLeadCreditPeriod(brandId);
}

/**
 * Reserve/deduct one credit for a newly saved Maps lead.
 * Returns false if balance is 0 (caller should soft-block).
 */
export async function deductLeadCreditOnSave(
  brandId: string,
  prospectId?: string | null
): Promise<{ ok: true; snapshot: LeadCreditSnapshot } | { ok: false; snapshot: LeadCreditSnapshot }> {
  const snap = await ensureLeadCreditPeriod(brandId);
  if (snap.totalRemaining <= 0) {
    return { ok: false, snapshot: snap };
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { ok: false, snapshot: snap };

  let allotment = brand.leadCreditsAllotment;
  let pack = brand.leadCreditsPack;
  let used = brand.leadCreditsUsedPeriod;

  if (allotment > 0) {
    allotment -= 1;
  } else {
    pack -= 1;
  }
  used += 1;

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      leadCreditsAllotment: allotment,
      leadCreditsPack: Math.max(0, pack),
      leadCreditsUsedPeriod: used,
    },
  });

  await prisma.brandLeadCreditLedger.create({
    data: {
      brandId,
      type: 'DEDUCT_SAVE',
      amount: -1,
      allotmentAfter: allotment,
      packAfter: Math.max(0, pack),
      prospectId: prospectId || null,
      note: 'Enriched lead saved from Generate Leads',
    },
  });

  return {
    ok: true,
    snapshot: {
      plan: asPlan(brand.leadPlan),
      allotmentRemaining: allotment,
      packRemaining: Math.max(0, pack),
      totalRemaining: allotment + Math.max(0, pack),
      usedThisPeriod: used,
      periodLimit: periodLimitFor(asPlan(brand.leadPlan)),
      packExpiresAt: brand.leadPackExpiresAt?.toISOString() ?? null,
      planPeriodEnd: brand.leadPlanPeriodEnd?.toISOString() ?? null,
    },
  };
}

export async function grantLeadPack(
  brandId: string,
  credits: number,
  opts?: { stripeSessionId?: string; note?: string }
) {
  await ensureLeadCreditPeriod(brandId);
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error('Brand not found');

  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  // Extend if existing pack expires later
  const packExpiresAt =
    brand.leadPackExpiresAt && brand.leadPackExpiresAt > expires
      ? brand.leadPackExpiresAt
      : expires;

  const pack = brand.leadCreditsPack + credits;
  await prisma.brand.update({
    where: { id: brandId },
    data: {
      leadCreditsPack: pack,
      leadPackExpiresAt: packExpiresAt,
    },
  });

  await prisma.brandLeadCreditLedger.create({
    data: {
      brandId,
      type: 'GRANT_PACK',
      amount: credits,
      allotmentAfter: brand.leadCreditsAllotment,
      packAfter: pack,
      stripeSessionId: opts?.stripeSessionId || null,
      note: opts?.note || `Lead pack +${credits}`,
    },
  });
}

export async function applyBrandLeadSubscription(opts: {
  brandId: string;
  plan: Exclude<BrandLeadPlanKey, 'FREE'>;
  subscriptionId?: string | null;
  periodEnd?: Date | null;
}) {
  const allotment = BRAND_LEAD_PLAN[opts.plan].allotment;
  const now = new Date();
  await prisma.brand.update({
    where: { id: opts.brandId },
    data: {
      leadPlan: opts.plan,
      leadCreditsAllotment: allotment,
      leadCreditsUsedPeriod: 0,
      leadAllotmentResetAt: now,
      leadPlanPeriodEnd: opts.periodEnd || null,
      stripeLeadSubscriptionId: opts.subscriptionId || undefined,
    },
  });

  await prisma.brandLeadCreditLedger.create({
    data: {
      brandId: opts.brandId,
      type: 'GRANT_ALLOTMENT',
      amount: allotment,
      allotmentAfter: allotment,
      packAfter: (
        await prisma.brand.findUnique({
          where: { id: opts.brandId },
          select: { leadCreditsPack: true },
        })
      )?.leadCreditsPack ?? 0,
      note: `Subscribed to ${BRAND_LEAD_PLAN[opts.plan].label}`,
    },
  });
}

export async function downgradeBrandLeadPlan(brandId: string) {
  const now = new Date();
  await prisma.brand.update({
    where: { id: brandId },
    data: {
      leadPlan: 'FREE',
      leadCreditsAllotment: BRAND_LEAD_FREE_MONTHLY,
      leadCreditsUsedPeriod: 0,
      leadAllotmentResetAt: now,
      leadPlanPeriodEnd: null,
      stripeLeadSubscriptionId: null,
    },
  });
}
