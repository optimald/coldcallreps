import { TRIAL_MINUTES } from '@/lib/product';
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
    sub: 'Train with AI voice, prove your score, then get paid to dial brand-provided leads — typically ~$30–$40 per B2B appointment set. Completely free to join. Clients and leads are provided. No hard earning ceiling.',
    primaryCta: { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start Free — Get Paid' },
    secondaryCta: { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse Brand Deals' },
    proof: 'Leads provided · $0 to join · Stripe Connect live · Remitly coming soon',
    outcomesHeadline: 'Built for reps who treat the dial like a craft',
    outcomes: [
      {
        title: 'Leads Provided',
        body: 'You do not hunt clients. Brands fund campaigns and hand you their dial-ready lists after acceptance.',
      },
      {
        title: 'Skill Over Spam',
        body: 'Practice gatekeepers, openers, and objection handling until your score proves you’re ready for live brand campaigns.',
      },
      {
        title: 'Paid Per Result',
        body: 'Earn per booked meeting or qualified lead — typically ~$30–$40/appt on many B2B deals, higher on harder ICPs. No salary ceiling.',
      },
      {
        title: 'Platform Pays You',
        body: 'Like Fiverr: brands fund escrow, you deliver. Stripe Connect is live; Remitly coming soon. No join fee to accept brands.',
      },
    ],
    stepsHeadline: 'Four Moves to Getting Paid',
    steps: [
      {
        n: '01',
        title: 'Train',
        body: `Use your generous ${TRIAL_MINUTES}+ free practice minutes on AI voice — meant to cover training without paying. Buying minutes is only if free runs out.`,
      },
      {
        n: '02',
        title: 'Prove',
        body: 'Hit the quality gate. Build a public profile brands trust.',
      },
      {
        n: '03',
        title: 'Apply',
        body: 'Unlock paid brand deals. Brands provide the leads — you pick campaigns that fit.',
      },
      {
        n: '04',
        title: 'Get Paid',
        body: 'Connect payouts (Stripe live · Remitly coming soon). Dial brand leads. Get paid per verified result.',
      },
    ],
    pricingHeadline: 'Free to train. Brands pay you.',
    pricingNote:
      'Generous free practice is the default — buying minutes is the exception. Campaigns stay $0 for reps. Brands fund escrow; a small capped commission comes out of each payout — you never pay a fee to join a brand.',
    planHref: MARKETPOUNCE_SIGN_UP_REP,
    pricingCards: [
      {
        label: 'For SDRs',
        price: '$0',
        detail: `${TRIAL_MINUTES}+ free practice minutes · leads provided · Stripe Connect · Remitly soon`,
        highlight: true,
      },
    ],
  },
};

export const ROLE_LANDING_LIST = Object.values(ROLE_LANDINGS);
