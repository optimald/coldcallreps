import type {
  Campaign,
  CampaignApplicationStatus,
  CampaignGoalType,
  CampaignStatus,
  ProductPack,
  Playbook,
  Brand,
} from '@prisma/client';

export const CAMPAIGN_GOAL_TYPES: CampaignGoalType[] = [
  'QUALIFIED_LEAD',
  'BOOKED_MEETING',
  'BOTH',
];
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED'];
export const APPLICATION_STATUSES: CampaignApplicationStatus[] = [
  'APPLIED',
  'ACCEPTED',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'WITHDRAWN',
];

export const BUDGET_MODES = ['OVERALL', 'DAILY'] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

export const GOAL_LABELS: Record<CampaignGoalType, string> = {
  QUALIFIED_LEAD: 'Qualified lead',
  BOOKED_MEETING: 'Booked meeting',
  BOTH: 'Qualified lead + meeting',
};

export function isCampaignGoalType(v: unknown): v is CampaignGoalType {
  return typeof v === 'string' && (CAMPAIGN_GOAL_TYPES as string[]).includes(v);
}

export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === 'string' && (CAMPAIGN_STATUSES as string[]).includes(v);
}

export function isApplicationStatus(v: unknown): v is CampaignApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as string[]).includes(v);
}

export function isBudgetMode(v: unknown): v is BudgetMode {
  return typeof v === 'string' && (BUDGET_MODES as readonly string[]).includes(v);
}

export function formatPayout(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Compact money for vitals (e.g. $2k, $180). */
export function formatBudgetCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000 && dollars % 1000 === 0) return `$${dollars / 1000}k`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

/**
 * Split a campaign outcome payment.
 * Brand pays `payoutCents`; platform keeps `platformFeeBps` (default 20%); SDR receives the rest.
 */
export function calcPayoutSplit(payoutCents: number, platformFeeBps = 2000) {
  const grossCents = Math.max(0, Math.round(payoutCents));
  const bps = Math.min(10000, Math.max(0, Math.round(platformFeeBps)));
  const platformFeeCents = Math.round((grossCents * bps) / 10000);
  const netCents = Math.max(0, grossCents - platformFeeCents);
  return { grossCents, platformFeeCents, netCents, platformFeeBps: bps };
}

export function serializePayout(p: {
  id: string;
  status: string;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  paidAt?: Date | null;
  failureReason?: string | null;
}) {
  return {
    id: p.id,
    status: p.status,
    grossCents: p.grossCents,
    platformFeeCents: p.platformFeeCents,
    netCents: p.netCents,
    grossLabel: formatPayout(p.grossCents),
    netLabel: formatPayout(p.netCents),
    feeLabel: formatPayout(p.platformFeeCents),
    paidAt: p.paidAt,
    failureReason: p.failureReason || null,
  };
}

export function practiceHref(campaign: {
  brandId: string;
  packId?: string | null;
  playbookId?: string | null;
}): string | null {
  if (!campaign.brandId) return null;
  const qs = new URLSearchParams({ brandId: campaign.brandId });
  if (campaign.packId) qs.set('packId', campaign.packId);
  if (campaign.playbookId) qs.set('playbookId', campaign.playbookId);
  return `/practice?${qs.toString()}`;
}

/** Start of UTC calendar day for `now`. */
export function utcDayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function formatCampaignDateRange(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined
): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start && !end) return `${fmt(start)} – Ongoing`;
  if (!start && end) return `Until ${fmt(end)}`;
  return 'Ongoing';
}

export type CampaignSpendStats = {
  spentCents: number;
  spentTodayCents: number;
};

export type CampaignEligibilityInput = {
  status: CampaignStatus | string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  budgetCents?: number | null;
  budgetMode?: string | null;
  dailyBudgetCents?: number | null;
  spentCents?: number;
  spentTodayCents?: number;
  /** Optional next award size — when set, remaining must cover this amount. */
  nextAwardCents?: number;
};

export type CampaignEligibilityResult = {
  ok: boolean;
  reason?: string;
  remainingOverallCents: number | null;
  remainingDailyCents: number | null;
};

/**
 * Whether new SDR dials / awards are allowed.
 * Does not affect in-flight Twilio legs — callers must only gate new work.
 */
export function isCampaignDialEligible(
  campaign: CampaignEligibilityInput,
  now: Date = new Date()
): CampaignEligibilityResult {
  const spent = Math.max(0, campaign.spentCents ?? 0);
  const spentToday = Math.max(0, campaign.spentTodayCents ?? 0);
  const overallCap =
    campaign.budgetCents != null && campaign.budgetCents > 0 ? campaign.budgetCents : null;
  const remainingOverall = overallCap != null ? Math.max(0, overallCap - spent) : null;

  const mode = (campaign.budgetMode || 'OVERALL').toUpperCase();
  const dailyCap =
    mode === 'DAILY' && campaign.dailyBudgetCents != null && campaign.dailyBudgetCents > 0
      ? campaign.dailyBudgetCents
      : null;
  const remainingDaily = dailyCap != null ? Math.max(0, dailyCap - spentToday) : null;

  const need = Math.max(0, campaign.nextAwardCents ?? 0);

  if (campaign.status !== 'OPEN') {
    return {
      ok: false,
      reason: 'Campaign is not active',
      remainingOverallCents: remainingOverall,
      remainingDailyCents: remainingDaily,
    };
  }

  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  if (startsAt && startsAt.getTime() > now.getTime()) {
    return {
      ok: false,
      reason: 'Campaign has not started yet',
      remainingOverallCents: remainingOverall,
      remainingDailyCents: remainingDaily,
    };
  }

  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: 'Campaign has ended',
      remainingOverallCents: remainingOverall,
      remainingDailyCents: remainingDaily,
    };
  }

  if (remainingOverall != null) {
    if (remainingOverall <= 0 || (need > 0 && remainingOverall < need)) {
      return {
        ok: false,
        reason: 'Overall budget exhausted',
        remainingOverallCents: remainingOverall,
        remainingDailyCents: remainingDaily,
      };
    }
  }

  if (remainingDaily != null) {
    if (remainingDaily <= 0 || (need > 0 && remainingDaily < need)) {
      return {
        ok: false,
        reason: 'Daily budget exhausted',
        remainingOverallCents: remainingOverall,
        remainingDailyCents: remainingDaily,
      };
    }
  }

  return {
    ok: true,
    remainingOverallCents: remainingOverall,
    remainingDailyCents: remainingDaily,
  };
}

/** Budget vitals label for list rows. */
export function formatBudgetVitals(opts: {
  budgetCents?: number | null;
  budgetMode?: string | null;
  dailyBudgetCents?: number | null;
  spentCents?: number;
  spentTodayCents?: number;
}): string {
  const mode = (opts.budgetMode || 'OVERALL').toUpperCase();
  const spent = opts.spentCents ?? 0;
  const spentToday = opts.spentTodayCents ?? 0;
  const overall = opts.budgetCents;
  const daily = opts.dailyBudgetCents;

  if (mode === 'DAILY' && daily != null && daily > 0) {
    const left = Math.max(0, daily - spentToday);
    return `${formatBudgetCompact(daily)}/day · ${formatBudgetCompact(left)} left today`;
  }

  if (overall != null && overall > 0) {
    const left = Math.max(0, overall - spent);
    return `${formatBudgetCompact(overall)} overall · ${formatBudgetCompact(left)} left`;
  }

  if (mode === 'DAILY') return 'Daily budget unset';
  return 'Uncapped';
}

type CampaignWithRelations = Campaign & {
  brand?: Pick<Brand, 'id' | 'name' | 'slug' | 'logoUrl'> | null;
  pack?: Pick<ProductPack, 'id' | 'name'> | null;
  playbook?: Pick<Playbook, 'id' | 'title'> | null;
  _count?: { applications: number };
  myApplication?: { id: string; status: CampaignApplicationStatus } | null;
  spentCents?: number;
  spentTodayCents?: number;
};

export function serializeCampaign(c: CampaignWithRelations, now: Date = new Date()) {
  const budgetMode = ((c as { budgetMode?: string }).budgetMode || 'OVERALL').toUpperCase();
  const dailyBudgetCents = (c as { dailyBudgetCents?: number | null }).dailyBudgetCents ?? null;
  const startsAt = (c as { startsAt?: Date | null }).startsAt ?? null;
  const endsAt = (c as { endsAt?: Date | null }).endsAt ?? null;
  const spentCents = c.spentCents ?? 0;
  const spentTodayCents = c.spentTodayCents ?? 0;

  const eligibility = isCampaignDialEligible(
    {
      status: c.status,
      startsAt,
      endsAt,
      budgetCents: c.budgetCents,
      budgetMode,
      dailyBudgetCents,
      spentCents,
      spentTodayCents,
    },
    now
  );

  const activateOn = c.status === 'OPEN';
  const remainingOverallCents = eligibility.remainingOverallCents;
  const remainingDailyCents = eligibility.remainingDailyCents;

  return {
    id: c.id,
    brandId: c.brandId,
    createdByUserId: c.createdByUserId,
    title: c.title,
    description: c.description,
    icpText: c.icpText,
    goalType: c.goalType,
    goalLabel: GOAL_LABELS[c.goalType],
    payoutCents: c.payoutCents,
    payoutLabel: formatPayout(c.payoutCents),
    pricingTier: (c as { pricingTier?: string }).pricingTier || null,
    platformFeeBps: c.platformFeeBps,
    status: c.status,
    activateOn,
    dialEligible: eligibility.ok,
    dialEligibleReason: eligibility.ok ? null : eligibility.reason || null,
    minScore: c.minScore,
    requireCertification: c.requireCertification,
    minPracticeSessions: (c as { minPracticeSessions?: number }).minPracticeSessions ?? 1,
    packId: c.packId,
    playbookId: c.playbookId,
    budgetCents: c.budgetCents,
    budgetMode,
    dailyBudgetCents,
    spentCents,
    spentTodayCents,
    remainingOverallCents,
    remainingDailyCents,
    budgetLabel: formatBudgetVitals({
      budgetCents: c.budgetCents,
      budgetMode,
      dailyBudgetCents,
      spentCents,
      spentTodayCents,
    }),
    startsAt,
    endsAt,
    dateRangeLabel: formatCampaignDateRange(startsAt, endsAt),
    escrowLockedCents: (c as { escrowLockedCents?: number }).escrowLockedCents ?? 0,
    escrowLabel: (() => {
      const n = (c as { escrowLockedCents?: number }).escrowLockedCents ?? 0;
      return n > 0 ? `${formatBudgetCompact(n)} escrow` : null;
    })(),
    maxAwards: c.maxAwards,
    bookingLink: (c as { bookingLink?: string | null }).bookingLink ?? null,
    meetingDurationMinutes:
      (c as { meetingDurationMinutes?: number | null }).meetingDurationMinutes ?? null,
    qualifiedPayoutCents:
      (c as { qualifiedPayoutCents?: number | null }).qualifiedPayoutCents ?? null,
    qualifiedPayoutLabel: (() => {
      const q = (c as { qualifiedPayoutCents?: number | null }).qualifiedPayoutCents;
      return q != null ? formatPayout(q) : null;
    })(),
    targetVertical: (c as { targetVertical?: string | null }).targetVertical ?? null,
    targetLocation: (c as { targetLocation?: string | null }).targetLocation ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    brand: c.brand
      ? {
          id: c.brand.id,
          name: c.brand.name,
          slug: c.brand.slug,
          logoUrl: c.brand.logoUrl,
        }
      : undefined,
    pack: c.pack ? { id: c.pack.id, name: c.pack.name } : null,
    playbook: c.playbook ? { id: c.playbook.id, title: c.playbook.title } : null,
    applicationCount: c._count?.applications,
    myApplication: c.myApplication ?? undefined,
    practiceHref: practiceHref(c),
  };
}

/** Parse optional ISO / date input; empty string → null. */
export function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
