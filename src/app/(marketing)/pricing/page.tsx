import Link from 'next/link';
import {
  BRAND_LEAD_PLAN,
  LEAD_PACKS,
  PLAN,
  REFERRAL_REWARD_LABEL,
  TRIAL_MINUTES,
} from '@/lib/product';
import { PLATFORM_FEE_EXAMPLES } from '@/lib/platform-fees';
import PricingSwitch from './PricingSwitch';

const REP_CARDS = [
  {
    ...PLAN.FREE,
    features: [...PLAN.FREE.features],
  },
  {
    ...PLAN.STARTER,
    features: [
      `${PLAN.STARTER.minutes} practice minutes / mo`,
      ...PLAN.STARTER.features,
      `Refer a friend → ${REFERRAL_REWARD_LABEL} each`,
    ],
    highlight: true,
  },
  {
    ...PLAN.PRO,
    features: [...PLAN.PRO.features],
  },
  {
    ...PLAN.TEAM,
    features: [...PLAN.TEAM.features],
  },
];

const BRAND_CARDS = [
  {
    key: 'BRAND_FREE',
    price: 0,
    label: BRAND_LEAD_PLAN.FREE.label,
    audience: 'Brands',
    features: [...BRAND_LEAD_PLAN.FREE.features],
  },
  {
    key: 'BRAND_LEAD',
    price: BRAND_LEAD_PLAN.LEAD_MONTHLY.priceUsd,
    label: BRAND_LEAD_PLAN.LEAD_MONTHLY.label,
    audience: 'Brands',
    features: [
      ...BRAND_LEAD_PLAN.LEAD_MONTHLY.features,
      `Annual $${BRAND_LEAD_PLAN.LEAD_ANNUAL.priceUsd}/yr (~$${BRAND_LEAD_PLAN.LEAD_ANNUAL.monthlyEquivalentUsd}/mo)`,
    ],
    highlight: true,
  },
  {
    key: 'BRAND_PACKS',
    price: LEAD_PACKS[0].priceUsd,
    pricePrefix: 'From ',
    label: 'Lead packs',
    audience: 'Brands',
    features: [
      ...LEAD_PACKS.map((p) => `${p.credits.toLocaleString()} credits · $${p.priceUsd}`),
      '12-month shelf life · burn after allotment = 0',
      'Campaign escrow separate (outcomes + optional base pay)',
    ],
  },
];

function ctaFor(key: string): { href: string; label: string; primary: boolean } {
  switch (key) {
    case 'FREE':
      return { href: '/sign-up?role=REP', label: 'Start free — get paid', primary: false };
    case 'STARTER':
      return { href: '/sign-up?role=REP&plan=STARTER', label: 'Get Starter', primary: true };
    case 'PRO':
      return { href: '/sign-up?role=REP&plan=PRO', label: 'Get Pro', primary: false };
    case 'TEAM':
      return { href: '/sign-up?plan=TEAM', label: 'Get Org', primary: false };
    case 'BRAND_FREE':
      return { href: '/sign-up?role=BRAND', label: 'Start free', primary: false };
    case 'BRAND_LEAD':
      return { href: '/subscribe/brand', label: 'Upgrade lead plan', primary: true };
    case 'BRAND_PACKS':
      return { href: '/subscribe/brand', label: 'Buy packs', primary: false };
    default:
      return { href: '/sign-up', label: 'Get started', primary: false };
  }
}

function PlanCard({
  plan,
}: {
  plan: {
    key: string;
    price: number;
    label: string;
    audience: string;
    features: readonly string[] | string[];
    highlight?: boolean;
    pricePrefix?: string;
    priceUnit?: string;
  };
}) {
  const isOrg = plan.key === 'TEAM';
  const cta = ctaFor(plan.key);
  const featured = Boolean(plan.highlight);
  const unit =
    plan.priceUnit ||
    (isOrg ? '/user/mo' : plan.key.startsWith('BRAND') && plan.key !== 'BRAND_PACKS' ? '/mo' : '');

  return (
    <div className={`plan-card${featured ? ' plan-card--featured' : ''}`}>
      {featured ? <span className="plan-card__ribbon">Most popular</span> : null}
      <p className="plan-card__label">{plan.label}</p>
      <p className="plan-card__price">
        {plan.price === 0 ? (
          'Free'
        ) : (
          <>
            {plan.pricePrefix || ''}${isOrg ? plan.price.toFixed(2) : plan.price}
            {unit ? <span className="plan-card__unit">{unit}</span> : null}
          </>
        )}
      </p>
      <ul className="plan-card__features">
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Link href={cta.href} className={`${cta.primary ? 'btn' : 'btn-ghost'} plan-card__cta`}>
        {cta.label}
      </Link>
    </div>
  );
}

export default function PricingPage() {
  const sdrPanel = (
    <>
      <p className="pricing-note">
        Reps train for a few dollars a month — Free ({TRIAL_MINUTES} min), Starter $
        {PLAN.STARTER.price}/mo, Pro ${PLAN.PRO.price}/mo. Running brand campaigns is always free for
        reps. Refer a friend and you both get {REFERRAL_REWARD_LABEL}.
      </p>
      <div className="pricing-grid pricing-grid--4">
        {REP_CARDS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} />
        ))}
      </div>
    </>
  );

  const brandPanel = (
    <>
      <p className="pricing-note">
        Free includes {BRAND_LEAD_PLAN.FREE.allotment} enriched leads / mo (CSV imports are always
        free). Upgrade for more enrichment credits, then fund campaign escrow to pay reps only when
        they deliver. Manage cards and escrow on{' '}
        <Link href="/billing" className="soft-link">
          billing
        </Link>
        {' · '}
        <Link href="/subscribe/brand" className="soft-link">
          pick a plan
        </Link>
        .
      </p>
      <div className="pricing-grid pricing-grid--3">
        {BRAND_CARDS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} />
        ))}
      </div>
    </>
  );

  return (
    <main className="pricing-page">
      <header className="pricing-head">
        <h1 className="pricing-title">Simple pricing</h1>
        <p className="pricing-lede">
          Reps pay a few dollars a month to train. Brands pay per result — only when a rep books a
          meeting or delivers a qualified lead.
        </p>
      </header>

      <PricingSwitch sdr={sdrPanel} brand={brandPanel} />

      <section className="pricing-fees">
        <h2 className="pricing-fees__title">How campaign fees work</h2>
        <p className="pricing-fees__lede">
          One platform fee, capped so it never balloons. Reps keep the rest.
        </p>
        <div className="pricing-fees__grid">
          <div className="pricing-fee">
            <strong>20%</strong>
            <span>Platform fee on SDR payouts</span>
          </div>
          <div className="pricing-fee">
            <strong>$30</strong>
            <span>Max fee per outcome payout</span>
          </div>
          <div className="pricing-fee">
            <strong>$40 · $75 · $150</strong>
            <span>Base-pay fee caps · wk / bi-weekly / mo</span>
          </div>
        </div>
        <p className="pricing-fees__example">{PLATFORM_FEE_EXAMPLES}</p>
      </section>

      <p className="pricing-foot">
        <Link href="/for/reps" className="soft-link">
          For reps
        </Link>
        {' · '}
        <Link href="/for/brands" className="soft-link">
          For brands
        </Link>
        {' · '}
        <Link href="/subscribe" className="soft-link">
          Open subscribe
        </Link>
      </p>
    </main>
  );
}
