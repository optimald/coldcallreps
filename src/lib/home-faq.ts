import {
  CAMPAIGN_TIERS,
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
} from '@/lib/campaign-tiers';
import { PLAN, TRIAL_MINUTES } from '@/lib/product';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

export type HomeFaqLink = {
  href: string;
  label: string;
};

export type HomeFaqItem = {
  question: string;
  /** Plain-text answer — used by both the visible FAQ and FAQPage JSON-LD. */
  answer: string;
  /** Optional related links shown under the answer in the UI only. */
  links?: readonly HomeFaqLink[];
};

const tierBandSummary = CAMPAIGN_TIERS.map((t) => `${t.label} ${t.subtitle}`).join('; ');

const applyGateAnswer = DEFAULT_REQUIRE_CERTIFICATION
  ? `Campaigns use an apply gate: complete at least ${DEFAULT_MIN_PRACTICE_SESSIONS} practice session${DEFAULT_MIN_PRACTICE_SESSIONS === 1 ? '' : 's'} on the brand pack, score at least ${DEFAULT_CAMPAIGN_MIN_SCORE}, and earn brand certification (usually score ≥${DEFAULT_CAMPAIGN_MIN_SCORE}). Exact thresholds can vary by campaign, but practice + proof come first.`
  : `Campaigns use an apply gate: complete at least ${DEFAULT_MIN_PRACTICE_SESSIONS} practice session${DEFAULT_MIN_PRACTICE_SESSIONS === 1 ? '' : 's'} on the brand pack and score at least ${DEFAULT_CAMPAIGN_MIN_SCORE}. Exact thresholds can vary by campaign, but practice + proof come first.`;

/**
 * Homepage FAQ copy — single source for UI accordion + FAQPage JSON-LD.
 * Grounded in product.ts, campaign-tiers.ts, apply-gate defaults, and payout docs.
 */
export const HOME_FAQS: readonly HomeFaqItem[] = [
  {
    question: 'What is ColdCallReps?',
    answer:
      'ColdCallReps recruits SDRs and appointment setters. You practice cold calls with AI voice, prove quality with scores and certifications, then run paid brand deals calling leads. Humans dial live prospects — AI trains and gates quality.',
    links: [
      { href: '/for/reps', label: 'SDR path' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free' },
    ],
  },
  {
    question: 'How much does AI practice cost?',
    answer: `Free includes ${TRIAL_MINUTES} practice minutes to start. Starter is $${PLAN.STARTER.price}/mo, Pro is $${PLAN.PRO.price}/mo, and Org is $${PLAN.TEAM.price}/user/mo. Brand deals stay free for reps — practice plans buy minutes and coaching tools.`,
    links: [
      { href: '/pricing', label: 'See pricing' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Sign up as a rep' },
    ],
  },
  {
    question: 'Do reps pay to join campaigns?',
    answer:
      'No. Marketplace campaigns are free for reps once you clear the quality gate. Brands fund payouts; you get paid for approved results via Stripe Connect.',
    links: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse brand deals' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start getting paid' },
    ],
  },
  {
    question: 'What do I need before applying to a campaign?',
    answer: applyGateAnswer,
    links: [
      { href: '/for/reps', label: 'SDR path' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Sign up as a rep' },
    ],
  },
  {
    question: 'How do payouts work?',
    answer:
      'You get paid for verified outcomes and optional base pay via Stripe Connect. The platform keeps 20% as a fee, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base — the rest goes to you.',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free' },
    ],
  },
  {
    question: 'What counts as a booked meeting?',
    answer:
      'A booked meeting is a claimed outcome that passes AI post-call audit — typically a calendar hold with a qualified decision-maker, supported by notes or transcript. Claims without enough evidence do not pay.',
    links: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'How brand deals pay' }],
  },
  {
    question: 'What are the campaign payout tiers?',
    answer: `Campaigns use flat tier bands per verified set (not bidding): ${tierBandSummary}. Rates depend on ICP difficulty and gatekeeper friction.`,
    links: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Brand deals' },
      { href: '/for/reps', label: 'SDR path' },
    ],
  },
  {
    question: 'Is this an AI autodialer?',
    answer:
      'No. ColdCallReps is not an autodialer. AI runs practice, coaching, scorecards, and claim audits. Live outbound is done by human reps on real calls.',
    links: [{ href: '/for/reps', label: 'Train as a rep' }],
  },
] as const;

export function homeFaqJsonLd(opts?: { url?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(opts?.url ? { url: opts.url } : {}),
    mainEntity: HOME_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
