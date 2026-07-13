import Link from 'next/link';
import {
  BRAND_LEAD_PLAN,
  LEAD_PACKS,
  PLAN,
  REFERRAL_REWARD_LABEL,
  TRIAL_MINUTES,
} from '@/lib/product';

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
      'Campaign escrow separate (~20% platform fee on payouts)',
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
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: cta.primary || plan.highlight
          ? '1px solid rgba(var(--accent-rgb), 0.45)'
          : '1px solid var(--line)',
        borderRadius: 16,
        padding: '1.5rem',
      }}
    >
      <p
        style={{
          color: 'var(--muted)',
          margin: 0,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {plan.audience} · {plan.label}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.2rem',
          fontWeight: 800,
          margin: '0.4rem 0',
        }}
      >
        {plan.price === 0 ? (
          'Free'
        ) : (
          <>
            {plan.pricePrefix || ''}
            ${isOrg ? plan.price.toFixed(2) : plan.price}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
              {plan.priceUnit || (isOrg ? '/user/mo' : plan.key.startsWith('BRAND') && plan.key !== 'BRAND_PACKS' ? '/mo' : '')}
            </span>
          </>
        )}
      </p>
      <ul style={{ margin: '1rem 0 1.25rem', paddingLeft: '1.1rem', color: 'var(--muted)' }}>
        {plan.features.map((f) => (
          <li key={f} style={{ marginBottom: '0.35rem' }}>
            {f}
          </li>
        ))}
      </ul>
      <Link href={cta.href} className={cta.primary ? 'btn' : 'btn-ghost'}>
        {cta.label}
      </Link>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main
      style={{
        padding: 'clamp(1.75rem, 4vw, 3rem) clamp(1rem, 3vw, 1.5rem) 5rem',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 5vw, 2.4rem)',
          marginBottom: '0.5rem',
        }}
      >
        Pricing
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2.5rem', maxWidth: 720 }}>
        SDRs buy practice minutes. Brands buy enriched lead credits for Generate Leads (imports stay
        free) and fund campaign escrow to pay reps for results (~20% platform fee). Refer a friend —
        you both get {REFERRAL_REWARD_LABEL}.
      </p>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.35rem',
          marginBottom: '0.75rem',
        }}
      >
        For SDRs
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.25rem', maxWidth: 640 }}>
        Free practice ({TRIAL_MINUTES} min), Starter ${PLAN.STARTER.price}/mo, Pro $
        {PLAN.PRO.price}/mo. Brand deals are free for reps.
      </p>
      <div className="auto-fit-grid" style={{ gap: '1.25rem', marginBottom: '3rem' }}>
        {REP_CARDS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} />
        ))}
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.35rem',
          marginBottom: '0.75rem',
        }}
      >
        For brands
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.25rem', maxWidth: 720 }}>
        Free includes {BRAND_LEAD_PLAN.FREE.allotment} enriched leads / mo. Brand Lead Plan $
        {BRAND_LEAD_PLAN.LEAD_MONTHLY.priceUsd}/mo for{' '}
        {BRAND_LEAD_PLAN.LEAD_MONTHLY.allotment.toLocaleString()} · Annual $
        {BRAND_LEAD_PLAN.LEAD_ANNUAL.priceUsd}/yr. Manage cards, charges, and escrow on{' '}
        <Link href="/billing" className="soft-link">
          billing
        </Link>
        ; pick a plan on{' '}
        <Link href="/subscribe/brand" className="soft-link">
          subscribe
        </Link>
        .
      </p>
      <div className="auto-fit-grid" style={{ gap: '1.25rem' }}>
        {BRAND_CARDS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} />
        ))}
      </div>

      <p style={{ color: 'var(--muted)', marginTop: '2.5rem', fontSize: '0.9rem' }}>
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
