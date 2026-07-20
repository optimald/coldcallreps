'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import './landing.css';

function Reveal({
  children,
  className = '',
  ...rest
}: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fail safe: if IntersectionObserver is unavailable, reveal immediately.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    // Safety net: never leave a section hidden if the observer never fires.
    const failsafe = window.setTimeout(() => el.classList.add('is-in'), 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);
  return (
    <div ref={ref} className={`lp-reveal ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

function BrowserFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function MockPractice() {
  return (
    <BrowserFrame title="coldcallreps.com/practice">
      <div className="lp-ath-mockui lp-ath-mockui--practice">
        <div className="lp-ath-mockui__side">
          <p className="lp-ath-mockui__label">Live coach</p>
          <p className="lp-ath-mockui__coach">Name + reason, then ask cleanly for the DM.</p>
          <div className="lp-ath-mockui__wave" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} style={{ height: `${28 + ((i * 17) % 40)}%` }} />
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
          <p className="lp-ath-mockui__pass">Session passed · campaign unlocked</p>
        </div>
      </div>
    </BrowserFrame>
  );
}

function MockDeals() {
  return (
    <BrowserFrame title="coldcallreps.com · Brand deals">
      <div className="lp-ath-mockui lp-ath-mockui--leads">
        <div className="lp-ath-mockui__bar">
          <span>Open deals</span>
          <em>Qualified · Booked meeting</em>
        </div>
        <div className="lp-ath-mockui__statrow">
          <div>
            <strong>$175</strong>
            <span>/ meeting</span>
          </div>
          <div>
            <strong>12</strong>
            <span>open deals</span>
          </div>
        </div>
        <ul className="lp-ath-mockui__queue">
          <li className="is-active">
            <strong>Aegis Pipeline</strong>
            <span>B2B SaaS · Mid-market · Ready</span>
          </li>
          <li>
            <strong>Northline Freight</strong>
            <span>Local services · High volume · Ready</span>
          </li>
        </ul>
      </div>
    </BrowserFrame>
  );
}

function MockPayout() {
  return (
    <BrowserFrame title="coldcallreps.com/earnings">
      <div className="lp-ath-mockui lp-ath-mockui--payout">
        <p className="lp-ath-mockui__label">Result verified</p>
        <h3>Meeting booked</h3>
        <p className="lp-ath-mockui__detail">Discovery · Thu 2:00p · ICP confirmed</p>
        <div className="lp-ath-mockui__escrow">
          <div>
            <span>Your payout</span>
            <strong>$140</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className="is-ok">Released</strong>
          </div>
        </div>
        <p className="lp-ath-mockui__pass">Get paid when the result is verified</p>
      </div>
    </BrowserFrame>
  );
}

const FEATURES = [
  {
    title: 'AI Voice Practice',
    body: 'Run realistic cold calls with a live AI coach. Gatekeepers, objections, and asks — until your scorecard proves you’re sharp.',
    Mock: MockPractice,
    photo: '/people/story-train.webp',
    alt: 'An SDR smiling while practicing a cold call with the AI voice coach',
  },
  {
    title: 'Brand Deals',
    body: 'Clear the quality gate, then apply to paid campaigns. Dial leads for founders who fund escrow — brand deals stay free for reps.',
    Mock: MockDeals,
    photo: '/people/story-deals.webp',
    alt: 'An SDR excited after finding a brand deal they love selling for',
  },
  {
    title: 'Get Paid Per Result',
    body: 'Earn on qualified leads or booked meetings. No salary ceiling — skill, speed, and consistency decide what you make.',
    Mock: MockPayout,
    photo: '/people/story-paid.webp',
    alt: 'An SDR working on her own hours and celebrating a verified payout',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Train',
    body: 'Practice with AI voice on real brand offers until your openers and asks are clean.',
  },
  {
    n: '02',
    title: 'Prove',
    body: 'Hit the score gate. Build a profile brands trust.',
  },
  {
    n: '03',
    title: 'Apply',
    body: 'Unlock paid brand deals and pick campaigns that fit your strengths.',
  },
  {
    n: '04',
    title: 'Get Paid',
    body: 'Dial live leads. Get paid when meetings or qualified sets are verified.',
  },
] as const;

/** Illustrative rep scorecards — representative profiles, not paid endorsements. */
const REPS = [
  {
    handle: '@setter_north',
    photo: '/people/rep-01.webp',
    badge: 'Top performer',
    stat: '94',
    label: 'Integrity score',
    detail: 'Gatekeeper → DM',
  },
  {
    handle: '@booked_west',
    photo: '/people/rep-02.webp',
    badge: 'Top performer',
    stat: '212',
    label: 'Practice calls logged',
    detail: 'Campaign unlocked',
  },
  {
    handle: '@dial_ridge',
    photo: '/people/rep-03.webp',
    badge: 'Top performer',
    stat: 'Top 5%',
    label: 'Scorecard rank',
    detail: 'Objection handling',
  },
  {
    handle: '@close_line',
    photo: '/people/rep-04.webp',
    badge: 'Top performer',
    stat: '91',
    label: 'Tone control',
    detail: 'Live coach sessions',
  },
] as const;

export default function HomePageClient() {
  return (
    <main className="lp-athletic">
      {/* No-JS: scroll-reveal never runs, so force content visible. */}
      <noscript>
        <style>{`.lp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      {/* Hero */}
      <section className="lp-ath-hero lp-ath-hero--center lp-ath-hero--signal" aria-labelledby="lp-hero-title">
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
          <div className="lp-ath-hero__scrim lp-ath-hero__scrim--center" />
          <div className="lp-ath-hero__signal" />
        </div>

        <div className="lp-ath-hero__overlay lp-ath-hero__overlay--center">
          <motion.h1
            id="lp-hero-title"
            className="lp-ath-h1 lp-ath-h1--hero lp-ath-h1--center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Train. Prove. Get Paid.
          </motion.h1>

          <motion.p
            className="lp-ath-sub lp-ath-sub--hero lp-ath-sub--center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            For SDRs and appointment setters who want training and brand deals. Practice with AI
            voice, prove your score, then get paid to call leads — no earning ceiling.
          </motion.p>

          <motion.div
            className="lp-ath-cta lp-ath-cta--hero lp-ath-cta--center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
          >
            <a href={MARKETPOUNCE_SIGN_UP_REP} className="lp-ath-btn lp-ath-btn--primary">
              Start free as an SDR
            </a>
            <a href="#how-it-works" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              How it works
            </a>
          </motion.div>

          <motion.p
            className="lp-ath-proof lp-ath-proof--center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.22 }}
          >
            Free practice to start · brand deals free for reps · paid per verified result
          </motion.p>
        </div>
      </section>

      {/* Value */}
      <section className="lp-ath-features" id="value" aria-labelledby="lp-value-title">
        <Reveal>
          <h2 id="lp-value-title" className="lp-ath-h2 lp-ath-h2--billboard">
            Put in the reps. Unlock the deals.
          </h2>
        </Reveal>

        <div className="lp-ath-features__list">
          {FEATURES.map((feature, i) => (
            <Reveal
              key={feature.title}
              className={`lp-ath-features__row${i % 2 === 1 ? ' lp-ath-features__row--flip' : ''}`}
            >
              <div className="lp-ath-features__copy">
                <p className="lp-ath-kicker">0{i + 1}</p>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
              <div className="lp-ath-features__visual">
                <div className="lp-ath-features__stack">
                  <img
                    className="lp-ath-features__photo"
                    src={feature.photo}
                    alt={feature.alt}
                    loading="lazy"
                    decoding="async"
                    width={1200}
                    height={900}
                  />
                  <div className="lp-ath-features__float">
                    <feature.Mock />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="lp-ath-steps lp-ath-zone--light" id="how-it-works" aria-labelledby="lp-steps-title">
        <Reveal>
          <h2 id="lp-steps-title" className="lp-ath-h2 lp-ath-h2--center">
            How It Works
          </h2>
        </Reveal>

        <div className="lp-ath-steps__pipeline" role="list">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} className="lp-ath-steps__node" role="listitem">
              <span className="lp-ath-steps__n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {i < STEPS.length - 1 ? <span className="lp-ath-steps__connector" aria-hidden /> : null}
            </Reveal>
          ))}
        </div>
      </section>

      {/* Meet the reps */}
      <section className="lp-ath-reps" id="meet-the-reps" aria-labelledby="lp-reps-title">
        <Reveal>
          <p className="lp-ath-kicker lp-ath-kicker--center">The standard</p>
          <h2 id="lp-reps-title" className="lp-ath-h2 lp-ath-h2--center lp-ath-h2--wide">
            Scores that unlock paid work.
          </h2>
          <p className="lp-ath-reps__note">
            Representative rep profiles with illustrative scorecards — not paid endorsements.
          </p>
        </Reveal>

        <div className="lp-ath-reps__grid">
          {REPS.map((rep) => (
            <Reveal key={rep.handle} className="lp-ath-reps__card">
              <img
                className="lp-ath-reps__avatar lp-ath-reps__avatar--photo"
                src={rep.photo}
                alt={`ColdCallReps SDR ${rep.handle}`}
                loading="lazy"
                decoding="async"
                width={400}
                height={400}
              />
              <p className="lp-ath-reps__badge">{rep.badge}</p>
              <strong className="lp-ath-reps__handle">{rep.handle}</strong>
              <p className="lp-ath-reps__stat">
                <em>{rep.stat}</em>
                <span>{rep.label}</span>
              </p>
              <p className="lp-ath-reps__detail">{rep.detail}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Fair & transparent */}
      <section className="lp-ath-trust lp-ath-zone--light" id="fair" aria-labelledby="lp-trust-title">
        <Reveal className="lp-ath-trust__inner">
          <div className="lp-ath-trust__media">
            <img
              src="/people/story-trust.webp"
              alt="An SDR and a brand founder agreeing on a fair, transparent deal"
              loading="lazy"
              decoding="async"
              width={1200}
              height={675}
            />
          </div>
          <div className="lp-ath-trust__copy">
            <p className="lp-ath-kicker">Fair &amp; transparent</p>
            <h2 id="lp-trust-title" className="lp-ath-h2">
              Honest work. Honest pay.
            </h2>
            <p className="lp-ath-sub lp-ath-trust__sub">
              No hoops, no games. Brands fund escrow up front, results are verified in the open, and
              payouts release the moment the work checks out — keeping reps and brands honest on both
              sides of every deal.
            </p>
            <ul className="lp-ath-trust__points">
              <li>
                <strong>Funded before you dial.</strong> Brands escrow the budget, so the money is
                already there when you deliver.
              </li>
              <li>
                <strong>Verified, not vibes.</strong> Every qualified lead or booked meeting is
                checked against clear criteria.
              </li>
              <li>
                <strong>Your hours, your ceiling.</strong> Set your own schedule and earn per
                result — there’s no cap on what you make.
              </li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Mid CTA */}
      <section className="lp-ath-sdr" id="for-sdrs" aria-labelledby="lp-sdr-title">
        <Reveal className="lp-ath-sdr__inner">
          <p className="lp-ath-kicker">Recruiting SDRs</p>
          <h2 id="lp-sdr-title" className="lp-ath-h2">
            Training + brand deals in one path.
          </h2>
          <p className="lp-ath-sub lp-ath-sdr__sub">
            Start free. Practice until you pass. Apply to campaigns and earn per verified result.
          </p>
          <div className="lp-ath-cta lp-ath-cta--left">
            <a href={MARKETPOUNCE_SIGN_UP_REP} className="lp-ath-btn lp-ath-btn--primary">
              Join as an SDR
            </a>
            <a href="/pricing" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              See practice pricing
            </a>
          </div>
        </Reveal>
      </section>

      {/* Proof bar */}
      <section className="lp-ath-proofbar" aria-label="Why reps join">
        <div className="lp-ath-proofbar__grid">
          <div>
            <strong>Free training minutes</strong>
            <span>Practice to prove yourself</span>
          </div>
          <div>
            <strong>$0 to join</strong>
            <span>Brand campaigns are free for reps</span>
          </div>
          <div>
            <strong>Earn payment per result</strong>
            <span>Paid when outcomes verify</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-ath-final lp-ath-final--climax" aria-labelledby="lp-final-title">
        <Reveal>
          <h2 id="lp-final-title" className="lp-ath-h2 lp-ath-h2--xl">
            Ready to train, prove, and get paid?
          </h2>
          <a href={MARKETPOUNCE_SIGN_UP_REP} className="lp-ath-btn lp-ath-btn--primary lp-ath-btn--xl">
            Start free as an SDR
          </a>
          <div className="lp-ath-final__alt">
            <a href="/for/reps">see the full SDR path →</a>
            <a href="/pricing">or check practice pricing →</a>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
