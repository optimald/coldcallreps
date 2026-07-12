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
  outcomes: { title: string; body: string }[];
  steps: { n: string; title: string; body: string }[];
  pricingNote: string;
  planHref: string;
}

export const ROLE_LANDINGS: Record<RoleLandingKey, RoleLanding> = {
  reps: {
    key: 'reps',
    path: '/for/reps',
    navLabel: 'Reps',
    eyebrow: 'SDR · outbound talent',
    title: 'For SDRs & closers',
    headline: 'Train. Prove. Get paid.',
    sub: 'Practice with AI voice, earn a score founders trust, then pick up paid outbound campaigns. Marketplace gigs are free for reps — brands pay, you get paid (~20% platform fee on payouts).',
    primaryCta: { href: '/sign-up?role=REP', label: 'Start free — get paid' },
    secondaryCta: { href: '/gigs', label: 'See campaigns' },
    proof: `${TRIAL_MINUTES} free minutes · Starter $${PLAN.STARTER.price}/mo · gigs free for reps`,
    outcomes: [
      {
        title: 'AI voice practice',
        body: 'Gatekeepers, objections, pricing pushback — warm up before real dials or campaign work.',
      },
      {
        title: 'Proof on your profile',
        body: 'Scorecards, integrity gate, and highlights founders can trust before they hire you for outbound.',
      },
      {
        title: 'Paid campaigns',
        body: 'Browse open gigs from bootstrapped founders. Apply with practice signal, not a résumé.',
      },
      {
        title: 'Freemium grind',
        body: `${TRIAL_MINUTES} free minutes to start. Starter for daily practice. Marketplace access stays free — Connect Stripe when you’re ready to get paid.`,
      },
    ],
    steps: [
      { n: '01', title: 'Train', body: 'AI scenarios until your opens and transfers are clean.' },
      { n: '02', title: 'Prove', body: 'Clear the quality gate. Climb the board. Own your profile.' },
      {
        n: '03',
        title: 'Get paid',
        body: 'Apply to gigs, finish Stripe Connect, deliver — brands pay; reps don’t pay to join.',
      },
      { n: '04', title: 'Level up', body: 'More minutes with Starter/Pro when you want longer practice blocks.' },
    ],
    pricingNote: `Free (${TRIAL_MINUTES} min) · Starter $${PLAN.STARTER.price}/mo (${PLAN.STARTER.minutes} min) · Pro $${PLAN.PRO.price}/mo · gigs free for reps · Stripe Connect to get paid`,
    planHref: '/sign-up?role=REP',
  },
  brands: {
    key: 'brands',
    path: '/for/brands',
    navLabel: 'Founders',
    eyebrow: 'Bootstrapped founders · brands',
    title: 'For founders',
    headline: 'Post a campaign. Get trained reps on your outbound.',
    sub: 'You’re busy building. Cold Call Reps trains SDRs with AI voice, gates quality, then matches them to your paid outbound campaigns. You pay for results — ~20% platform fee on payouts. Reps practice free to join gigs.',
    primaryCta: { href: '/sign-up?role=BRAND', label: 'Post a campaign' },
    secondaryCta: { href: '/gigs', label: 'See open gigs' },
    proof: 'Founders pay · reps free for gigs · ~20% platform fee on payouts',
    outcomes: [
      {
        title: 'Campaigns as gigs',
        body: 'Publish what you need dialed — ICP, offer, talk track — and attract practice-proven reps on /gigs.',
      },
      {
        title: 'AI quality gate',
        body: 'Reps train on live voice scenarios. Integrity scoring keeps weak sessions off your shortlist.',
      },
      {
        title: 'Pay for outbound, not seats',
        body: 'Brand/founder accounts stay free to start. You fund campaigns; platform takes ~20% on payouts.',
      },
      {
        title: 'Packs & proof',
        body: 'Inject your offer into practice, then certify closers before they dial for real.',
      },
    ],
    steps: [
      { n: '01', title: 'Create brand', body: 'Sign up as Brand / founder and name your offer.' },
      { n: '02', title: 'Post a campaign', body: 'Ship ICP + talk track to the gig marketplace.' },
      { n: '03', title: 'Review proof', body: 'See scores and highlights before you fund work.' },
      { n: '04', title: 'Pay for results', body: 'Reps run outbound; you pay — platform fee ~20%.' },
    ],
    pricingNote:
      'Founder/brand accounts free to start. Campaign payouts: brands pay per result via Stripe Connect; ~20% platform fee. SDRs connect payouts under Billing.',
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
    steps: [
      { n: '01', title: 'Start free', body: 'Reps join and put in the practice.' },
      { n: '02', title: 'Invite the desk', body: 'Clerk orgs + academy membership.' },
      { n: '03', title: 'Assign playbooks', body: 'Shared scripts in trainer + coach.' },
      { n: '04', title: 'Coach from data', body: 'Sessions, scores, org board.' },
    ],
    pricingNote: `Org plan $${PLAN.TEAM.price}/user/mo — ${PLAN.TEAM.minutesPerSeat} practice minutes / user / mo (pooled). Prefer campaigns if you’re a solo founder.`,
    planHref: '/sign-up?plan=TEAM',
  },
};

export const ROLE_LANDING_LIST = Object.values(ROLE_LANDINGS);
