import {
  CAMPAIGN_TIERS,
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
} from '@/lib/campaign-tiers';
import { PLAN, TRIAL_MINUTES } from '@/lib/product';

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
      'ColdCallReps is an AI-first outbound training ground and marketplace. Reps practice cold calls with AI voice, prove quality with scores and certifications, then run paid campaigns for founders and brands. Humans dial live prospects — AI trains and gates quality.',
    links: [
      { href: '/for/reps', label: 'For reps' },
      { href: '/for/brands', label: 'For brands' },
    ],
  },
  {
    question: 'How much does AI practice cost?',
    answer: `Free includes ${TRIAL_MINUTES} practice minutes to start. Starter is $${PLAN.STARTER.price}/mo, Pro is $${PLAN.PRO.price}/mo, and Org is $${PLAN.TEAM.price}/user/mo. Brand deals stay free for reps — practice plans buy minutes and coaching tools. Train, prove, apply to brand deals, connect Stripe, get paid.`,
    links: [
      { href: '/pricing', label: 'See pricing' },
      { href: '/sign-up?role=REP', label: 'Sign up as a rep' },
    ],
  },
  {
    question: 'Do reps pay to join campaigns?',
    answer:
      'No. Marketplace campaigns are free for reps to join once they clear the quality gate. Brands fund payouts; reps get paid for approved results via Stripe Connect (Billing / Earnings).',
    links: [
      { href: '/gigs', label: 'Browse brand deals' },
      { href: '/sign-up?role=REP', label: 'Start getting paid' },
    ],
  },
  {
    question: 'What do I need before applying to a campaign?',
    answer: applyGateAnswer,
    links: [
      { href: '/for/reps', label: 'Rep path' },
      { href: '/gigs', label: 'Open brand deals' },
      { href: '/sign-up?role=REP', label: 'Sign up as a rep' },
    ],
  },
  {
    question: 'How do brand payouts work?',
    answer:
      'Brands pay verified outcomes and optional base pay (weekly, bi-weekly, or monthly) via Stripe Connect. ColdCallReps keeps 20% as the platform fee, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base — the rest goes to the rep. Founders fund campaigns; reps finish Connect under Billing or Earnings before payouts can land.',
    links: [
      { href: '/for/brands', label: 'For brands' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/gigs', label: 'Open brand deals' },
    ],
  },
  {
    question: 'What counts as a booked meeting?',
    answer:
      'A booked meeting is a claimed outcome that passes AI post-call audit — typically a calendar hold with a qualified decision-maker, supported by notes or transcript. Claims without enough evidence do not pay.',
    links: [{ href: '/gigs', label: 'How brand deals pay' }],
  },
  {
    question: 'What are the campaign payout tiers?',
    answer: `Campaigns use flat tier bands per verified set (not bidding): ${tierBandSummary}. Rates depend on ICP difficulty and gatekeeper friction.`,
    links: [
      { href: '/gigs', label: 'Brand deals' },
      { href: '/for/brands', label: 'Post a campaign' },
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
