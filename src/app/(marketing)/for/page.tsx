import Link from 'next/link';
import type { Metadata } from 'next';
import { ROLE_LANDINGS } from '@/lib/role-landings';

export const metadata: Metadata = {
  title: 'Who it’s for',
  description:
    'Cold Call Reps for sales reps and brand founders — AI voice training, performance-gated campaigns, and pay-for-results outbound.',
};

const ROLES = [ROLE_LANDINGS.reps, ROLE_LANDINGS.brands] as const;

export default function ForIndexPage() {
  return (
    <main className="lp-wrap">
      <section className="lp-section" style={{ paddingTop: '3.5rem', paddingBottom: '2rem' }}>
        <p className="lp-kicker">Who it’s for</p>
        <h1 className="lp-h2" style={{ maxWidth: '18ch' }}>
          Two seats at the table. One outbound engine.
        </h1>
        <p className="lp-lead">
          Sales reps train and get paid. Brand founders post campaigns and buy booked meetings —
          not resumes.
        </p>
        <div className="lp-cta-row" style={{ marginTop: '1.5rem' }}>
          <Link href="#sales-reps" className="lp-btn-secondary">
            Sales Reps
          </Link>
          <Link href="#brand-founders" className="lp-btn-secondary">
            Brand Founders
          </Link>
        </div>
      </section>

      {ROLES.map((role) => {
        const sectionId = role.key === 'reps' ? 'sales-reps' : 'brand-founders';
        return (
          <section
            key={role.key}
            id={sectionId}
            className="lp-section"
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '3.5rem',
              paddingBottom: '3.5rem',
            }}
          >
            <p className="lp-kicker">{role.navLabel}</p>
            <h2 className="lp-h2" style={{ maxWidth: '22ch' }}>
              {role.headline}
            </h2>
            <p className="lp-lead" style={{ maxWidth: '52ch' }}>
              {role.sub}
            </p>

            <div className="lp-cta-row" style={{ marginTop: '1.25rem', marginBottom: '2rem' }}>
              <Link href={role.primaryCta.href} className="lp-btn-primary">
                {role.primaryCta.label}
              </Link>
              <Link href={role.path} className="lp-btn-secondary">
                Full {role.navLabel} page →
              </Link>
            </div>

            <p className="lp-kicker" style={{ marginBottom: '0.85rem' }}>
              What you get
            </p>
            <h3 className="lp-h2" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.55rem)', marginBottom: '1.25rem' }}>
              {role.outcomesHeadline}
            </h3>
            <div className="lp-pillars">
              {role.outcomes.map((o) => (
                <article key={o.title} className="lp-pillar">
                  <h3>{o.title}</h3>
                  <p>{o.body}</p>
                </article>
              ))}
            </div>

            <p className="lp-kicker" style={{ marginTop: '2.5rem', marginBottom: '0.85rem' }}>
              How it works
            </p>
            <h3 className="lp-h2" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.55rem)', marginBottom: '1.25rem' }}>
              {role.stepsHeadline}
            </h3>
            <div className="lp-steps">
              {role.steps.map((s) => (
                <div key={s.n} className="lp-step">
                  <div className="lp-step-num">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="lp-final">
        <h2 className="lp-h2">Ready to pick a lane?</h2>
        <p className="lp-lead">
          Train and earn as a rep — or generate leads with performance-gated setters as a brand
          founder.
        </p>
        <div className="lp-cta-row">
          <Link href="/sign-up?role=REP" className="lp-btn-primary">
            Join as an SDR
          </Link>
          <Link href="/sign-up?role=BRAND" className="lp-btn-secondary">
            Generate Leads
          </Link>
        </div>
      </section>
    </main>
  );
}
