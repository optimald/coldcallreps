'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
    return () => io.disconnect();
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

function MockLeads() {
  return (
    <BrowserFrame title="coldcallreps.com · Lead Finder">
      <div className="lp-ath-mockui lp-ath-mockui--leads">
        <div className="lp-ath-mockui__bar">
          <span>Lead Finder</span>
          <em>ICP · Commercial · Midwest</em>
        </div>
        <div className="lp-ath-mockui__statrow">
          <div>
            <strong>298</strong>
            <span>matched</span>
          </div>
          <div>
            <strong>94%</strong>
            <span>reachable</span>
          </div>
        </div>
        <ul className="lp-ath-mockui__queue">
          <li className="is-active">
            <strong>Apex Plumbing</strong>
            <span>Owner · Chicago · Ready</span>
          </li>
          <li>
            <strong>Northline Freight</strong>
            <span>VP Ops · Dallas · Ready</span>
          </li>
        </ul>
      </div>
    </BrowserFrame>
  );
}

function MockPayout() {
  return (
    <BrowserFrame title="coldcallreps.com/campaigns">
      <div className="lp-ath-mockui lp-ath-mockui--payout">
        <p className="lp-ath-mockui__label">Result verified</p>
        <h3>Meeting booked</h3>
        <p className="lp-ath-mockui__detail">Discovery · Thu 2:00p · ICP confirmed</p>
        <div className="lp-ath-mockui__escrow">
          <div>
            <span>Escrow</span>
            <strong>$175</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className="is-ok">Released</strong>
          </div>
        </div>
        <p className="lp-ath-mockui__pass">Pay per result · brand charged only on success</p>
      </div>
    </BrowserFrame>
  );
}

const FEATURES = [
  {
    title: 'Trained SDRs',
    body: "Independent reps practice realistic calls on your exact offer using AI voice simulation until they're ready.",
    Mock: MockPractice,
  },
  {
    title: 'Ready-to-Call Leads',
    body: 'Enrich your list or find new prospects with one click — clean, researched, and dial-ready.',
    Mock: MockLeads,
  },
  {
    title: 'Pay Per Result',
    body: 'Set your own price per qualified lead or booked meeting. Only pay for success.',
    Mock: MockPayout,
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Post Your Campaign',
    body: 'Share your offer and set your price per result.',
  },
  {
    n: '02',
    title: 'Get Matched',
    body: 'Only high-scoring, trained SDRs can apply.',
  },
  {
    n: '03',
    title: 'Reps Execute',
    body: 'They call using our workspace with live AI coaching.',
  },
  {
    n: '04',
    title: 'Receive Results',
    body: 'Booked meetings land on your calendar.',
  },
] as const;

/** Anonymized illustrative scorecards — not attributed testimonials. */
const REPS = [
  {
    handle: '@setter_north',
    badge: 'Top performer',
    stat: '94',
    label: 'Integrity score',
    detail: 'Gatekeeper → DM',
    tone: 'a',
  },
  {
    handle: '@booked_west',
    badge: 'Top performer',
    stat: '212',
    label: 'Practice calls logged',
    detail: 'Campaign unlocked',
    tone: 'b',
  },
  {
    handle: '@dial_ridge',
    badge: 'Top performer',
    stat: 'Top 5%',
    label: 'Scorecard rank',
    detail: 'Objection handling',
    tone: 'c',
  },
  {
    handle: '@close_line',
    badge: 'Top performer',
    stat: '91',
    label: 'Tone control',
    detail: 'Live coach sessions',
    tone: 'd',
  },
] as const;

const LEAD_ROWS = [
  { name: 'Apex Plumbing', title: 'Owner · Chicago', score: '94', status: 'Ready' },
  { name: 'Northline Freight', title: 'VP Ops · Dallas', score: '91', status: 'Ready' },
] as const;

export default function HomePageClient() {
  return (
    <main className="lp-athletic">
      {/* 3.2 Hero */}
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
            Stop cold calling yourself.
          </motion.h1>

          <motion.p
            className="lp-ath-sub lp-ath-sub--hero lp-ath-sub--center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            Get booked meetings from real SDRs who trained on <em>your</em> product with AI voice
            practice. Only high-scoring reps run your campaigns. You pay only when they deliver
            results.
          </motion.p>

          <motion.div
            className="lp-ath-cta lp-ath-cta--hero lp-ath-cta--center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
          >
            <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--primary">
              Post a Campaign
            </Link>
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              Join as an SDR
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 3.3 Feature screenshots — Option A */}
      <section className="lp-ath-features" id="value" aria-labelledby="lp-value-title">
        <Reveal>
          <h2 id="lp-value-title" className="lp-ath-h2 lp-ath-h2--billboard">
            You build the product. We deliver the calls.
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
                <feature.Mock />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3.4 How It Works — light zone */}
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

      {/* 3.5 Meet the Reps */}
      <section className="lp-ath-reps" id="meet-the-reps" aria-labelledby="lp-reps-title">
        <Reveal>
          <p className="lp-ath-kicker lp-ath-kicker--center">Meet the reps</p>
          <h2 id="lp-reps-title" className="lp-ath-h2 lp-ath-h2--center lp-ath-h2--wide">
            Real humans. Proven scores.
          </h2>
          <p className="lp-ath-reps__note">
            Illustrative scorecards from the practice gym — anonymized handles, not paid endorsements.
          </p>
        </Reveal>

        <div className="lp-ath-reps__grid">
          {REPS.map((rep) => (
            <Reveal key={rep.handle} className="lp-ath-reps__card">
              <span className={`lp-ath-reps__avatar lp-ath-reps__avatar--${rep.tone}`} aria-hidden>
                {rep.handle.slice(1, 3).toUpperCase()}
              </span>
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

      {/* 3.6 For SDRs */}
      <section className="lp-ath-sdr" id="for-sdrs" aria-labelledby="lp-sdr-title">
        <Reveal className="lp-ath-sdr__inner">
          <p className="lp-ath-kicker">For SDRs</p>
          <h2 id="lp-sdr-title" className="lp-ath-h2">
            Train. Prove. Get Paid.
          </h2>
          <p className="lp-ath-sub lp-ath-sdr__sub">
            Practice on real brand offers. Build your score. Unlock paid campaigns and earn per
            result.
          </p>
          <div className="lp-ath-cta lp-ath-cta--left">
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--primary">
              Join as an SDR
            </Link>
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              Start Free Practice
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 3.7 Lead Finder — light zone, supporting */}
      <section
        className="lp-ath-finder lp-ath-finder--compact lp-ath-zone--light"
        id="lead-fuel"
        aria-labelledby="lp-finder-title"
      >
        <div className="lp-ath-finder__grid">
          <Reveal>
            <p className="lp-ath-kicker">Optional fuel</p>
            <h2 id="lp-finder-title" className="lp-ath-h2">
              Find Better Leads in One Click
            </h2>
            <p className="lp-ath-sub lp-ath-finder__sub">
              Need a list? Enrich yours or find new prospects — then let trained reps dial.
            </p>
          </Reveal>

          <Reveal className="lp-ath-finder__mock lp-ath-finder__mock--compact" aria-hidden>
            <div className="lp-ath-finder__bar">
              <span>Lead Finder</span>
              <em>1-click enrich</em>
            </div>
            <ul className="lp-ath-finder__list">
              {LEAD_ROWS.map((row) => (
                <li key={row.name}>
                  <div>
                    <strong>{row.name}</strong>
                    <span>{row.title}</span>
                  </div>
                  <div className="lp-ath-finder__meta">
                    <em>{row.score}</em>
                    <b className="is-ready">{row.status}</b>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 3.8 Proof bar — only non-fabricated facts */}
      <section className="lp-ath-proofbar" aria-label="Platform proof">
        <div className="lp-ath-proofbar__grid">
          <div>
            <strong>~20%</strong>
            <span>Platform fee on results</span>
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

      {/* 3.9 Final CTA */}
      <section className="lp-ath-final lp-ath-final--climax" aria-labelledby="lp-final-title">
        <Reveal>
          <h2 id="lp-final-title" className="lp-ath-h2 lp-ath-h2--xl">
            Ready to get outbound without doing the calling?
          </h2>
          <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--primary lp-ath-btn--xl">
            Post a Campaign
          </Link>
          <div className="lp-ath-final__alt">
            <Link href="/sign-up?role=REP">or join as an SDR →</Link>
            <Link href="/sign-up?role=REP">or start free practice →</Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
