/**
 * Guides content registry — single source of truth for the /guides hub,
 * sitemap entries, llms.txt, internal linking, and per-guide FAQ JSON-LD.
 *
 * CCR owns rep-recruiting guides only. Brand-hire / trust-mechanics guides
 * permanent-redirect to MarketPounce (see next.config.ts).
 *
 * Claims about fees, escrow, payouts, and outcomes must trace to
 * src/lib/platform-fees.ts, src/lib/product.ts, src/lib/campaign-tiers.ts,
 * and public/llms.txt. Do not invent pricing here.
 */

import { MARKETPOUNCE_ORIGIN, MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import { SITE_ORIGIN } from '@/lib/site';

export type GuideCategoryId = 'rep-earn';

export type GuideCta = {
  href: string;
  label: string;
  /** Primary CTAs render as filled buttons. */
  primary?: boolean;
};

export type GuideFaqLink = {
  href: string;
  label: string;
};

export type GuideFaqItem = {
  question: string;
  /** Plain-text answer — used by both the visible FAQ and FAQPage JSON-LD. */
  answer: string;
  links?: readonly GuideFaqLink[];
};

export type Guide = {
  slug: string;
  category: GuideCategoryId;
  /**
   * Browser title segment. `buildGuideMetadata` emits an absolute title:
   * `${title} | Cold Call Reps`.
   */
  title: string;
  /** Meta description. */
  description: string;
  /** On-page H1. */
  h1: string;
  /** One-line task summary for the hub cards. */
  oneLiner: string;
  /** Direct answer shown in the first screen. */
  directAnswer: string;
  /** Related guide slugs (linking matrix). */
  related: string[];
  /** Product CTAs (linking matrix). */
  ctas: GuideCta[];
  /** Search intent keywords (metadata). */
  keywords: string[];
  faqs: readonly GuideFaqItem[];
  publishedAt: string;
  updatedAt: string;
  nextReviewAt: string;
};

export type GuideCategory = {
  id: GuideCategoryId;
  label: string;
  blurb: string;
};

export const GUIDES_PUBLISHED_AT = '2026-07-16';
export const GUIDES_UPDATED_AT = '2026-09-22';
export const GUIDES_NEXT_REVIEW_AT = '2026-12-22';

const base = {
  publishedAt: GUIDES_PUBLISHED_AT,
  updatedAt: GUIDES_UPDATED_AT,
  nextReviewAt: GUIDES_NEXT_REVIEW_AT,
};

const MP_FEES = `${MARKETPOUNCE_ORIGIN}/guides/platform-fees-and-payouts`;
const MP_CAMPAIGNS = `${MARKETPOUNCE_ORIGIN}/guides/how-campaigns-work`;

export const GUIDE_CATEGORIES: readonly GuideCategory[] = [
  {
    id: 'rep-earn',
    label: 'Earn as a rep',
    blurb:
      'For SDRs and appointment setters who want to train, get approved, and get paid for booked meetings and qualified leads.',
  },
] as const;

export const GUIDES: readonly Guide[] = [
  {
    ...base,
    slug: 'cold-calling-gigs',
    category: 'rep-earn',
    title: 'Cold Calling Gigs Online — Get Paid Per Meeting',
    description:
      'Find paid cold calling gigs online with Cold Call Reps. Train with AI voice, clear the quality gate, dial brand deals, and get paid per booked meeting or qualified lead.',
    h1: 'Cold calling gigs: how to find paid campaigns',
    oneLiner: 'Find paid cold calling campaigns online.',
    directAnswer:
      'Cold calling gigs on Cold Call Reps follow one path: train with AI voice practice, apply to a brand campaign through the quality gate, dial live prospects, then claim your outcomes. Joining campaigns is free for reps — you get paid via Stripe Connect for booked meetings and qualified leads that pass audit.',
    related: [
      'get-paid-per-meeting-cold-calling',
      'ai-cold-call-practice',
      'sdr-applications-and-approval',
    ],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free — get paid', primary: true },
      { href: '/', label: 'Cold Call Reps home' },
      { href: '/for/reps', label: 'SDR path' },
    ],
    keywords: [
      'cold calling gigs',
      'cold calling jobs remote',
      'appointment setting gigs',
      'sdr gigs online',
      'get paid per meeting',
    ],
    faqs: [
      {
        question: 'Do I have to pay to take a cold calling gig?',
        answer:
          'No. Joining and running brand campaigns is free for reps once you clear the quality gate. Brands fund payouts. Optional paid practice is never required to earn.',
        links: [
          { href: '/pricing', label: 'Free to train' },
          { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Open brand deals' },
        ],
      },
      {
        question: 'Can I do this remotely / outside the US?',
        answer:
          'Yes. Signup is global, including the Philippines and other remote markets. You practice and dial from anywhere and get paid through Stripe Connect where it is supported.',
      },
      {
        question: 'How do I get paid?',
        answer:
          'You claim outcomes (a booked meeting or a qualified lead). Once a claim passes the AI post-call audit, the payout releases from the brand’s escrow to your Stripe Connect account, minus the platform fee.',
        links: [{ href: '/guides/get-paid-per-meeting-cold-calling', label: 'How reps get paid' }],
      },
      {
        question: 'What do I need before I can apply to a gig?',
        answer:
          'Campaigns use an apply gate: by default, complete at least one practice session on the brand pack, score at least 80, and earn brand certification. Exact thresholds vary by campaign, but practice and proof always come first.',
        links: [{ href: '/guides/sdr-applications-and-approval', label: 'Applications & approval' }],
      },
      {
        question: 'How much can I earn per gig?',
        answer:
          'Payouts are flat tier bands per verified set: High Volume $35–$60, Mid-Market $75–$120, and Enterprise $150–$250+ per set, depending on ICP difficulty and gatekeeper friction. Some campaigns stack optional base pay on top.',
        links: [{ href: '/guides/get-paid-per-meeting-cold-calling', label: 'Earning mechanics' }],
      },
    ],
  },
  {
    ...base,
    slug: 'get-paid-per-meeting-cold-calling',
    category: 'rep-earn',
    title: 'Get Paid Per Meeting Cold Calling — SDR Earnings',
    description:
      'Get paid per meeting cold calling on Cold Call Reps: booked meetings, qualified leads, tiered accelerators, and optional base pay via Stripe Connect from funded escrow.',
    h1: 'How to get paid per meeting cold calling',
    oneLiner: 'How reps earn on booked meetings and qualified leads.',
    directAnswer:
      'Reps get paid per outcome: a booked meeting or a qualified lead, with tiered accelerators and optional base pay that stacks on top. You claim each outcome, it passes an AI post-call audit, and the payout releases from the brand’s funded escrow to your Stripe Connect account, minus the 20% platform fee (capped at $30 per outcome).',
    related: ['cold-calling-gigs', 'ai-cold-call-practice', 'sdr-applications-and-approval'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start earning', primary: true },
      { href: '/', label: 'Cold Call Reps home' },
      { href: '/guides/cold-calling-gigs', label: 'Find cold calling gigs' },
    ],
    keywords: [
      'get paid cold calling per meeting',
      'appointment setter pay',
      'sdr commission per meeting',
      'cold calling income',
      'Cold Call Reps earnings',
    ],
    faqs: [
      {
        question: 'What outcomes actually pay?',
        answer:
          'Two outcome types pay: a booked meeting (a calendar hold with a qualified decision-maker) and a qualified lead. Both must pass the AI post-call audit with supporting notes or transcript before escrow releases.',
      },
      {
        question: 'How much do I keep after fees?',
        answer:
          'The platform fee is 20% of your payout, capped at $30 per outcome. On a $75 booked meeting the fee is $15, so you keep $60. On base pay, caps are $40/wk, $75/bi-weekly, or $150/mo.',
        links: [{ href: MP_FEES, label: 'Fees & payouts (MarketPounce)' }],
      },
      {
        question: 'Is there a base pay or just commission?',
        answer:
          'Some campaigns offer optional base pay (weekly, bi-weekly, or monthly) that stacks on top of per-outcome pay. Many are outcome-only. Each campaign shows its structure before you apply.',
      },
      {
        question: 'Is there an earning ceiling?',
        answer:
          'No hard ceiling on outcome pay — earnings scale with how skilled, fast, and consistent you are. Tiered accelerators reward volume and quality within a campaign.',
        links: [{ href: '/for/reps', label: 'For reps' }],
      },
      {
        question: 'How fast do I get paid?',
        answer:
          'Payout releases once your claim passes audit and your Stripe Connect account is set up. Finish Connect onboarding under Billing or Earnings first, or approved payouts cannot land.',
      },
    ],
  },
  {
    ...base,
    slug: 'ai-cold-call-practice',
    category: 'rep-earn',
    title: 'AI Cold Call Practice & Simulator — Train Free',
    description:
      'AI cold call practice and simulator on Cold Call Reps: rehearse gatekeepers and DMs with an AI voice trainer, hit your score, then unlock live brand dials. Humans dial live — AI is practice only.',
    h1: 'AI cold call practice before live dials',
    oneLiner: 'Use AI voice practice before dialing live brand campaigns.',
    directAnswer:
      'AI cold call practice on Cold Call Reps lets you rehearse gatekeeper and decision-maker scenarios with an AI voice trainer and live coach, then earn a score and certification that unlock live brand campaigns. The boundary is firm: AI is for practice, coaching, and claim audits only — every live brand call is placed by a human.',
    related: ['cold-calling-gigs', 'sdr-applications-and-approval', 'get-paid-per-meeting-cold-calling'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start practicing free', primary: true },
      { href: '/', label: 'Cold Call Reps home' },
      { href: '/pricing', label: 'Free to train' },
    ],
    keywords: [
      'ai cold call practice',
      'ai cold call simulator',
      'cold call roleplay ai',
      'ai sales trainer voice',
      'sdr practice simulator',
      'Cold Call Reps AI practice',
    ],
    faqs: [
      {
        question: 'Does the AI make real calls for me?',
        answer:
          'No. The AI is a practice partner and coach — it runs roleplay scenarios, scores you, and audits claims. Cold Call Reps is not an autodialer, and all live brand calls are placed by human reps.',
      },
      {
        question: 'What can I practice?',
        answer:
          'Scenarios include gatekeeper navigation, decision-maker conversations, pricing objections, and rejection recovery. Practice builds the score and certification you need to apply to campaigns.',
        links: [{ href: '/guides/sdr-applications-and-approval', label: 'Applications & approval' }],
      },
      {
        question: 'Do I pay to practice?',
        answer:
          'Practice and campaigns are free for reps. Brands fund escrow and pay you for verified results. Optional paid practice is only for teams or heavy AI use — never required to earn.',
        links: [{ href: '/pricing', label: 'Free to train' }],
      },
      {
        question: 'How does practice help me get approved?',
        answer:
          'Campaigns gate on practice: by default at least one practice session on the brand pack, a score of at least 80, and brand certification. Practice is how you prove you are ready before you apply.',
      },
      {
        question: 'Do I keep practicing after I go live?',
        answer:
          'Most reps do. Ongoing practice keeps scores high, warms you up before live blocks, and helps you qualify for higher-tier campaigns and accelerators.',
        links: [{ href: '/guides/get-paid-per-meeting-cold-calling', label: 'Earning mechanics' }],
      },
    ],
  },
  {
    ...base,
    slug: 'sdr-applications-and-approval',
    category: 'rep-earn',
    title: 'SDR Applications & Approval — Clear the Quality Gate',
    description:
      'How SDR applications and campaign approval work on Cold Call Reps: practice score, brand certification, what brands see, and how to get approved for paid dials.',
    h1: 'SDR applications and approval',
    oneLiner: 'How rep applications, the quality gate, and access work.',
    directAnswer:
      'To get approved for a campaign on Cold Call Reps, a rep clears an apply gate — by default at least one practice session on the brand pack, a score of at least 80, and brand certification — then applies. Brands see your score, certification, and profile and approve or decline. Approval unlocks live dialing on that campaign.',
    related: ['cold-calling-gigs', 'ai-cold-call-practice', 'get-paid-per-meeting-cold-calling'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start your application path', primary: true },
      { href: '/', label: 'Cold Call Reps home' },
      { href: '/guides/ai-cold-call-practice', label: 'AI practice first' },
    ],
    keywords: [
      'sdr campaign application process',
      'cold calling application approval',
      'appointment setter application',
      'how to get approved sdr gig',
      'Cold Call Reps quality gate',
    ],
    faqs: [
      {
        question: 'What is the apply gate?',
        answer:
          'The apply gate is the quality bar before you can join a campaign: by default, complete at least one practice session on the brand pack, score at least 80, and earn brand certification. Exact thresholds can vary by campaign.',
      },
      {
        question: 'What do brands see when I apply?',
        answer:
          'Brands see your practice score, certification status, and public profile. Strong, consistent scores and completed certification make approval more likely.',
        links: [{ href: '/guides/ai-cold-call-practice', label: 'AI practice' }],
      },
      {
        question: 'Why would an application be declined?',
        answer:
          'Common reasons are not meeting the score threshold, missing certification for the brand pack, or an incomplete profile. Practicing to a higher score and finishing certification is the fastest way to improve odds.',
      },
      {
        question: 'Is applying free?',
        answer:
          'Yes. Applying to and running campaigns is free for reps. Brands fund the tool. Optional paid practice is only for teams or heavy AI use — never required to earn.',
        links: [{ href: '/pricing', label: 'Free to train' }],
      },
      {
        question: 'What happens after I am approved?',
        answer:
          'Approval unlocks live dialing for that campaign. You dial real prospects, submit outcome claims, and — after the AI audit passes — get paid from escrow via Stripe Connect.',
        links: [
          { href: MP_CAMPAIGNS, label: 'How campaigns work (MarketPounce)' },
          { href: '/guides/get-paid-per-meeting-cold-calling', label: 'How reps get paid' },
        ],
      },
    ],
  },
] as const;

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getGuidesByCategory(category: GuideCategoryId): Guide[] {
  return GUIDES.filter((g) => g.category === category);
}

export function getRelatedGuides(slug: string): Guide[] {
  const guide = getGuide(slug);
  if (!guide) return [];
  return guide.related
    .map((s) => getGuide(s))
    .filter((g): g is Guide => Boolean(g));
}

export function guidePath(slug: string): string {
  return `/guides/${slug}`;
}

/** FAQPage JSON-LD built from the same copy shown on the page. */
export function guideFaqJsonLd(guide: Guide, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url,
    mainEntity: guide.faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/** Next.js Metadata for a guide page. */
export function buildGuideMetadata(slug: string) {
  const guide = getGuide(slug);
  if (!guide) return { title: 'Guide not found' };
  const url = `${SITE_ORIGIN}${guidePath(slug)}`;
  const absoluteTitle = `${guide.title} | Cold Call Reps`;
  return {
    title: { absolute: absoluteTitle },
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: absoluteTitle,
      description: guide.description,
      url,
      type: 'article' as const,
      images: [{ url: '/og.svg', width: 1200, height: 630 }],
    },
  };
}

/** WebPage JSON-LD for a guide. */
export function guideWebPageJsonLd(guide: Guide, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Cold Call Reps',
      url: SITE_ORIGIN,
    },
    about: { '@type': 'Thing', name: 'Cold calling marketplace' },
    inLanguage: 'en',
  };
}
