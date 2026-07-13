import { PLAN, TRIAL_MINUTES } from '@/lib/product';

export type RoleLandingKey = 'reps' | 'brands' | 'teams';

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
  pricingNote: string;
  planHref: string;
}

export const ROLE_LANDINGS: Record<RoleLandingKey, RoleLanding> = {
  reps: {
    key: 'reps',
    path: '/for/reps',
    navLabel: 'Sales Reps',
    eyebrow: 'AI voice training · high-ticket SDR coaching',
    title: 'For SDRs & closers',
    headline: 'Master high-ticket cold calls with AI.',
    sub: 'Train on realistic gatekeeper and decision-maker calls with live AI voice coaching. Sharpen openers, objections, and transfers until your score proves you’re ready — then unlock paid brand campaigns.',
    primaryCta: { href: '/sign-up?role=REP', label: 'Start Free — Get Paid' },
    secondaryCta: { href: '/gigs', label: 'Browse Brand Deals' },
    proof: '',
    outcomesHeadline: 'The AI coaching gym for serious SDRs',
    outcomes: [
      {
        title: 'High-Ticket Scenarios',
        body: 'Practice premium outbound — gatekeepers, pricing pushback, and decision-maker conversations that feel like the real dial.',
      },
      {
        title: 'Live AI Coach',
        body: 'Real-time whispers mid-call: what to say next, how to handle objections, and when to ask for the transfer or meeting.',
      },
      {
        title: 'Scorecards That Matter',
        body: 'Objective scoring and call recordings so you know exactly what to fix — and brands can hear proof you’re ready.',
      },
      {
        title: 'Get Paid to Dial',
        body: 'High scores unlock brand campaigns. Apply, get accepted, and earn when qualified leads or meetings land.',
      },
    ],
    stepsHeadline: 'Four Moves to Getting Paid',
    steps: [
      {
        n: '01',
        title: 'Train',
        body: 'Run AI voice sessions on brand packs until your high-ticket openers, objections, and transfers are sharp.',
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
        title: 'Level Up',
        body: 'Unlock more practice minutes and higher-paying deals as you win.',
      },
    ],
    pricingHeadline: 'Ready when you are',
    pricingNote: `Free (${TRIAL_MINUTES} min) · Starter $${PLAN.STARTER.price}/mo (${PLAN.STARTER.minutes} min) · Pro $${PLAN.PRO.price}/mo · Brand deals are free for reps · Stripe Connect when you’re ready to get paid`,
    planHref: '/sign-up?role=REP',
  },
  brands: {
    key: 'brands',
    path: '/for/brands',
    navLabel: 'Brand Founders',
    eyebrow: 'Bootstrapped founders · brands',
    title: 'For founders',
    headline: 'Post a campaign. Get trained reps on your outbound.',
    sub: 'You’re busy building. Cold Call Reps trains SDRs with AI voice on your exact offer, gates quality, then matches them to your paid campaigns. You only pay for results.',
    primaryCta: { href: '/sign-up?role=BRAND', label: 'Post a Campaign' },
    secondaryCta: { href: '/gigs', label: 'See Open Brand Deals' },
    proof: '',
    outcomesHeadline: 'For founders who want booked meetings without the grind',
    outcomes: [
      {
        title: 'Product-Ready Reps',
        body: 'SDRs train on your pitch, objections, and ICP before calling your leads.',
      },
      {
        title: 'Real Humans on the Dial',
        body: 'No AI calling. Just sharp reps with live AI coaching.',
      },
      {
        title: 'Meetings on Your Calendar',
        body: 'Booked calls land directly in your calendar + pushed to Close.com.',
      },
      {
        title: 'Pay Only for Results',
        body: 'You set the price per lead and choose the goal — qualified lead or booked appointment. Pay only when it’s met.',
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
        body: 'Create a campaign free. Set your price per lead and choose qualified lead or booked appointment.',
      },
      {
        n: '03',
        title: 'Review Proof',
        body: 'Reps practice your campaign with AI, then apply. You listen to their calls and only approve SDRs who sound ready.',
      },
      {
        n: '04',
        title: 'Pay for Results',
        body: 'You only pay when a lead goal is met.',
      },
    ],
    pricingHeadline: 'Free to start. Pay only when a goal is met.',
    pricingNote:
      'Sign up and create a campaign at no cost. Set your own price per lead and choose the goal — qualified lead or booked appointment. You only pay when that goal is delivered.',
    planHref: '/sign-up?role=BRAND',
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
