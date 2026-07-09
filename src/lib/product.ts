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

export const PLAN = {
  STARTER: {
    price: 5,
    label: 'Starter',
    minutes: Number(process.env.STARTER_MONTHLY_MINUTES || 80),
  },
  PRO: {
    price: 29,
    label: 'Pro',
    minutes: Number(process.env.PRO_MONTHLY_MINUTES || 500),
  },
} as const;

export const REFERRAL_BONUS_MINUTES = Number(process.env.REFERRAL_BONUS_MINUTES || 30);
