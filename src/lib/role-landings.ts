import {
  BRAND_LEAD_PLAN,
  LEAD_PACKS,
  PLAN,
  TRIAL_MINUTES,
} from '@/lib/product';

export type RoleLandingKey = 'reps' | 'brands' | 'teams';

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
  /** Optional escrow/take-rate line for brand pricing. */
  escrowNote?: string;
  planHref: string;
  pricingCards?: RolePricingCard[];
}

export const ROLE_LANDINGS: Record<RoleLandingKey, RoleLanding> = {
  reps: {
    key: 'reps',
    path: '/for/reps',
    navLabel: 'Sales Reps',
    eyebrow: 'Skill · speed · consistency',
    title: 'For SDRs & appointment setters',
    headline: 'Skill, speed, and consistency. No earning ceiling.',
    sub: 'Cold calling pays the reps who show up sharp and stay consistent. Train with AI voice coaching, unlock brand campaigns, and get paid when you qualify or book — the harder you run, the more you can earn.',
    primaryCta: { href: '/sign-up?role=REP', label: 'Start Free — Get Paid' },
    secondaryCta: { href: '/gigs', label: 'Browse Brand Deals' },
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
    planHref: '/sign-up?role=REP',
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
  brands: {
    key: 'brands',
    path: '/for/brands',
    navLabel: 'Brand Founders',
    eyebrow: 'Human cold outreach · first touch',
    title: 'For founders',
    headline: 'Cold outreach is a numbers game. Stop playing it alone.',
    sub: 'Email and LinkedIn are flooded. AI SDRs are everywhere. Cold calling still works — but it’s time-consuming volume: hundreds of dials for a booked meeting. Post a campaign and put trained humans on never-contacted leads to qualify or book. You fund escrow and pay for results.',
    primaryCta: { href: '/sign-up?role=BRAND', label: 'Post a Campaign' },
    secondaryCta: { href: '/gigs', label: 'See Open Brand Deals' },
    proof: 'A numbers game on your side. Skill, speed, and consistency on theirs — with no earning ceiling for the reps who grind.',
    outcomesHeadline: 'First-touch human calls when inboxes are noise',
    outcomes: [
      {
        title: 'Own the Numbers Game',
        body: 'Outbound dialing takes volume and time. Campaigns put that grind on paid reps so you’re not the one burning hours for every appointment.',
      },
      {
        title: 'Real Humans, First Touch',
        body: 'No prior email or LinkedIn. No AI voice spam. A real person calls the lead, qualifies, or books the meeting.',
      },
      {
        title: 'Trained on Your Offer',
        body: 'SDRs practice your pitch, objections, and ICP with AI before they touch your list.',
      },
      {
        title: 'Pay for Qualify or Book',
        body: 'Set the goal and rate — qualified lead or booked appointment (plus optional base). You pay when the result is verified — not for empty dials.',
      },
    ],
    stepsHeadline: 'Four Moves to Getting Leads',
    steps: [
      {
        n: '01',
        title: 'Create Brand',
        body: 'Sign up free and upload your offer, ICP, and talk track.',
      },
      {
        n: '02',
        title: 'Post a Campaign',
        body: 'Set pay for qualified leads or booked meetings. Fund escrow. Optional base if you want a retainer floor.',
      },
      {
        n: '03',
        title: 'Review Proof',
        body: 'Reps practice your campaign with AI, then apply. You only approve SDRs who sound ready.',
      },
      {
        n: '04',
        title: 'Pay for Results',
        body: 'They run the dial volume. You pay when a lead is qualified or a meeting is booked.',
      },
    ],
    pricingHeadline: 'Lead generation + results-based campaigns',
    escrowNote:
      'Campaign escrow: outcomes + optional base · 20% fee capped at $30/outcome · $150/mo on base',
    planHref: '/sign-up?role=BRAND',
    pricingCards: [
      {
        label: 'Free',
        price: '$0',
        detail: `${BRAND_LEAD_PLAN.FREE.allotment} enriched leads / mo · unlimited import · post campaigns`,
      },
      {
        label: 'Brand Lead Plan',
        price: `$${BRAND_LEAD_PLAN.LEAD_MONTHLY.priceUsd}/mo`,
        detail: `${BRAND_LEAD_PLAN.LEAD_MONTHLY.allotment.toLocaleString()} enriched leads / mo · or $${BRAND_LEAD_PLAN.LEAD_ANNUAL.priceUsd}/yr`,
        highlight: true,
      },
      {
        label: 'Lead packs',
        price: `From $${LEAD_PACKS[0].priceUsd}`,
        detail: LEAD_PACKS.map((p) => `${p.credits}/${p.priceUsd}`).join(' · ') + ' (12-mo shelf)',
      },
    ],
  },
  teams: {
    key: 'teams',
    path: '/for/teams',
    navLabel: 'Teams',
    eyebrow: 'Org · desks & academies',
    title: 'For Teams',
    headline: 'Org seats when you need a desk — marketplace first.',
    sub: 'Most founders use campaigns, not org seats. Org is here for academies and managers who need pooled minutes, playbooks, and roster tools.',
    primaryCta: { href: '/sign-up?plan=TEAM', label: 'Get Org seats' },
    secondaryCta: { href: '/for/brands', label: 'Post a campaign instead' },
    proof: `Org $${PLAN.TEAM.price}/user/mo · ${PLAN.TEAM.minutesPerSeat} min/user/mo · optional vs campaigns`,
    outcomesHeadline: 'What teams get',
    outcomes: [
      {
        title: 'Pooled minutes',
        body: 'Org pool first — members draw from the team balance before personal minutes.',
      },
      {
        title: 'Academy + playbooks',
        body: 'Curricula and talk tracks so every seat practices the same motion.',
      },
      {
        title: 'Recording storage',
        body: 'Call recording storage for all seats on Org — same gate as Pro.',
      },
      {
        title: 'Shared coaching',
        body: 'Sessions and scores in one place for the whole desk.',
      },
    ],
    stepsHeadline: 'Four moves',
    steps: [
      { n: '01', title: 'Start free', body: 'Reps join and put in the practice.' },
      { n: '02', title: 'Invite the desk', body: 'Clerk orgs + academy membership.' },
      { n: '03', title: 'Assign playbooks', body: 'Shared scripts in Practice + coach.' },
      { n: '04', title: 'Coach from data', body: 'Sessions, scores, org board.' },
    ],
    pricingHeadline: 'Ready when you are',
    pricingNote: `Org plan $${PLAN.TEAM.price}/user/mo — ${PLAN.TEAM.minutesPerSeat} practice minutes / user / mo (pooled). Prefer campaigns if you’re a solo founder.`,
    planHref: '/sign-up?plan=TEAM',
  },
};

export const ROLE_LANDING_LIST = Object.values(ROLE_LANDINGS);
