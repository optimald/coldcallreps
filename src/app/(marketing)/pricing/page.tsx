import Link from 'next/link';
import { PLAN, REFERRAL_REWARD_LABEL, TRIAL_MINUTES } from '@/lib/product';
import { PLATFORM_FEE_EXAMPLES } from '@/lib/platform-fees';
import { MARKETPOUNCE_SIGN_UP_REP, marketpounceSignUp } from '@/lib/marketpounce';

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

function ctaFor(key: string): { href: string; label: string; primary: boolean } {
  switch (key) {
    case 'FREE':
      return { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Start free — get paid', primary: false };
    case 'STARTER':
      return { href: marketpounceSignUp('role=REP&plan=STARTER'), label: 'Get Starter', primary: true };
    case 'PRO':
      return { href: marketpounceSignUp('role=REP&plan=PRO'), label: 'Get Pro', primary: false };
    case 'TEAM':
      return { href: marketpounceSignUp('plan=TEAM'), label: 'Get Org', primary: false };
    default:
      return { href: MARKETPOUNCE_SIGN_UP_REP, label: 'Get started', primary: false };
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
  const unit = plan.priceUnit || (isOrg ? '/user/mo' : '');

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
      <a href={cta.href} className={`${cta.primary ? 'btn' : 'btn-ghost'} plan-card__cta`}>
        {cta.label}
      </a>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-head">
        <h1 className="pricing-title">Practice pricing for SDRs</h1>
        <p className="pricing-lede">
          A few dollars a month to train. Brand deals stay free. You earn when verified results pay
          out.
        </p>
      </header>

      <p className="pricing-note">
        Free includes {TRIAL_MINUTES} practice minutes to start. Starter ${PLAN.STARTER.price}/mo, Pro
        ${PLAN.PRO.price}/mo. Running brand campaigns is always free for reps. Refer a friend and you
        both get {REFERRAL_REWARD_LABEL}.
      </p>
      <div className="pricing-grid pricing-grid--4">
        {REP_CARDS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} />
        ))}
      </div>

      <section className="pricing-fees">
        <h2 className="pricing-fees__title">How your payouts work</h2>
        <p className="pricing-fees__lede">
          Brands fund escrow. One platform fee is capped so your take-home stays strong.
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
          SDR path
        </Link>
        {' · '}
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="soft-link">
          Start free
        </a>
      </p>
    </main>
  );
}
