import Link from 'next/link';
import type { RoleLanding } from '@/lib/role-landings';
import '@/app/(marketing)/landing.css';

function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lp-ath-frame">
      <div className="lp-ath-frame__chrome">
        <span className="lp-ath-frame__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="lp-ath-frame__url">{title}</span>
      </div>
      <div className="lp-ath-frame__body">{children}</div>
    </div>
  );
}

function ScorecardMock() {
  return (
    <BrowserFrame title="coldcallreps.com/practice · scorecard">
      <div className="lp-ath-mockui lp-ath-mockui--practice">
        <div className="lp-ath-mockui__side">
          <p className="lp-ath-mockui__label">Live coach</p>
          <p className="lp-ath-mockui__coach">Ask for the DM by name, then land the reason in one clean sentence.</p>
          <div className="lp-ath-mockui__wave" aria-hidden>
            {Array.from({ length: 12 }).map((_, i) => (
              <i key={i} style={{ height: `${30 + ((i * 19) % 45)}%` }} />
            ))}
          </div>
        </div>
        <div className="lp-ath-mockui__main">
          <p className="lp-ath-mockui__label">Scorecard</p>
          <ul>
            <li>
              <span>Objection handling</span>
              <strong>92</strong>
            </li>
            <li>
              <span>Tone control</span>
              <strong>88</strong>
            </li>
            <li>
              <span>Gatekeeper → DM</span>
              <strong>95</strong>
            </li>
          </ul>
          <p className="lp-ath-mockui__pass">Session passed · campaigns unlocked</p>
        </div>
      </div>
    </BrowserFrame>
  );
}

function EscrowMock() {
  return (
    <BrowserFrame title="coldcallreps.com/campaigns · escrow">
      <div className="lp-ath-mockui lp-ath-mockui--payout">
        <p className="lp-ath-mockui__label">Campaign funded</p>
        <h3>Escrow ready</h3>
        <p className="lp-ath-mockui__detail">Booked meeting · $175 / result · ICP gate on</p>
        <div className="lp-ath-mockui__escrow">
          <div>
            <span>Funded</span>
            <strong>$1,750</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className="is-ok">Held</strong>
          </div>
        </div>
        <p className="lp-ath-mockui__pass">Released only when the result is verified</p>
      </div>
    </BrowserFrame>
  );
}

const REPS = [
  { handle: '@setter_north', stat: '94', label: 'Integrity score', detail: 'Gatekeeper → DM', tone: 'a' },
  { handle: '@booked_west', stat: '212', label: 'Practice calls', detail: 'Campaign unlocked', tone: 'b' },
  { handle: '@dial_ridge', stat: 'Top 5%', label: 'Scorecard rank', detail: 'Objection handling', tone: 'c' },
] as const;

export default function RoleLandingPage({ role }: { role: RoleLanding }) {
  const heroTone = role.key === 'brands' ? 'brand' : role.key === 'reps' ? 'reps' : 'teams';
  const showReps = role.key === 'reps';
  const showProofBar = role.key === 'brands';
  // Reps get the dedicated "grind" cut; other roles use the flagship hero.
  const heroVideo = role.key === 'reps' ? '/media/hero-reps.mp4' : '/media/hero.mp4';

  return (
    <main className="lp-athletic">
      <section
        className={`lp-ath-hero lp-ath-hero--role lp-ath-hero--${heroTone}`}
        aria-labelledby="lp-role-hero-title"
      >
        <div className="lp-ath-hero__media" aria-hidden>
          <video className="lp-ath-hero__video" autoPlay muted loop playsInline preload="metadata">
            <source src={heroVideo} type="video/mp4" />
          </video>
        </div>
        <div className="lp-ath-hero__fx" aria-hidden>
          <div className="lp-ath-hero__grain" />
          <div className="lp-ath-hero__vignette" />
          <div className="lp-ath-hero__scrim" />
          <div className="lp-ath-hero__signal" />
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
            <Link href={role.secondaryCta.href} className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              {role.secondaryCta.label}
            </Link>
          </div>
          {role.proof ? <p className="lp-ath-proof">{role.proof}</p> : null}
        </div>
      </section>

      {/* Outcomes + product visual */}
      <section className="lp-ath-role-outcomes" aria-labelledby="lp-role-outcomes">
        <div className="lp-ath-role-outcomes__inner">
          <p className="lp-ath-kicker">What you get</p>
          <h2 id="lp-role-outcomes" className="lp-ath-h2">
            {role.outcomesHeadline}
          </h2>
          <div className="lp-ath-role-outcomes__grid">
            {role.outcomes.map((o) => (
              <article key={o.title} className="lp-ath-role-outcomes__card">
                <h3>{o.title}</h3>
                <p>{o.body}</p>
              </article>
            ))}
          </div>

          {role.key === 'reps' || role.key === 'brands' ? (
            <div className="lp-ath-role-outcomes__visual">
              {role.key === 'reps' ? <ScorecardMock /> : <EscrowMock />}
            </div>
          ) : null}
        </div>
      </section>

      {/* How it works — light zone */}
      <section className="lp-ath-steps lp-ath-zone--light" aria-labelledby="lp-role-steps">
        <p className="lp-ath-kicker lp-ath-kicker--center">How it works</p>
        <h2 id="lp-role-steps" className="lp-ath-h2 lp-ath-h2--center">
          {role.stepsHeadline}
        </h2>
        <div className="lp-ath-steps__pipeline" role="list">
          {role.steps.map((s, i) => (
            <div key={s.n} className="lp-ath-steps__node" role="listitem">
              <span className="lp-ath-steps__n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              {i < role.steps.length - 1 ? <span className="lp-ath-steps__connector" aria-hidden /> : null}
            </div>
          ))}
        </div>
      </section>

      {showReps ? (
        <section className="lp-ath-reps" aria-labelledby="lp-role-reps">
          <p className="lp-ath-kicker lp-ath-kicker--center">Meet the reps</p>
          <h2 id="lp-role-reps" className="lp-ath-h2 lp-ath-h2--center lp-ath-h2--wide">
            Real humans. Proven scores.
          </h2>
          <p className="lp-ath-reps__note">
            Illustrative scorecards from the practice gym — anonymized handles, not paid endorsements.
          </p>
          <div className="lp-ath-reps__grid">
            {REPS.map((rep) => (
              <article key={rep.handle} className="lp-ath-reps__card">
                <span className={`lp-ath-reps__avatar lp-ath-reps__avatar--${rep.tone}`} aria-hidden>
                  {rep.handle.slice(1, 3).toUpperCase()}
                </span>
                <p className="lp-ath-reps__badge">Top performer</p>
                <strong className="lp-ath-reps__handle">{rep.handle}</strong>
                <p className="lp-ath-reps__stat">
                  <em>{rep.stat}</em>
                  <span>{rep.label}</span>
                </p>
                <p className="lp-ath-reps__detail">{rep.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showProofBar ? (
        <section className="lp-ath-proofbar" aria-label="Platform proof">
          <div className="lp-ath-proofbar__grid">
            <div>
              <strong>20%</strong>
              <span>Fee capped ($30 / outcome)</span>
            </div>
            <div>
              <strong>Escrow</strong>
              <span>Pay only when verified</span>
            </div>
            <div>
              <strong>Human + AI</strong>
              <span>Trained reps, live coaching</span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Pricing */}
      <section className="lp-ath-role-pricing" aria-labelledby="lp-role-pricing">
        <p className="lp-ath-kicker lp-ath-kicker--center">Pricing</p>
        <h2 id="lp-role-pricing" className="lp-ath-h2 lp-ath-h2--center">
          {role.pricingHeadline}
        </h2>
        {role.pricingNote ? <p className="lp-ath-role-pricing__note">{role.pricingNote}</p> : null}
        {role.escrowNote ? <p className="lp-ath-role-pricing__escrow">{role.escrowNote}</p> : null}

        {role.pricingCards && role.pricingCards.length > 0 ? (
          <div className="lp-ath-role-pricing__grid">
            {role.pricingCards.map((card) => (
              <article
                key={card.label}
                className={`lp-ath-role-pricing__card${card.highlight ? ' is-featured' : ''}`}
              >
                <p className="lp-ath-role-pricing__label">{card.label}</p>
                <h3>{card.price}</h3>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
        ) : null}

        <div className="lp-ath-cta lp-ath-cta--center" style={{ marginTop: '2rem' }}>
          <Link href={role.planHref} className="lp-ath-btn lp-ath-btn--primary">
            {role.primaryCta.label}
          </Link>
          <Link href="/pricing" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
            Compare all plans
          </Link>
        </div>
      </section>
    </main>
  );
}
