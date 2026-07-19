import type {
  Campaign,
  CampaignApplicationStatus,
  CampaignEarningsModel,
  CampaignGoalType,
  CampaignStatus,
  ProductPack,
  Playbook,
  Brand,
} from '@prisma/client';
import {
  cadenceShortSuffix,
  isBasePayCadence,
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_CAP_CENTS,
  type BasePayCadence,
} from '@/lib/platform-fees';
import {
  formatCallingHoursLabel,
  isWithinCampaignCallingHours,
} from '@/lib/calling-hours';

export const CAMPAIGN_GOAL_TYPES: CampaignGoalType[] = [
  'QUALIFIED_LEAD',
  'BOOKED_MEETING',
  'BOTH',
];
export const CAMPAIGN_EARNINGS_MODELS: CampaignEarningsModel[] = [
  'PER_BOOKED_MEETING',
  'PER_QUALIFIED_LEAD',
  'TIERED_ACCELERATOR',
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

export const EARNINGS_MODEL_LABELS: Record<CampaignEarningsModel, string> = {
  PER_BOOKED_MEETING: 'Per booked meeting',
  PER_QUALIFIED_LEAD: 'Per qualified lead',
  TIERED_ACCELERATOR: 'Tiered / accelerator',
};

export const EARNINGS_MODEL_BLURBS: Record<CampaignEarningsModel, string> = {
  PER_BOOKED_MEETING: 'Paid when a meeting is scheduled. Recommended $40 – $150.',
  PER_QUALIFIED_LEAD: 'Lighter qualification (no meeting). Recommended $25 – $80.',
  TIERED_ACCELERATOR: 'Rate increases with volume. Recommended $50 → $75 → $100+.',
};

/** Soft recommended ranges for create UI (cents). */
export const EARNINGS_MODEL_RANGES: Record<
  CampaignEarningsModel,
  { minCents: number; maxCents: number; suggestedCents: number }
> = {
  PER_BOOKED_MEETING: { minCents: 4000, maxCents: 15000, suggestedCents: 7500 },
  PER_QUALIFIED_LEAD: { minCents: 2500, maxCents: 8000, suggestedCents: 4000 },
  TIERED_ACCELERATOR: { minCents: 2500, maxCents: 25000, suggestedCents: 5000 },
};

/** Hard API clamps so nonsense values never hit Stripe/escrow. */
export const EARNINGS_PAYOUT_ABS_MIN_CENTS = 500; // $5
export const EARNINGS_PAYOUT_ABS_MAX_CENTS = 50000; // $500

export function isCampaignGoalType(v: unknown): v is CampaignGoalType {
  return typeof v === 'string' && (CAMPAIGN_GOAL_TYPES as string[]).includes(v);
}

export function isCampaignEarningsModel(v: unknown): v is CampaignEarningsModel {
  return typeof v === 'string' && (CAMPAIGN_EARNINGS_MODELS as string[]).includes(v);
}

export function goalTypeForEarningsModel(model: CampaignEarningsModel): CampaignGoalType {
  if (model === 'PER_QUALIFIED_LEAD') return 'QUALIFIED_LEAD';
  return 'BOOKED_MEETING';
}

export function earningsModelFromGoalType(
  goalType: CampaignGoalType | string | null | undefined
): CampaignEarningsModel {
  if (goalType === 'QUALIFIED_LEAD') return 'PER_QUALIFIED_LEAD';
  return 'PER_BOOKED_MEETING';
}

export function clampPayoutCents(cents: number): number {
  return Math.min(
    EARNINGS_PAYOUT_ABS_MAX_CENTS,
    Math.max(EARNINGS_PAYOUT_ABS_MIN_CENTS, Math.round(cents))
  );
}

export type AcceleratorSchedule = {
  stepSize: number;
  tier1Cents: number;
  tier2Cents: number;
  tier3Cents: number;
};

export function normalizeAcceleratorSchedule(input: {
  stepSize?: number | null;
  tier1Cents?: number | null;
  tier2Cents?: number | null;
  tier3Cents?: number | null;
}): AcceleratorSchedule {
  const stepSize = Math.max(1, Math.min(100, Math.round(input.stepSize || 5)));
  const tier1Cents = clampPayoutCents(input.tier1Cents ?? 5000);
  const tier2Cents = clampPayoutCents(input.tier2Cents ?? 7500);
  const tier3Cents = clampPayoutCents(input.tier3Cents ?? 10000);
  return { stepSize, tier1Cents, tier2Cents, tier3Cents };
}

/**
 * Resolve gross payout for the next verified claim.
 * `priorPaidCount` = PAID claims/payouts already completed for this rep on the campaign.
 */
export function resolveClaimPayoutCents(
  campaign: {
    earningsModel?: CampaignEarningsModel | string | null;
    goalType?: CampaignGoalType | string | null;
    payoutCents: number;
    qualifiedPayoutCents?: number | null;
    acceleratorStepSize?: number | null;
    acceleratorTier1Cents?: number | null;
    acceleratorTier2Cents?: number | null;
    acceleratorTier3Cents?: number | null;
  },
  priorPaidCount = 0
): number {
  const model =
    (isCampaignEarningsModel(campaign.earningsModel) && campaign.earningsModel) ||
    earningsModelFromGoalType(campaign.goalType);

  if (model === 'TIERED_ACCELERATOR') {
    const schedule = normalizeAcceleratorSchedule({
      stepSize: campaign.acceleratorStepSize,
      tier1Cents: campaign.acceleratorTier1Cents ?? campaign.payoutCents,
      tier2Cents: campaign.acceleratorTier2Cents,
      tier3Cents: campaign.acceleratorTier3Cents,
    });
    const prior = Math.max(0, Math.floor(priorPaidCount));
    const tierIndex = Math.min(2, Math.floor(prior / schedule.stepSize));
    if (tierIndex <= 0) return schedule.tier1Cents;
    if (tierIndex === 1) return schedule.tier2Cents;
    return schedule.tier3Cents;
  }

  if (model === 'PER_QUALIFIED_LEAD') {
    return clampPayoutCents(
      campaign.qualifiedPayoutCents != null && campaign.qualifiedPayoutCents > 0
        ? campaign.qualifiedPayoutCents
        : campaign.payoutCents
    );
  }

  return clampPayoutCents(campaign.payoutCents);
}

export function formatAcceleratorLabel(schedule: AcceleratorSchedule): string {
  return `${formatPayout(schedule.tier1Cents)} → ${formatPayout(schedule.tier2Cents)} → ${formatPayout(schedule.tier3Cents)} (every ${schedule.stepSize})`;
}

export function formatEarningsPayoutLabel(campaign: {
  earningsModel?: CampaignEarningsModel | string | null;
  goalType?: CampaignGoalType | string | null;
  payoutCents: number;
  qualifiedPayoutCents?: number | null;
  acceleratorStepSize?: number | null;
  acceleratorTier1Cents?: number | null;
  acceleratorTier2Cents?: number | null;
  acceleratorTier3Cents?: number | null;
}): string {
  const model =
    (isCampaignEarningsModel(campaign.earningsModel) && campaign.earningsModel) ||
    earningsModelFromGoalType(campaign.goalType);
  if (model === 'TIERED_ACCELERATOR') {
    return formatAcceleratorLabel(
      normalizeAcceleratorSchedule({
        stepSize: campaign.acceleratorStepSize,
        tier1Cents: campaign.acceleratorTier1Cents ?? campaign.payoutCents,
        tier2Cents: campaign.acceleratorTier2Cents,
        tier3Cents: campaign.acceleratorTier3Cents,
      })
    );
  }
  if (model === 'PER_QUALIFIED_LEAD') {
    const cents =
      campaign.qualifiedPayoutCents != null && campaign.qualifiedPayoutCents > 0
        ? campaign.qualifiedPayoutCents
        : campaign.payoutCents;
    return formatPayout(cents);
  }
  return formatPayout(campaign.payoutCents);
}

export function formatBasePayLabel(opts: {
  basePayCents?: number | null;
  basePayCadence?: string | null;
}): string | null {
  if (opts.basePayCents == null || opts.basePayCents <= 0) return null;
  const cadence: BasePayCadence = isBasePayCadence(opts.basePayCadence)
    ? opts.basePayCadence
    : 'MONTHLY';
  return `${formatBudgetCompact(opts.basePayCents)}${cadenceShortSuffix(cadence)} base`;
}

/** Combined marketplace line: "$1.5k/mo base + $75" */
export function formatCompensationLabel(campaign: {
  payoutCents: number;
  earningsModel?: CampaignEarningsModel | string | null;
  goalType?: CampaignGoalType | string | null;
  qualifiedPayoutCents?: number | null;
  acceleratorStepSize?: number | null;
  acceleratorTier1Cents?: number | null;
  acceleratorTier2Cents?: number | null;
  acceleratorTier3Cents?: number | null;
  basePayCents?: number | null;
  basePayCadence?: string | null;
}): string {
  const outcome = formatEarningsPayoutLabel(campaign);
  const base = formatBasePayLabel(campaign);
  return base ? `${base} + ${outcome}` : outcome;
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
 * Split a campaign payment.
 * Brand pays `payoutCents`; platform keeps `platformFeeBps` (default 20%), capped at `feeCapCents`.
 */
export function calcPayoutSplit(
  payoutCents: number,
  platformFeeBps: number = PLATFORM_FEE_BPS,
  feeCapCents?: number | null
) {
  const grossCents = Math.max(0, Math.round(payoutCents));
  const bps = Math.min(10000, Math.max(0, Math.round(platformFeeBps)));
  const uncappedFee = Math.round((grossCents * bps) / 10000);
  const cap =
    feeCapCents == null
      ? PLATFORM_FEE_CAP_CENTS
      : Math.max(0, Math.round(feeCapCents));
  const platformFeeCents = Math.min(uncappedFee, cap);
  const netCents = Math.max(0, grossCents - platformFeeCents);
  return { grossCents, platformFeeCents, netCents, platformFeeBps: bps, feeCapCents: cap };
}

export function serializePayout(p: {
  id: string;
  status: string;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  paidAt?: Date | null;
  failureReason?: string | null;
  claimId?: string | null;
}) {
  return {
    id: p.id,
    status: p.status,
    claimId: p.claimId || null,
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

/** Prefer a PAID payout, else the most recently updated — for legacy single-payout UI. */
export function primaryPayout<T extends { status: string; updatedAt?: Date | string | null; createdAt?: Date | string | null; paidAt?: Date | string | null }>(
  payouts: T[] | null | undefined
): T | null {
  if (!payouts?.length) return null;
  const paid = payouts.filter((p) => p.status === 'PAID');
  if (paid.length) {
    return [...paid].sort((a, b) => {
      const at = new Date(a.paidAt || a.updatedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.paidAt || b.updatedAt || b.createdAt || 0).getTime();
      return bt - at;
    })[0];
  }
  return [...payouts].sort((a, b) => {
    const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bt - at;
  })[0];
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
  callingHoursStartMin?: number | null;
  callingHoursEndMin?: number | null;
  callingTimezone?: string | null;
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

/**
 * Full dial-now gate: calendar/budget eligibility plus daily calling hours.
 * Use for SDR queue + outbound dials. Do not use for apply / open-campaign listing.
 */
export function isCampaignDialNowEligible(
  campaign: CampaignEligibilityInput,
  now: Date = new Date()
): CampaignEligibilityResult {
  const base = isCampaignDialEligible(campaign, now);
  if (!base.ok) return base;

  if (
    !isWithinCampaignCallingHours(
      {
        callingHoursStartMin: campaign.callingHoursStartMin,
        callingHoursEndMin: campaign.callingHoursEndMin,
        callingTimezone: campaign.callingTimezone,
      },
      now
    )
  ) {
    return {
      ok: false,
      reason: 'Outside calling hours',
      remainingOverallCents: base.remainingOverallCents,
      remainingDailyCents: base.remainingDailyCents,
    };
  }

  return base;
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
  const callingHoursStartMin =
    (c as { callingHoursStartMin?: number | null }).callingHoursStartMin ?? null;
  const callingHoursEndMin =
    (c as { callingHoursEndMin?: number | null }).callingHoursEndMin ?? null;
  const callingTimezone = (c as { callingTimezone?: string | null }).callingTimezone ?? null;
  const spentCents = c.spentCents ?? 0;
  const spentTodayCents = c.spentTodayCents ?? 0;

  const eligibility = isCampaignDialEligible(
    {
      status: c.status,
      startsAt,
      endsAt,
      callingHoursStartMin,
      callingHoursEndMin,
      callingTimezone,
      budgetCents: c.budgetCents,
      budgetMode,
      dailyBudgetCents,
      spentCents,
      spentTodayCents,
    },
    now
  );

  const withinCallingHours = isWithinCampaignCallingHours({
    callingHoursStartMin,
    callingHoursEndMin,
    callingTimezone,
  }, now);
  const dialNow = isCampaignDialNowEligible(
    {
      status: c.status,
      startsAt,
      endsAt,
      callingHoursStartMin,
      callingHoursEndMin,
      callingTimezone,
      budgetCents: c.budgetCents,
      budgetMode,
      dailyBudgetCents,
      spentCents,
      spentTodayCents,
    },
    now
  );
  const callingHoursLabel = formatCallingHoursLabel({
    callingHoursStartMin,
    callingHoursEndMin,
    callingTimezone,
  });

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
    earningsModel:
      (isCampaignEarningsModel((c as { earningsModel?: string }).earningsModel) &&
        (c as { earningsModel: CampaignEarningsModel }).earningsModel) ||
      earningsModelFromGoalType(c.goalType),
    earningsModelLabel: (() => {
      const model =
        (isCampaignEarningsModel((c as { earningsModel?: string }).earningsModel) &&
          (c as { earningsModel: CampaignEarningsModel }).earningsModel) ||
        earningsModelFromGoalType(c.goalType);
      return EARNINGS_MODEL_LABELS[model];
    })(),
    payoutCents: c.payoutCents,
    payoutLabel: formatCompensationLabel(c as Campaign),
    outcomePayoutLabel: formatEarningsPayoutLabel(c as Campaign),
    basePayCents: (c as { basePayCents?: number | null }).basePayCents ?? null,
    basePayCadence: (c as { basePayCadence?: string | null }).basePayCadence ?? null,
    basePayLabel: formatBasePayLabel({
      basePayCents: (c as { basePayCents?: number | null }).basePayCents,
      basePayCadence: (c as { basePayCadence?: string | null }).basePayCadence,
    }),
    acceleratorStepSize: (c as { acceleratorStepSize?: number | null }).acceleratorStepSize ?? null,
    acceleratorTier1Cents:
      (c as { acceleratorTier1Cents?: number | null }).acceleratorTier1Cents ?? null,
    acceleratorTier2Cents:
      (c as { acceleratorTier2Cents?: number | null }).acceleratorTier2Cents ?? null,
    acceleratorTier3Cents:
      (c as { acceleratorTier3Cents?: number | null }).acceleratorTier3Cents ?? null,
    pricingTier: (c as { pricingTier?: string }).pricingTier || null,
    platformFeeBps: c.platformFeeBps,
    status: c.status,
    activateOn,
    dialEligible: eligibility.ok,
    dialEligibleReason: eligibility.ok ? null : eligibility.reason || null,
    dialNowEligible: dialNow.ok,
    dialNowEligibleReason: dialNow.ok ? null : dialNow.reason || null,
    withinCallingHours,
    minScore: c.minScore,
    requireCertification: c.requireCertification,
    minPracticeSessions: (c as { minPracticeSessions?: number }).minPracticeSessions ?? 1,
    packId: c.packId,
    playbookId: c.playbookId,
    playbookTitle:
      (c as { playbook?: { title?: string } | null }).playbook?.title || null,
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
    callingHoursStartMin,
    callingHoursEndMin,
    callingTimezone,
    callingHoursLabel,
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
