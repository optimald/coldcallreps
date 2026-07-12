import Link from 'next/link';
import type { RoleLanding } from '@/lib/role-landings';
import { ROLE_LANDING_LIST } from '@/lib/role-landings';

export default function RoleLandingPage({ role }: { role: RoleLanding }) {
  return (
    <main className="lp-wrap">
      <section className="lp-hero" style={{ minHeight: 'auto', paddingBottom: '3rem' }}>
        <div className="lp-hero-copy">
          <p className="lp-kicker" style={{ marginBottom: '0.75rem' }}>
            {role.eyebrow}
          </p>
          <h1 className="lp-headline" style={{ maxWidth: '22ch' }}>
            {role.headline}
          </h1>
          <p className="lp-sub">{role.sub}</p>
          <div className="lp-cta-row">
            <Link href={role.primaryCta.href} className="lp-btn-primary">
              {role.primaryCta.label}
            </Link>
            <Link href={role.secondaryCta.href} className="lp-btn-secondary">
              {role.secondaryCta.label}
            </Link>
          </div>
          <p className="lp-proof-line" style={{ marginTop: '1.25rem' }}>
            {role.proof}
          </p>
        </div>
        <div className="lp-demo" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-call.svg" alt="" className="lp-hero-art" width={440} height={495} />
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-kicker">What you get</p>
        <h2 className="lp-h2">{role.title} outcomes</h2>
        <div className="lp-pillars" style={{ marginTop: '1.5rem' }}>
          {role.outcomes.map((o) => (
            <article key={o.title} className="lp-pillar">
              <h3>{o.title}</h3>
              <p>{o.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-section-tight">
        <p className="lp-kicker">How it works</p>
        <h2 className="lp-h2">Four moves</h2>
        <div className="lp-steps" style={{ marginTop: '1.5rem' }}>
          {role.steps.map((s) => (
            <div key={s.n} className="lp-step">
              <div className="lp-step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-kicker">Pricing</p>
        <h2 className="lp-h2">Ready when you are</h2>
        <p className="lp-lead">{role.pricingNote}</p>
        <div className="lp-cta-row">
          <Link href={role.planHref} className="lp-btn-primary">
            {role.primaryCta.label}
          </Link>
          <Link href="/pricing" className="lp-btn-secondary">
            Compare all plans
          </Link>
        </div>
      </section>

      <section className="lp-section lp-section-tight">
        <p className="lp-kicker">Also on ColdCallReps</p>
        <h2 className="lp-h2">Explore other roles</h2>
        <div className="lp-pillars" style={{ marginTop: '1.25rem' }}>
          {ROLE_LANDING_LIST.filter((r) => r.key !== role.key).map((r) => (
            <Link
              key={r.key}
              href={r.path}
              className="lp-pillar"
              style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
            >
              <h3>{r.title}</h3>
              <p>{r.sub.slice(0, 120)}…</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2 className="lp-h2">{role.headline}</h2>
        <p className="lp-lead">{role.sub}</p>
        <div className="lp-cta-row">
          <Link href={role.primaryCta.href} className="lp-btn-primary">
            {role.primaryCta.label}
          </Link>
        </div>
      </section>
    </main>
  );
}
