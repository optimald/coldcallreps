import {
  CAMPAIGN_TIERS,
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
} from '@/lib/campaign-tiers';
import { TRIAL_MINUTES } from '@/lib/product';
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
      'ColdCallReps recruits SDRs and appointment setters onto MarketPounce. You practice with AI voice, prove your score, then dial brand-provided leads on paid campaigns. Humans place every live call — AI trains and audits. Accounts are free; you earn per verified appointment or qualified lead.',
    links: [
      { href: '/for/reps', label: 'SDR path' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free' },
    ],
  },
  {
    question: 'Do I have to find my own clients and leads?',
    answer:
      'No. Brands provide the clients and lead lists. After you clear the quality gate and a brand accepts you, you dial their never-contacted prospects — you do not hunt your own pipeline.',
    links: [
      { href: '/for/reps', label: 'SDR path' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free' },
    ],
  },
  {
    question: 'Do I pay to practice, unlock Resume, or join campaigns?',
    answer: `No. The free tier is generous on purpose — new accounts get ${TRIAL_MINUTES}+ free practice minutes, meant to cover training end-to-end (including unlocking Resume and clearing the gate). Brand campaigns stay $0 for reps. Buying extra minutes is only if you burn through free and want more practice — never required to earn. The point is for you to earn money, not spend it.`,
    links: [
      { href: '/pricing', label: 'Free to train' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Sign up as a rep' },
    ],
  },
  {
    question: 'Do I pay a platform fee when I get brands?',
    answer:
      'No join fee and no extra platform fee to accept brand deals. Brands fund escrow. When a verified appointment or qualified lead pays out, MarketPounce keeps a small capped commission from that payout (20%, capped at $30 per outcome) — like a marketplace cut, not a bill you pay up front. The rest goes to you.',
    links: [
      { href: '/pricing', label: 'See fee caps' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start getting paid' },
    ],
  },
  {
    question: 'How do I get paid — through the platform or from brands directly?',
    answer:
      'Through the platform, similar to Fiverr: brands fund escrow on MarketPounce, you deliver verified results, and payouts land with you. Stripe Connect is live where Stripe supports your country. Remitly payouts — coming soon. Brands do not pay you outside the platform for campaign outcomes.',
    links: [
      { href: '/guides/get-paid-per-meeting-cold-calling', label: 'Get paid per meeting' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free' },
    ],
  },
  {
    question: 'What do I earn?',
    answer: `Pay is per verified booked meeting or qualified lead — typically about $30–$40 per appointment set on many B2B campaigns, and higher on mid-market or enterprise deals. Exact rates are set per brand. There is no hard earning ceiling. Optional base pay stacks on some campaigns. ${tierBandSummary}.`,
    links: [
      { href: '/pricing', label: 'Free to train' },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse brand deals' },
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
    question: 'What counts as a booked meeting?',
    answer:
      'A booked meeting is a claimed outcome that passes AI post-call audit — typically a calendar hold with a qualified decision-maker, supported by notes or transcript. Claims without enough evidence do not pay.',
    links: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'How brand deals pay' }],
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
