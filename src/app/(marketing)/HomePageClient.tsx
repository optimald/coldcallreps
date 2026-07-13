'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { HomeFaqItem } from '@/lib/home-faq';
import './landing.css';

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
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
    <div ref={ref} className={`lp-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}

const METRICS = [
  { label: 'Objection handling', value: 92 },
  { label: 'Tone control', value: 88 },
  { label: 'Script stamina', value: 95 },
];

const BOARD = [
  { rank: '01', name: 'alex.r', score: '94' },
  { rank: '02', name: 'nina.k', score: '91' },
  { rank: '03', name: 'devon.w', score: '89' },
];

export default function HomePageClient({ faqs }: { faqs: readonly HomeFaqItem[] }) {
  return (
    <main className="lp-athletic">
      {/* ─── Hero: full-bleed video + overlay copy/CTAs ─── */}
      <section className="lp-ath-hero" aria-labelledby="lp-hero-title">
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

        <div className="lp-ath-hero__overlay">
          <motion.h1
            id="lp-hero-title"
            className="lp-ath-h1 lp-ath-h1--hero"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            Stop cold calling yourself.
            <span className="lp-ath-h1__lead">
              Get booked meetings from reps who actually trained on your product.
            </span>
          </motion.h1>

          <motion.p
            className="lp-ath-sub lp-ath-sub--hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            We train independent SDRs with realistic AI voice practice on your offer. Only
            high-scoring reps can run your campaigns. You pay only when they deliver qualified
            leads or booked meetings.
          </motion.p>

          <motion.div
            className="lp-ath-cta lp-ath-cta--hero"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14 }}
          >
            <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--primary">
              Post a Campaign
            </Link>
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--ghost">
              Join as an SDR
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── Value proposition ─── */}
      <section className="lp-ath-bridge" id="how-it-works">
        <Reveal>
          <h2 className="lp-ath-h2">You build the product. We fill the calendar.</h2>
        </Reveal>

        <div className="lp-ath-tri">
          <Reveal className="lp-ath-col">
            <p className="lp-ath-col__label">Train</p>
            <h3 className="lp-ath-col__title">Product-Ready Reps</h3>
            <p className="lp-ath-col__body">
              Trained on your pitch, objections, and ICP. They hit the gatekeeper, handle pushback,
              and earn the transfer — before they ever call your leads.
            </p>
            <div className="lp-ath-bio" aria-hidden>
              {METRICS.map((m) => (
                <div key={m.label} className="lp-ath-bio__row">
                  <span>{m.label}</span>
                  <div className="lp-ath-bio__bar">
                    <i style={{ width: `${m.value}%` }} />
                  </div>
                  <strong>{m.value}</strong>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal className="lp-ath-col lp-ath-col--center">
            <p className="lp-ath-col__label">Call</p>
            <h3 className="lp-ath-col__title">Humans on the Dial</h3>
            <p className="lp-ath-col__body">
              Real reps. Real voices. Live AI coaching during calls. No robocalls. Just sharp,
              prepared humans representing your brand.
            </p>
            <div className="lp-ath-mock lp-ath-mock--volume" aria-hidden>
              <span>Live dials</span>
              <span>Your script</span>
              <span>Your ICP</span>
            </div>
          </Reveal>

          <Reveal className="lp-ath-col">
            <p className="lp-ath-col__label">Book</p>
            <h3 className="lp-ath-col__title">Meetings on Your Calendar</h3>
            <p className="lp-ath-col__body">
              Verified booked meetings land directly in your Google or Microsoft calendar. Clean
              data pushed to Close.com. No guesswork.
            </p>
            <div className="lp-ath-gift" aria-hidden>
              <strong>Meeting booked</strong>
              <span>Discovery · Thu 2:00p · Calendar synced</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Matching ─── */}
      <section className="lp-ath-lab" id="lab">
        <Reveal>
          <h2 className="lp-ath-h2">High scores unlock real campaigns.</h2>
          <p className="lp-ath-sub" style={{ marginLeft: 0, marginTop: '0.75rem', maxWidth: '46ch' }}>
            Proven skill beats resumes. Only reps who consistently crush brand-specific practice get
            access to paid gigs.
          </p>
        </Reveal>

        <div className="lp-ath-lab-grid">
          <Reveal className="lp-ath-card">
            <p className="lp-ath-card__eyebrow">For SDRs</p>
            <h3>Score high. Get matched. Get paid for booked meetings.</h3>
            <p>
              Train on the brand pack, hit the score gate, then apply. Winners get activated onto
              live campaigns.
            </p>
            <Link href="/sign-up?role=REP" className="lp-ath-link">
              Join as an SDR →
            </Link>
          </Reveal>

          <Reveal className="lp-ath-card">
            <p className="lp-ath-card__eyebrow">For Brands</p>
            <h3>Post a campaign. Only battle-tested reps can apply.</h3>
            <p>You only pay for results — qualified leads or booked meetings.</p>
            <div className="lp-ath-rank" aria-label="Example top scorers">
              {BOARD.map((r) => (
                <div key={r.rank} className="lp-ath-rank__row">
                  <span>{r.rank}</span>
                  <span>{r.name}</span>
                  <strong>{r.score}</strong>
                </div>
              ))}
            </div>
            <Link href="/sign-up?role=BRAND" className="lp-ath-link" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Post a Campaign →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── SDR testimonial ─── */}
      <section className="lp-ath-quote" id="sdr-story" aria-labelledby="lp-sdr-quote-title">
        <Reveal>
          <h2 id="lp-sdr-quote-title" className="lp-ath-kicker">
            From an SDR
          </h2>
        </Reveal>
        <div className="lp-ath-quote__grid">
          <Reveal className="lp-ath-quote__copy">
            <blockquote className="lp-ath-quote__text">
              “I trained on the brand pack for 3 days, hit the score, and booked 11 meetings in my
              first month.”
            </blockquote>
            <p className="lp-ath-quote__by">
              <strong>Maya R.</strong>
              <span>Independent SDR</span>
            </p>
            <Link href="/sign-up?role=REP" className="lp-ath-link">
              Join as an SDR →
            </Link>
          </Reveal>
          <Reveal className="lp-ath-quote__media">
            <div className="lp-ath-video" role="img" aria-label="SDR testimonial video placeholder">
              <div className="lp-ath-video__frame">
                <span className="lp-ath-video__label">Video coming soon</span>
                <span className="lp-ath-video__play" aria-hidden>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Brand testimonial ─── */}
      <section className="lp-ath-quote lp-ath-quote--brand" id="brand-story" aria-labelledby="lp-brand-quote-title">
        <Reveal>
          <h2 id="lp-brand-quote-title" className="lp-ath-kicker">
            From a Founder
          </h2>
        </Reveal>
        <div className="lp-ath-quote__grid lp-ath-quote__grid--flip">
          <Reveal className="lp-ath-quote__media">
            <div className="lp-ath-video" role="img" aria-label="Brand testimonial video placeholder">
              <div className="lp-ath-video__frame">
                <span className="lp-ath-video__label">Video coming soon</span>
                <span className="lp-ath-video__play" aria-hidden>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
            </div>
          </Reveal>
          <Reveal className="lp-ath-quote__copy">
            <blockquote className="lp-ath-quote__text">
              “We posted a campaign and only high-scoring SDRs could apply. They already knew our
              pitch — meetings showed up on the calendar the same week.”
            </blockquote>
            <p className="lp-ath-quote__by">
              <strong>Jordan K.</strong>
              <span>Founder @ B2B SaaS</span>
            </p>
            <Link href="/sign-up?role=BRAND" className="lp-ath-link">
              Post a Campaign →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── FAQ (before final CTA) ─── */}
      <section className="lp-ath-faq" id="faq" aria-labelledby="lp-faq-title">
        <Reveal>
          <p className="lp-ath-kicker">FAQ</p>
          <h2 id="lp-faq-title" className="lp-ath-h2">
            Straight answers before you dial.
          </h2>
          <p className="lp-ath-sub lp-ath-faq__lead">
            Practice plans, campaign gates, payouts, and what we are — and aren’t.
          </p>
        </Reveal>

        <div className="lp-ath-faq__list">
          {faqs.map((item) => (
            <details key={item.question} className="lp-ath-faq__item">
              <summary className="lp-ath-faq__q">{item.question}</summary>
              <div className="lp-ath-faq__a">
                <p>{item.answer}</p>
                {item.links && item.links.length > 0 ? (
                  <p className="lp-ath-faq__links">
                    {item.links.map((link, i) => (
                      <span key={link.href}>
                        {i > 0 ? <span aria-hidden> · </span> : null}
                        <Link href={link.href} className="lp-ath-link">
                          {link.label}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="lp-ath-final">
        <Reveal>
          <h2 className="lp-ath-h2 lp-ath-h2--xl">
            Stop guessing on live leads.
            <br />
            Start putting in the reps.
          </h2>
          <p className="lp-ath-sub lp-ath-sub--final">
            Join the platform where founders get qualified outbound without becoming full-time
            callers.
          </p>
          <div className="lp-ath-cta">
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--primary">
              Sign Up as a Rep
            </Link>
            <Link href="/gigs" className="lp-ath-btn lp-ath-btn--ghost">
              Browse Brand Deals
            </Link>
            <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--ghost">
              Post a Campaign
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
