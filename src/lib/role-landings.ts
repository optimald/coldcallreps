import { PLAN, TRIAL_MINUTES } from '@/lib/product';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

export type RoleLandingKey = 'reps';

export type RolePricingCard = {
  label: string;
  price: string;
  detail: string;
  highlight?: boolean;
};

export interface RoleLanding {
  key: RoleLandingKey;
  path: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  headline: string;
  sub: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  proof: string;
  outcomesHeadline: string;
  outcomes: { title: string; body: string }[];
  stepsHeadline: string;
  steps: { n: string; title: string; body: string }[];
  pricingHeadline: string;
  /** Dense summary above cards — omit when cards already cover the info. */
  pricingNote?: string;
  escrowNote?: string;
  planHref: string;
  pricingCards?: RolePricingCard[];
}

export const ROLE_LANDINGS: Record<RoleLandingKey, RoleLanding> = {
  reps: {
    key: 'reps',
    path: '/for/reps',
    navLabel: 'For SDRs',
    eyebrow: 'Recruiting SDRs · skill · speed · consistency',
    title: 'For SDRs & appointment setters',
    headline: 'Skill, speed, and consistency. No earning ceiling.',
    sub: 'Cold calling pays the reps who show up sharp and stay consistent. Train with AI voice coaching, unlock brand campaigns, and get paid when you qualify or book — the harder you run, the more you can earn.',
    primaryCta: { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start Free — Get Paid' },
    secondaryCta: { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse Brand Deals' },
    proof: 'There is no earning limit — only how skilled, fast, and consistent you are.',
    outcomesHeadline: 'Built for reps who treat the dial like a craft',
    outcomes: [
      {
        title: 'Skill Over Spam',
        body: 'Practice gatekeepers, openers, and objection handling until your score proves you’re ready for live brand campaigns.',
      },
      {
        title: 'Speed on the Dial',
        body: 'Live AI coach whispers mid-call so you stay sharp and keep moving — more quality conversations per hour.',
      },
      {
        title: 'Consistency Wins',
        body: 'Scorecards and recordings show what to fix. Brands hire the reps who show up every day and hit the standard.',
      },
      {
        title: 'No Earning Ceiling',
        body: 'Get paid per qualified lead or booked meeting — plus accelerators and optional base on some campaigns. Volume and quality are yours to push.',
      },
    ],
    stepsHeadline: 'Four Moves to Getting Paid',
    steps: [
      {
        n: '01',
        title: 'Train',
        body: 'Run AI voice sessions on brand packs until your openers, objections, and asks are sharp.',
      },
      {
        n: '02',
        title: 'Prove',
        body: 'Hit the quality gate. Build a public profile brands trust.',
      },
      {
        n: '03',
        title: 'Get Paid',
        body: 'Apply to campaigns. Finish Stripe Connect. Brands pay you for results.',
      },
      {
        n: '04',
        title: 'Scale Up',
        body: 'Stack wins, unlock higher-paying deals, and raise your earnings with skill and consistency — no hard cap.',
      },
    ],
    pricingHeadline: 'Practice plans for SDRs',
    planHref: MARKETPOUNCE_SIGN_UP_REP,
    pricingCards: [
      {
        label: 'Free',
        price: '$0',
        detail: `${TRIAL_MINUTES} practice minutes to start · brand deals free`,
      },
      {
        label: 'Starter',
        price: `$${PLAN.STARTER.price}/mo`,
        detail: `${PLAN.STARTER.minutes} practice minutes / mo · live coach`,
        highlight: true,
      },
      {
        label: 'Pro',
        price: `$${PLAN.PRO.price}/mo`,
        detail: `${PLAN.PRO.minutes} practice minutes / mo · recording storage`,
      },
    ],
  },
};

export const ROLE_LANDING_LIST = Object.values(ROLE_LANDINGS);
