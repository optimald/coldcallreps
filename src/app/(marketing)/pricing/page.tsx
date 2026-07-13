import Link from 'next/link';
import { PLAN, REFERRAL_REWARD_LABEL, TRIAL_MINUTES } from '@/lib/product';

const CARDS = [
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
  {
    key: 'BRAND' as const,
    price: 0,
    label: 'Brand',
    audience: 'Founders & brands',
    features: [
      'Free to post campaigns (limited time)',
      'Review practice-backed SDRs',
      'Pay reps for outbound (~20% platform fee)',
      'Practice packs + certifications',
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
    case 'BRAND':
      return { href: '/sign-up?role=BRAND', label: 'Post a campaign', primary: false };
    default:
      return { href: '/sign-up', label: 'Get started', primary: false };
  }
}

export default function PricingPage() {
  return (
    <main style={{ padding: 'clamp(1.75rem, 4vw, 3rem) clamp(1rem, 3vw, 1.5rem) 5rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 5vw, 2.4rem)', marginBottom: '0.5rem' }}>
        Pricing
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', maxWidth: 640 }}>
        Free practice ({TRIAL_MINUTES} min), Starter ${PLAN.STARTER.price}/mo (
        {PLAN.STARTER.minutes} min), Pro ${PLAN.PRO.price}/mo ({PLAN.PRO.minutes} min) with
        recording storage. Brand deals are free for reps — brands pay (~20% platform fee).
        Org ${PLAN.TEAM.price}/user/mo is optional for desks. Refer a friend — you both get{' '}
        {REFERRAL_REWARD_LABEL}.
      </p>
      <p style={{ color: 'var(--muted)', marginBottom: '2.5rem', maxWidth: 640 }}>
        Reps: train → prove → apply to brand deals → connect Stripe → get paid. Practice plans buy minutes;
        brand deals are not a paywall.
      </p>

      <div className="auto-fit-grid" style={{ gap: '1.25rem' }}>
        {CARDS.map((plan) => {
          const isOrg = plan.key === 'TEAM';
          const isBrand = plan.key === 'BRAND';
          const cta = ctaFor(plan.key);
          return (
            <div
              key={plan.key}
              style={{
                background: 'var(--bg-elevated)',
                border: cta.primary
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
                  <>
                    Free
                    {isBrand && (
                      <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
                        {' '}
                        for now
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    ${isOrg ? plan.price.toFixed(2) : plan.price}
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
                      {isOrg ? '/user/mo' : '/mo'}
                    </span>
                  </>
                )}
              </p>
              <ul
                style={{
                  paddingLeft: '1.1rem',
                  color: 'var(--muted)',
                  lineHeight: 1.65,
                  fontSize: '0.92rem',
                }}
              >
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={cta.href}
                className={cta.primary ? 'btn' : 'btn-ghost'}
                style={{ marginTop: '1rem' }}
              >
                {cta.label}
              </Link>
            </div>
          );
        })}
      </div>

      <section style={{ marginTop: '3rem', maxWidth: 720 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem' }}>What’s included</h2>
        <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          <li>
            <strong style={{ color: 'var(--ink)' }}>Free:</strong> {TRIAL_MINUTES} practice minutes,
            scorecards, brand deals free for reps — then Stripe Connect under Billing / Earnings
            to get paid.
          </li>
          <li>
            <strong style={{ color: 'var(--ink)' }}>Starter (${PLAN.STARTER.price}/mo):</strong>{' '}
            {PLAN.STARTER.minutes} monthly practice minutes — daily warm-ups, not a brand deal paywall.
          </li>
          <li>
            <strong style={{ color: 'var(--ink)' }}>Pro (${PLAN.PRO.price}/mo):</strong>{' '}
            {PLAN.PRO.minutes} monthly minutes, call recording storage, and shareable audio
            highlights.
          </li>
          <li>
            <strong style={{ color: 'var(--ink)' }}>
              Org (${PLAN.TEAM.price}/user/mo):
            </strong>{' '}
            {PLAN.TEAM.minutesPerSeat} practice minutes / user / mo (pooled), recording storage,
            academy — optional vs brand campaigns.
          </li>
          <li>
            <strong style={{ color: 'var(--ink)' }}>Brands:</strong> post campaigns, pay for
            outbound (~20% platform fee). Free to start.
          </li>
        </ul>
        <p style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link href="/sign-up?role=REP" className="btn">
            Sign up as a rep
          </Link>
          <Link href="/gigs" className="btn-ghost">
            Browse brand deals
          </Link>
          <Link href="/for/reps" className="btn-ghost">
            Rep path
          </Link>
        </p>
      </section>
    </main>
  );
}
