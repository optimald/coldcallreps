import Link from 'next/link';
import { PLAN } from '@/lib/product';

export default function PricingPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', marginBottom: '0.5rem' }}>
        Simple pricing. More reps.
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2.5rem' }}>
        No free tier. Refer friends for bonus minutes. Streaks keep the rewards coming.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
        {[
          {
            tier: 'STARTER',
            ...PLAN.STARTER,
            features: [`${PLAN.STARTER.minutes} practice minutes / mo`, 'All scenarios', 'Global leaderboard', 'Referral bonuses'],
          },
          {
            tier: 'PRO',
            ...PLAN.PRO,
            features: [
              `${PLAN.PRO.minutes}+ minutes / mo`,
              'Org leaderboards',
              'Hiring board opt-in',
              'Priority coach model',
            ],
          },
        ].map((plan) => (
          <div
            key={plan.tier}
            style={{
              background: 'var(--bg-elevated)',
              border: plan.tier === 'PRO' ? '1px solid rgba(255,90,31,0.45)' : '1px solid var(--line)',
              borderRadius: 16,
              padding: '1.75rem',
            }}
          >
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {plan.label}
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, margin: '0.4rem 0' }}>
              ${plan.price}
              <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>/mo</span>
            </p>
            <ul style={{ paddingLeft: '1.1rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link
              href={`/sign-up?plan=${plan.tier}`}
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                background: plan.tier === 'PRO' ? 'var(--accent)' : 'var(--bg-soft)',
                color: '#fff',
                padding: '0.7rem 1.1rem',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Get {plan.label}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
