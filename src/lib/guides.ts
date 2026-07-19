/**
 * Guides content registry — single source of truth for the /guides hub,
 * sitemap entries, llms.txt, internal linking, and per-guide FAQ JSON-LD.
 *
 * Claims about fees, escrow, payouts, and outcomes must trace to
 * src/lib/platform-fees.ts, src/lib/product.ts, src/lib/campaign-tiers.ts,
 * and public/llms.txt. Do not invent pricing here.
 */

import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

export type GuideCategoryId = 'brand-hire' | 'rep-earn' | 'trust-mechanics';

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
  /** Metadata + browser title (root layout appends " | ColdCallReps"). */
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
export const GUIDES_UPDATED_AT = '2026-07-16';
export const GUIDES_NEXT_REVIEW_AT = '2026-10-14';

const base = {
  publishedAt: GUIDES_PUBLISHED_AT,
  updatedAt: GUIDES_UPDATED_AT,
  nextReviewAt: GUIDES_NEXT_REVIEW_AT,
};

export const GUIDE_CATEGORIES: readonly GuideCategory[] = [
  {
    id: 'brand-hire',
    label: 'Hire cold callers',
    blurb:
      'For brands and founders buying first-touch dials with outcome-based pay instead of a full-time SDR salary.',
  },
  {
    id: 'rep-earn',
    label: 'Earn as a rep',
    blurb:
      'For SDRs and appointment setters who want to train, get approved, and get paid for booked meetings and qualified leads.',
  },
  {
    id: 'trust-mechanics',
    label: 'Trust & mechanics',
    blurb:
      'How the money moves: escrow, claim audits, the 20% platform fee with caps, and Stripe Connect payouts.',
  },
] as const;

export const GUIDES: readonly Guide[] = [
  {
    ...base,
    slug: 'hire-cold-callers',
    category: 'brand-hire',
    title: 'How to Hire Cold Callers (Outcome-Based Pay)',
    description:
      'Hire human cold callers for first-touch dials and pay per booked meeting or qualified lead. How Cold Call Reps uses escrow and an application-gated rep pool.',
    h1: 'How to hire cold callers',
    oneLiner: 'Hire humans for first-touch dials with outcome-based pay.',
    directAnswer:
      'To hire cold callers on Cold Call Reps, you post a campaign, fund escrow, and application-gated reps dial your never-contacted list. You pay for verified outcomes — a booked meeting or a qualified lead — not for hours or the close. Humans place every live dial; AI is used only for practice and claim audits.',
    related: [
      'campaign-escrow-and-claims',
      'pay-per-appointment-setting',
      'appointment-setting-marketplace',
      'cold-call-reps-vs-outbound-agency',
    ],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free as an SDR', primary: true },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'See open brand deals' },
    ],
    keywords: [
      'hire cold callers',
      'hire cold calling',
      'outbound sdr for hire',
      'pay per meeting cold calling',
    ],
    faqs: [
      {
        question: 'Do I pay per hour or per result?',
        answer:
          'You pay per verified result. Brands set an outcome payout — per booked meeting or per qualified lead — and optionally add base pay (weekly, bi-weekly, or monthly). You are not billed for dial time or for closing the deal.',
        links: [
          { href: '/guides/pay-per-appointment-setting', label: 'Pay-per-appointment model' },
          { href: '/pricing', label: 'Pricing' },
        ],
      },
      {
        question: 'Are the callers human or AI?',
        answer:
          'Every live brand call is placed by a human rep. AI on Cold Call Reps is limited to voice practice, coaching, and post-call claim audits. It is not an autodialer and never places live calls on your behalf.',
      },
      {
        question: 'How are reps vetted before they dial for me?',
        answer:
          'Campaigns use an apply gate. By default a rep must complete at least one practice session on your pack, score at least 80, and earn brand certification before they can be approved to dial. You review and approve applicants.',
        links: [{ href: '/guides/sdr-applications-and-approval', label: 'Applications & approval' }],
      },
      {
        question: 'What protects my money if nothing gets booked?',
        answer:
          'Funds sit in campaign escrow and only release on a claim that passes the AI post-call audit. If a claim lacks evidence of a qualified, booked outcome, it does not pay.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
      {
        question: 'What does it cost beyond rep payouts?',
        answer:
          'Cold Call Reps keeps a 20% platform fee on rep payouts, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base pay. For example, a $75 booked meeting costs $15 in platform fee.',
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
      },
    ],
  },
  {
    ...base,
    slug: 'cold-calling-gigs',
    category: 'rep-earn',
    title: 'Cold Calling Gigs: Find Paid Campaigns Online',
    description:
      'Find paid cold calling gigs and appointment-setting campaigns. Train with AI voice, apply through the quality gate, dial live, and get paid per result on Cold Call Reps.',
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
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse brand deals' },
    ],
    keywords: [
      'cold calling gigs',
      'cold calling jobs remote',
      'appointment setting gigs',
      'sdr gigs online',
    ],
    faqs: [
      {
        question: 'Do I have to pay to take a cold calling gig?',
        answer:
          'No. Joining and running brand campaigns is free for reps once you clear the quality gate. Paid plans buy AI practice minutes and coaching tools — they are not required to earn on campaigns.',
        links: [
          { href: '/pricing', label: 'See pricing' },
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
    slug: 'campaign-escrow-and-claims',
    category: 'trust-mechanics',
    title: 'Campaign Escrow & Claims: How Payouts Are Verified',
    description:
      'How Cold Call Reps escrow, claim audits, and disputes work. The fund → dial → verify → pay flow that protects brands and reps on booked meetings and qualified leads.',
    h1: 'Campaign escrow and claims',
    oneLiner: 'How brand escrow, claim audit, and disputes work.',
    directAnswer:
      'Escrow on Cold Call Reps holds a brand’s campaign budget until a rep’s outcome is verified. The flow is fund → dial → claim → audit → pay: brands fund escrow up front, reps dial and submit claims, an AI post-call audit checks the evidence, and only passing claims release money to the rep via Stripe Connect.',
    related: ['platform-fees-and-payouts', 'how-campaigns-work', 'hire-cold-callers'],
    ctas: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start earning', primary: true }],
    keywords: [
      'cold calling escrow marketplace',
      'appointment setting escrow',
      'sdr payout verification',
      'outbound claim audit',
    ],
    faqs: [
      {
        question: 'What is campaign escrow?',
        answer:
          'Campaign escrow is the funded budget a brand sets aside before reps dial. Money is committed but not released until a claimed outcome passes audit, so reps know the budget is real and brands only pay for verified results.',
      },
      {
        question: 'What happens when a rep submits a claim?',
        answer:
          'The claim goes through an AI post-call audit that checks for evidence of a qualified, booked outcome — typically a calendar hold with a qualified decision-maker plus notes or transcript. Passing claims release payout; weak claims do not pay.',
        links: [{ href: '/guides/get-paid-per-meeting-cold-calling', label: 'What counts as an outcome' }],
      },
      {
        question: 'What counts as a booked meeting?',
        answer:
          'A booked meeting is a claimed outcome that passes AI post-call audit — typically a calendar hold with a qualified decision-maker, supported by notes or transcript. Claims without enough evidence do not pay.',
      },
      {
        question: 'Who keeps the money if a claim fails?',
        answer:
          'Unreleased escrow stays with the brand’s campaign budget. Reps are paid only for claims that pass audit, and brands are not charged for outcomes that fail verification.',
      },
      {
        question: 'How much of the payout does the platform take?',
        answer:
          'Cold Call Reps keeps a 20% platform fee on rep payouts, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base pay. The rest goes to the rep.',
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
      },
    ],
  },
  {
    ...base,
    slug: 'platform-fees-and-payouts',
    category: 'trust-mechanics',
    title: 'Platform Fees & Payouts: The 20% Fee, Caps, and Stripe',
    description:
      'What the 20% Cold Call Reps platform fee, hard caps, and Stripe Connect payouts mean in practice — with worked examples for outcomes and base pay.',
    h1: 'Platform fees and payouts',
    oneLiner: 'What the 20% fee, caps, and Stripe payouts mean in practice.',
    directAnswer:
      'Cold Call Reps charges a 20% platform fee on SDR payouts, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base pay. Reps keep the rest. Payouts run through Stripe Connect and release from campaign escrow when a claim passes audit. Example: a $75 booked meeting costs $15 in fee; a $2,000/mo base costs $150, not $400.',
    related: ['campaign-escrow-and-claims', 'get-paid-per-meeting-cold-calling', 'how-campaigns-work'],
    ctas: [{ href: '/pricing', label: 'See full pricing', primary: true }],
    keywords: [
      'cold call reps fees',
      'appointment setting platform fees',
      'sdr payout fees',
      'stripe connect payouts',
    ],
    faqs: [
      {
        question: 'How much is the platform fee?',
        answer:
          'The platform fee is 20% of SDR payouts. It is capped at $30 per outcome payout and at $40/wk, $75/bi-weekly, or $150/mo on base pay, so large payouts are never extractive.',
      },
      {
        question: 'Can you show a worked example?',
        answer:
          'A $75 booked meeting incurs a $15 fee (20%), under the $30 cap, so the rep keeps $60. A $2,000/mo base would be $400 at a flat 20%, but the monthly cap holds the fee at $150.',
      },
      {
        question: 'Do reps or brands pay the fee?',
        answer:
          'The 20% fee is taken from the SDR payout. Brands fund the outcome and base amounts they set; the platform fee is deducted from the rep’s side of the payout.',
      },
      {
        question: 'How do payouts actually reach reps?',
        answer:
          'Payouts run through Stripe Connect. Reps finish Connect onboarding under Billing or Earnings before payouts can land, then verified outcomes release from campaign escrow to their account.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
      {
        question: 'Does base pay stack with outcome pay?',
        answer:
          'Yes. Campaigns can offer optional base pay (weekly, bi-weekly, or monthly) that stacks on top of per-outcome payouts. Each has its own fee cap — $30 per outcome and the cadence-based cap on base.',
        links: [{ href: '/guides/get-paid-per-meeting-cold-calling', label: 'Earning mechanics' }],
      },
    ],
  },
  {
    ...base,
    slug: 'pay-per-appointment-setting',
    category: 'brand-hire',
    title: 'Pay-Per-Appointment Setting vs Salary SDRs',
    description:
      'When pay-per-appointment beats a salaried SDR. A cost model comparing outcome-based appointment setting and in-house salary, with escrow risk built in.',
    h1: 'Pay-per-appointment setting: when it beats a salary SDR',
    oneLiner: 'When pay-per-meeting beats hiring a salaried SDR.',
    directAnswer:
      'Pay-per-appointment setting means you pay only when a rep books a qualified meeting, instead of paying a fixed SDR salary regardless of results. On Cold Call Reps you set an outcome payout, fund escrow, and pay per verified meeting — so your cost scales with results and unbooked dials do not drain payroll.',
    related: ['hire-cold-callers', 'platform-fees-and-payouts', 'hire-outbound-without-in-house-sdr'],
    ctas: [
      { href: '/pricing', label: 'See pricing', primary: true },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Join as an SDR' },
    ],
    keywords: [
      'pay per appointment setting',
      'pay per meeting sdr',
      'appointment setting cost',
      'outcome based sdr pay',
    ],
    faqs: [
      {
        question: 'What is pay-per-appointment setting?',
        answer:
          'It is a compensation model where you pay a fixed amount per qualified meeting booked, rather than a salary or hourly rate. Cost tracks directly to booked outcomes instead of seat time.',
      },
      {
        question: 'When does it beat hiring a salaried SDR?',
        answer:
          'Pay-per-appointment wins when volume is variable, you are testing a new offer or market, or you cannot justify fixed payroll before you see booked meetings. A salaried SDR can win at high, steady volume where fixed cost per meeting drops below the per-outcome rate.',
        links: [{ href: '/guides/hire-outbound-without-in-house-sdr', label: 'In-house vs marketplace vs agency' }],
      },
      {
        question: 'How much does an appointment cost?',
        answer:
          'Campaign payouts use flat tier bands per verified set: High Volume $35–$60, Mid-Market $75–$120, and Enterprise $150–$250+. On top of the payout, the platform fee is 20%, capped at $30 per outcome.',
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
      },
      {
        question: 'What stops me paying for junk meetings?',
        answer:
          'Every claimed meeting passes an AI post-call audit before escrow releases. A booked meeting must show a qualified decision-maker and a calendar hold with supporting notes or transcript, so weak claims do not pay.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
      {
        question: 'Can I add base pay to attract stronger reps?',
        answer:
          'Yes. You can stack optional base pay (weekly, bi-weekly, or monthly) on top of per-meeting payouts. Base pay has its own fee caps: $40/wk, $75/bi-weekly, $150/mo.',
      },
    ],
  },
  {
    ...base,
    slug: 'get-paid-per-meeting-cold-calling',
    category: 'rep-earn',
    title: 'Get Paid Per Meeting: How Reps Earn Cold Calling',
    description:
      'How reps earn on Cold Call Reps: per booked meeting, per qualified lead, tiered accelerators, and optional base pay — paid via Stripe Connect from funded escrow.',
    h1: 'How to get paid per meeting cold calling',
    oneLiner: 'How reps earn on booked meetings and qualified leads.',
    directAnswer:
      'Reps get paid per outcome: a booked meeting or a qualified lead, with tiered accelerators and optional base pay that stacks on top. You claim each outcome, it passes an AI post-call audit, and the payout releases from the brand’s funded escrow to your Stripe Connect account, minus the 20% platform fee (capped at $30 per outcome).',
    related: ['cold-calling-gigs', 'platform-fees-and-payouts', 'ai-cold-call-practice'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start earning', primary: true },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse brand deals' },
    ],
    keywords: [
      'get paid cold calling per meeting',
      'appointment setter pay',
      'sdr commission per meeting',
      'cold calling income',
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
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
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
    slug: 'how-campaigns-work',
    category: 'trust-mechanics',
    title: 'How Cold Call Campaigns Work (Post → Payout)',
    description:
      'The full Cold Call Reps campaign lifecycle from both sides: post, apply, dial, claim, audit, and payout — how brands and reps move through one timeline.',
    h1: 'How cold call campaigns work',
    oneLiner: 'End-to-end lifecycle: post → apply → dial → claim → payout.',
    directAnswer:
      'A Cold Call Reps campaign runs on one timeline: a brand posts a campaign and funds escrow, reps apply through the quality gate, approved reps dial live prospects, they claim outcomes, an AI audit verifies each claim, and payouts release from escrow via Stripe Connect. Humans place every live dial; AI handles practice and audits.',
    related: ['campaign-escrow-and-claims', 'platform-fees-and-payouts', 'sdr-applications-and-approval'],
    ctas: [
      { href: '/for/reps', label: 'SDR path', primary: true },
      { href: '/for/reps', label: 'For reps' },
    ],
    keywords: [
      'how cold call campaigns work',
      'outbound campaign lifecycle',
      'appointment setting process',
      'sdr marketplace workflow',
    ],
    faqs: [
      {
        question: 'What are the steps in a campaign?',
        answer:
          'Post and fund escrow, reps apply and clear the quality gate, brand approves reps, reps dial live prospects, reps claim outcomes, AI audits each claim, and passing claims pay out from escrow via Stripe Connect.',
      },
      {
        question: 'What does the brand do vs the rep?',
        answer:
          'Brands define the offer, list, outcome payout, and optional base pay, fund escrow, and approve applicants. Reps practice, apply, dial, and submit claims. The platform runs the gate, the audit, and the payout rails.',
      },
      {
        question: 'Where does the AI fit in?',
        answer:
          'AI powers voice practice, live coaching, the quality gate scoring, and the post-call claim audit. It never places live brand calls — humans do all live dialing.',
        links: [{ href: '/guides/ai-cold-call-practice', label: 'AI practice vs live dials' }],
      },
      {
        question: 'How long before dials start?',
        answer:
          'Once a campaign is funded and reps clear the apply gate, approved reps can begin dialing. Timing depends on how quickly reps practice to the required score and earn certification.',
        links: [{ href: '/guides/sdr-applications-and-approval', label: 'Applications & approval' }],
      },
      {
        question: 'When and how does money move?',
        answer:
          'Money is committed to escrow at funding and released per verified claim. Cold Call Reps keeps a 20% fee (capped at $30 per outcome; $40/$75/$150 on base) and the rest pays the rep via Stripe Connect.',
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
      },
    ],
  },
  {
    ...base,
    slug: 'ai-cold-call-practice',
    category: 'rep-earn',
    title: 'AI Cold Call Practice Before Live Brand Dials',
    description:
      'Use AI voice practice and coaching to prepare for live cold calls. Where the AI trainer ends and human dialing begins on Cold Call Reps.',
    h1: 'AI cold call practice before live dials',
    oneLiner: 'Use AI voice practice before dialing live brand campaigns.',
    directAnswer:
      'AI cold call practice on Cold Call Reps lets you rehearse gatekeeper and decision-maker scenarios with an AI voice trainer and live coach, then earn a score and certification that unlock live brand campaigns. The boundary is firm: AI is for practice, coaching, and claim audits only — every live brand call is placed by a human.',
    related: ['cold-calling-gigs', 'sdr-applications-and-approval', 'get-paid-per-meeting-cold-calling'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start practicing free', primary: true },
      { href: '/pricing', label: 'See practice plans' },
    ],
    keywords: [
      'ai cold call practice',
      'cold call roleplay ai',
      'ai sales trainer voice',
      'sdr practice simulator',
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
        question: 'How much does practice cost?',
        answer:
          'Free includes practice minutes to start. Starter is $7/mo and Pro is $29/mo for more minutes and coaching tools. Running brand campaigns stays free for reps — plans only buy practice.',
        links: [{ href: '/pricing', label: 'See pricing' }],
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
    slug: 'appointment-setting-marketplace',
    category: 'brand-hire',
    title: 'What Is an Appointment-Setting Marketplace?',
    description:
      'What an appointment-setting marketplace is, how it differs from an agency, and a buyer checklist covering escrow, human dialing, and outcome definitions.',
    h1: 'What is an appointment-setting marketplace?',
    oneLiner: 'What an appointment-setting marketplace is and when to use one.',
    directAnswer:
      'An appointment-setting marketplace connects brands directly with vetted human reps who book meetings for outcome-based pay, with the platform handling vetting, escrow, and payouts. Cold Call Reps is one: brands fund escrow, application-gated reps dial, and money releases only on verified outcomes — no retainer and no agency middle layer.',
    related: [
      'hire-cold-callers',
      'cold-call-reps-vs-outbound-agency',
      'pay-per-appointment-setting',
    ],
    ctas: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free as an SDR', primary: true }],
    keywords: [
      'appointment setting marketplace',
      'sdr marketplace',
      'outbound marketplace',
      'freelance appointment setters',
    ],
    faqs: [
      {
        question: 'How is a marketplace different from an agency?',
        answer:
          'A marketplace connects you directly with individual vetted reps and pays them per verified outcome through escrow. An agency wraps reps in a managed service with a retainer or monthly fee. Marketplaces trade some hand-holding for lower fixed cost and direct control.',
        links: [{ href: '/guides/cold-call-reps-vs-outbound-agency', label: 'Marketplace vs agency' }],
      },
      {
        question: 'Who actually makes the calls?',
        answer:
          'Human reps. On Cold Call Reps, application-gated reps place every live dial. AI is used only for their practice, coaching, and claim audits — not for live calling.',
      },
      {
        question: 'What should I check before choosing one?',
        answer:
          'Use a buyer checklist: is there real escrow, are callers human, is the outcome (booked meeting or qualified lead) clearly defined and audited, and how are fees structured. Cold Call Reps answers all four with funded escrow, human dialing, audited outcomes, and a capped 20% fee.',
      },
      {
        question: 'When should I use a marketplace instead of hiring?',
        answer:
          'Use a marketplace when you want outbound started quickly, variable volume, or to validate an offer before committing to payroll. Hire in-house when volume is high and steady enough to justify fixed cost.',
        links: [{ href: '/guides/hire-outbound-without-in-house-sdr', label: 'Hire without an SDR' }],
      },
      {
        question: 'How do payouts stay fair to both sides?',
        answer:
          'Escrow protects the brand (money releases only on verified outcomes) and the rep (the budget is funded before they dial). The platform fee is a flat 20%, capped at $30 per outcome.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
    ],
  },
  {
    ...base,
    slug: 'hire-outbound-without-in-house-sdr',
    category: 'brand-hire',
    title: 'Run Outbound Without Hiring an In-House SDR',
    description:
      'How to run outbound without a full-time SDR hire first. A decision tree comparing in-house, marketplace, and agency — with cost and control trade-offs.',
    h1: 'How to run outbound without an in-house SDR',
    oneLiner: 'Run outbound before committing to a full-time SDR hire.',
    directAnswer:
      'You can run outbound without hiring an in-house SDR by using an outcome-based marketplace: post a campaign, fund escrow, and pay vetted human reps per booked meeting or qualified lead. This validates your offer and pipeline before you commit to fixed salary, benefits, and ramp time.',
    related: ['hire-cold-callers', 'pay-per-appointment-setting', 'cold-call-reps-vs-outbound-agency'],
    ctas: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free as an SDR', primary: true }],
    keywords: [
      'hire outbound without sdr team',
      'outbound without hiring sdr',
      'fractional sdr alternative',
      'validate outbound before hiring',
    ],
    faqs: [
      {
        question: 'Should I build in-house, use a marketplace, or hire an agency?',
        answer:
          'Use the decision tree: if volume is high and steady and you can fund ramp, in-house may be cheapest per meeting. If you want speed, variable volume, and direct control, use a marketplace. If you need full managed service and will pay a retainer for it, an agency fits. Many teams start on a marketplace and hire in-house once volume justifies it.',
        links: [{ href: '/guides/cold-call-reps-vs-outbound-agency', label: 'Marketplace vs agency' }],
      },
      {
        question: 'What does an in-house SDR really cost before results?',
        answer:
          'A salaried SDR carries fixed cost — salary, tooling, and ramp — that you pay regardless of booked meetings. Outcome-based marketplace pay only charges you when a meeting is verified, so risk shifts off payroll.',
        links: [{ href: '/guides/pay-per-appointment-setting', label: 'Pay-per-appointment model' }],
      },
      {
        question: 'How fast can I start dialing?',
        answer:
          'Once you post and fund a campaign, application-gated reps can apply and, after clearing the quality gate, begin dialing — far faster than recruiting, hiring, and ramping a full-time SDR.',
      },
      {
        question: 'Is quality worse without an in-house team?',
        answer:
          'Reps are gated by practice score and brand certification, and every outcome is audited before it pays. You approve applicants and only pay for verified results, so quality control is built into the flow.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
      {
        question: 'Can I move to in-house later?',
        answer:
          'Yes. Many brands use the marketplace to prove the motion and messaging, then hire in-house once volume is high and steady enough to make fixed cost per meeting cheaper.',
      },
    ],
  },
  {
    ...base,
    slug: 'cold-call-reps-vs-outbound-agency',
    category: 'brand-hire',
    title: 'Cold Call Reps vs an Outbound Agency',
    description:
      'A factual comparison of the Cold Call Reps marketplace and a traditional outbound agency: cost structure, control, speed, and how escrow changes the risk.',
    h1: 'Cold Call Reps vs an outbound agency',
    oneLiner: 'Marketplace vs outbound agency — a factual comparison.',
    directAnswer:
      'Cold Call Reps is an outcome-based marketplace: you pay vetted human reps per verified meeting through escrow, with no retainer. A traditional outbound agency is a managed service you pay via retainer or monthly fee regardless of booked meetings. The core trade-off is fixed managed service (agency) versus variable, escrow-backed, pay-per-outcome cost with direct control (marketplace).',
    related: ['appointment-setting-marketplace', 'pay-per-appointment-setting', 'hire-outbound-without-in-house-sdr'],
    ctas: [{ href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free as an SDR', primary: true }],
    keywords: [
      'cold call reps vs agency',
      'sdr marketplace vs agency',
      'appointment setting agency alternative',
      'outbound agency comparison',
    ],
    faqs: [
      {
        question: 'What is the main difference in cost structure?',
        answer:
          'An agency typically charges a retainer or monthly fee whether or not meetings get booked. Cold Call Reps charges per verified outcome plus a capped 20% platform fee, so cost scales with results instead of a fixed retainer.',
        links: [{ href: '/guides/platform-fees-and-payouts', label: 'Fees & payouts' }],
      },
      {
        question: 'Which gives me more control?',
        answer:
          'On the marketplace you set the offer, list, outcome definition, and payout, and you approve individual reps. Agencies manage reps for you, which means less day-to-day control in exchange for done-for-you service.',
      },
      {
        question: 'Which is faster to start?',
        answer:
          'A marketplace can start once a campaign is funded and reps clear the gate. Agencies often require onboarding, contracts, and ramp before dials begin.',
      },
      {
        question: 'How does escrow change the risk?',
        answer:
          'Escrow releases only on outcomes that pass audit, so the brand’s risk is tied to verified meetings rather than a prepaid retainer. Reps also know the budget is funded before they dial.',
        links: [{ href: '/guides/campaign-escrow-and-claims', label: 'Escrow & claims' }],
      },
      {
        question: 'Is a marketplace always the right choice?',
        answer:
          'No. If you specifically want a fully managed team, strategy, and reporting handled for you and will pay a retainer for it, an agency may fit better. The marketplace is built for direct control and pay-per-outcome economics. Comparative claims here describe the general agency model, not any specific provider.',
        links: [{ href: '/guides/appointment-setting-marketplace', label: 'What is a marketplace' }],
      },
    ],
  },
  {
    ...base,
    slug: 'sdr-applications-and-approval',
    category: 'rep-earn',
    title: 'SDR Applications & Approval: How Campaign Access Works',
    description:
      'How rep applications, the quality gate, and campaign access work on Cold Call Reps — what brands see and what gets reps approved or declined.',
    h1: 'SDR applications and approval',
    oneLiner: 'How rep applications, the quality gate, and access work.',
    directAnswer:
      'To get approved for a campaign on Cold Call Reps, a rep clears an apply gate — by default at least one practice session on the brand pack, a score of at least 80, and brand certification — then applies. Brands see your score, certification, and profile and approve or decline. Approval unlocks live dialing on that campaign.',
    related: ['cold-calling-gigs', 'how-campaigns-work', 'ai-cold-call-practice'],
    ctas: [
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start your application path', primary: true },
      { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Browse brand deals' },
    ],
    keywords: [
      'sdr campaign application process',
      'cold calling application approval',
      'appointment setter application',
      'how to get approved sdr gig',
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
          'Yes. Applying to and running campaigns is free for reps. Paid plans only buy AI practice minutes and coaching tools that help you clear the gate faster.',
        links: [{ href: '/pricing', label: 'See pricing' }],
      },
      {
        question: 'What happens after I am approved?',
        answer:
          'Approval unlocks live dialing for that campaign. You dial real prospects, submit outcome claims, and — after the AI audit passes — get paid from escrow via Stripe Connect.',
        links: [{ href: '/guides/how-campaigns-work', label: 'How campaigns work' }],
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

/** Next.js Metadata for a guide page (root layout appends " | ColdCallReps"). */
export function buildGuideMetadata(slug: string) {
  const guide = getGuide(slug);
  if (!guide) return { title: 'Guide not found' };
  const url = `https://coldcallreps.com${guidePath(slug)}`;
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${guide.title} — ColdCallReps`,
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
      url: 'https://coldcallreps.com',
    },
    about: { '@type': 'Thing', name: 'Cold calling marketplace' },
    inLanguage: 'en',
  };
}
