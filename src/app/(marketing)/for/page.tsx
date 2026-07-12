import Link from 'next/link';
import type { Metadata } from 'next';
import { ROLE_LANDING_LIST } from '@/lib/role-landings';

export const metadata: Metadata = {
  title: 'Who it’s for',
  description:
    'Cold Call Reps for SDRs and bootstrapped founders — train, prove, get paid. Org seats optional for desks.',
};

/** Founder-first order: reps, founders/brands, teams. */
const ORDER = ['reps', 'brands', 'teams'] as const;

export default function ForIndexPage() {
  const ordered = ORDER.map((key) => ROLE_LANDING_LIST.find((r) => r.key === key)).filter(
    Boolean
  ) as typeof ROLE_LANDING_LIST;

  return (
    <main className="lp-wrap">
      <section className="lp-section" style={{ paddingTop: '3.5rem' }}>
        <p className="lp-kicker">Who it’s for</p>
        <h1 className="lp-h2">Training-first outbound marketplace</h1>
        <p className="lp-lead">
          Built for hungry SDRs and bootstrapped founders. Org seats are available for desks —
          campaigns come first.
        </p>
        <div className="lp-pillars" style={{ marginTop: '2rem' }}>
          {ordered.map((r) => (
            <Link
              key={r.key}
              href={r.path}
              className="lp-pillar"
              style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
            >
              <h3>{r.title}</h3>
              <p>{r.headline}</p>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}>
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
