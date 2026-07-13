import Link from 'next/link';
import type { RoleLanding } from '@/lib/role-landings';

export default function RoleLandingPage({ role }: { role: RoleLanding }) {
  return (
    <main>
      <div className="lp-athletic">
        <section className="lp-ath-hero" aria-labelledby="lp-role-hero-title">
          <div className="lp-ath-hero__media" aria-hidden>
            <video
              className="lp-ath-hero__video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              <source src="/media/hero.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="lp-ath-hero__fx" aria-hidden>
            <div className="lp-ath-hero__grain" />
            <div className="lp-ath-hero__vignette" />
            <div className="lp-ath-hero__scrim" />
          </div>

          <div className="lp-ath-hero__overlay lp-ath-hero__overlay--role">
            <p className="lp-ath-pretext">{role.eyebrow}</p>
            <h1 id="lp-role-hero-title" className="lp-ath-h1 lp-ath-h1--hero">
              {role.headline}
            </h1>
            <p className="lp-ath-sub lp-ath-sub--hero">{role.sub}</p>
            <div className="lp-ath-cta lp-ath-cta--hero">
              <Link href={role.primaryCta.href} className="lp-ath-btn lp-ath-btn--primary">
                {role.primaryCta.label}
              </Link>
              <Link href={role.secondaryCta.href} className="lp-ath-btn lp-ath-btn--ghost">
                {role.secondaryCta.label}
              </Link>
            </div>
            {role.proof ? <p className="lp-ath-proof">{role.proof}</p> : null}
          </div>
        </section>
      </div>

      <div className="lp-wrap">
        <section className="lp-section">
          <p className="lp-kicker">What you get</p>
          <h2 className="lp-h2">{role.outcomesHeadline}</h2>
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
          <h2 className="lp-h2">{role.stepsHeadline}</h2>
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

        <section className="lp-final">
          <p className="lp-kicker">Pricing</p>
          <h2 className="lp-h2">{role.pricingHeadline}</h2>
          <p className="lp-lead">{role.pricingNote}</p>
          <div className="lp-cta-row">
            <Link href={role.planHref} className="lp-btn-primary">
              {role.primaryCta.label}
            </Link>
            {role.key !== 'brands' ? (
              <Link href="/pricing" className="lp-btn-secondary">
                Compare all plans
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
