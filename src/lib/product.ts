/**
 * Product context injected into voice prompts & coach.
 * Keep generic so reps can practice any outbound pitch.
 */
export const PRODUCT = {
  name: 'Cold Call Reps',
  shortName: 'your offer',
  defaultPitch:
    'a $500 Lovable website for local businesses that have no site or a broken one',
  heroScenarios: ['budget_500', 'pen_pitch', 'standard', 'gatekeeper'] as const,
};

export type FocusArea =
  | 'standard'
  | 'gatekeeper'
  | 'pricing'
  | 'rejection'
  | 'budget_500'
  | 'pen_pitch';

export const FOCUS_LABELS: Record<FocusArea, string> = {
  standard: 'Gatekeeper → Decision Maker',
  gatekeeper: 'Gatekeeper Only',
  pricing: 'Pricing Objections',
  rejection: 'Rejection Recovery',
  budget_500: '$500 Website Pitch',
  pen_pitch: 'Sell Me This Pen',
};

/** Free minutes granted once on signup (Free plan allotment). */
export const TRIAL_MINUTES = Number(process.env.TRIAL_MINUTES || 15);

/** Org plan practice minutes contributed per seat / month. */
export const TEAM_MINUTES_PER_SEAT = Number(process.env.TEAM_MINUTES_PER_SEAT || 60);

/**
 * Plan catalog (display + allotments).
 * Ops: Stripe Price IDs must match these amounts — update STRIPE_STARTER_PRICE_ID
 * for $7 Starter and any other changed amounts in the Dashboard.
 */
export type PlanKey = 'FREE' | 'STARTER' | 'PRO' | 'RECRUITER' | 'TEAM';
export type PaidPlanKey = Exclude<PlanKey, 'FREE'>;

export const PLAN = {
  FREE: {
    key: 'FREE' as const,
    price: 0,
    label: 'Free',
    audience: 'SDRs & reps',
    minutes: TRIAL_MINUTES,
    features: [
      `${TRIAL_MINUTES} practice minutes to start`,
      'All practice scenarios + scorecards',
      'Brand deals free for reps',
      'Train → prove → apply → Stripe Connect → get paid',
      'Global leaderboard',
      'Public profile when you’re ready',
    ],
  },
  STARTER: {
    key: 'STARTER' as const,
    price: 7,
    label: 'Starter',
    audience: 'SDRs & reps',
    minutes: Number(process.env.STARTER_MONTHLY_MINUTES || 100),
    features: [
      'Daily practice + live coach',
      'Brand deals free for reps',
      'Stripe Connect payouts on approved results',
      'Global leaderboard + public profile',
      'Scorecards (recording storage on Pro/Org)',
    ],
  },
  PRO: {
    key: 'PRO' as const,
    price: 29,
    label: 'Pro',
    audience: 'SDRs & reps',
    minutes: Number(process.env.PRO_MONTHLY_MINUTES || 600),
    features: [
      `${Number(process.env.PRO_MONTHLY_MINUTES || 600)} practice minutes / mo`,
      'Call recording storage + shareable audio',
      'Priority coach model',
      'Verified badge path (faster)',
      'Brand deals free for reps',
      'Stripe Connect payouts on approved results',
      'Top-10 weekly digest highlight eligibility',
      'Public profile + shareable highlights',
    ],
  },
  RECRUITER: {
    key: 'RECRUITER' as const,
    price: 0,
    label: 'Recruiter',
    audience: 'Recruiters',
    minutes: 0,
    credits: Number(process.env.RECRUITER_MONTHLY_CREDITS || 100),
    features: [
      'Free recruiter desk (limited time)',
      'Direct Connect messaging',
      'Verified-only + score filters',
      'Job posting + applicant inbox',
      'Talent API keys',
    ],
  },
  TEAM: {
    key: 'TEAM' as const,
    price: 60,
    label: 'Org',
    audience: 'Orgs',
    /** Display unit for price (per seat). */
    priceUnit: '/user/mo' as const,
    minutes: Number(process.env.TEAM_MONTHLY_MINUTES || 2000),
    seats: Number(process.env.TEAM_SEATS || 5),
    minutesPerSeat: TEAM_MINUTES_PER_SEAT,
    features: [
      `${TEAM_MINUTES_PER_SEAT} practice minutes / user / mo`,
      'Shared org minute pool',
      'Call recording storage for all seats',
      'Academy + curricula',
      'Manager playbooks + team roster',
      'Seat-based billing',
      'Shared coaching signal for the desk',
    ],
  },
} as const;

/**
 * Referral reward = one free month of Starter usage (practice minutes).
 * Both referrer and referee receive this when a code is applied.
 * Override with REFERRAL_BONUS_MINUTES if ops need a different allotment.
 */
export const REFERRAL_BONUS_MINUTES = Number(
  process.env.REFERRAL_BONUS_MINUTES || PLAN.STARTER.minutes
);

/** Short product copy for Settings / pricing. */
export const REFERRAL_REWARD_LABEL = `1 free month of Starter (${REFERRAL_BONUS_MINUTES} min)`;

/** One-time minute packs (overage top-up — not metered auto-billing). */
export const MINUTE_PACKS = [
  {
    key: 'pack_60',
    minutes: 60,
    priceUsd: 9,
    priceEnv: 'STRIPE_PACK_60_PRICE_ID',
    label: '60 minutes',
  },
  {
    key: 'pack_200',
    minutes: 200,
    priceUsd: 25,
    priceEnv: 'STRIPE_PACK_200_PRICE_ID',
    label: '200 minutes',
  },
] as const;

export type MinutePackKey = (typeof MINUTE_PACKS)[number]['key'];

export function priceIdForPack(key: MinutePackKey): string | undefined {
  const pack = MINUTE_PACKS.find((p) => p.key === key);
  if (!pack) return undefined;
  return process.env[pack.priceEnv];
}

export function priceIdForTier(tier: PaidPlanKey | PlanKey): string | undefined {
  switch (tier) {
    case 'FREE':
      return undefined;
    case 'PRO':
      return process.env.STRIPE_PRO_PRICE_ID;
    case 'RECRUITER':
      return process.env.STRIPE_RECRUITER_PRICE_ID;
    case 'TEAM':
      return process.env.STRIPE_TEAM_PRICE_ID;
    case 'STARTER':
    default:
      return process.env.STRIPE_STARTER_PRICE_ID;
  }
}

export function minutesForTier(tier: PlanKey): number {
  if (tier === 'FREE') return TRIAL_MINUTES;
  if (tier === 'RECRUITER') return 0;
  if (tier === 'TEAM') return PLAN.TEAM.minutes;
  if (tier === 'PRO') return PLAN.PRO.minutes;
  return PLAN.STARTER.minutes;
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlanKey {
  return plan === 'STARTER' || plan === 'PRO' || plan === 'RECRUITER' || plan === 'TEAM';
}
