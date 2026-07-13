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

const VERTICALS = ['B2B SaaS', 'Commercial Real Estate', 'Logistics & Freight', 'High-Ticket Agencies'];

export default function HomePageClient({ faqs }: { faqs: readonly HomeFaqItem[] }) {
  return (
    <main className="lp-athletic">
      {/* ─── Hero: full-bleed video + left overlay ─── */}
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
          <motion.p
            className="lp-ath-pretext"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            Human outbound. Optimized by AI.
          </motion.p>

          <motion.h1
            id="lp-hero-title"
            className="lp-ath-h1 lp-ath-h1--hero"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.04 }}
          >
            Stop cold calling yourself.
            <span className="lp-ath-h1__lead">
              Get booked meetings from sales athletes trained on your product — not generic AI robots.
            </span>
          </motion.h1>

          <motion.p
            className="lp-ath-sub lp-ath-sub--hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            We condition independent SDRs with low-latency AI voice practice on your offer. Only
            high-scoring reps unlock your campaigns. You pay when they deliver qualified leads or
            booked meetings — escrow-backed.
          </motion.p>

          <motion.div
            className="lp-ath-cta lp-ath-cta--hero"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
          >
            <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--primary">
              Generate Leads
            </Link>
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--ghost">
              Join as an SDR
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── Verticals strip ─── */}
      <section className="lp-ath-marquee" aria-label="Active verticals">
        <span className="lp-ath-marquee__label">Active pipeline across</span>
        <div className="lp-ath-marquee__row">
          {VERTICALS.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </section>

      {/* ─── Train → Call → Book ─── */}
      <section className="lp-ath-bridge" id="how-it-works">
        <Reveal>
          <h2 className="lp-ath-h2">You build the product. We fill the calendar.</h2>
          <p className="lp-ath-sub" style={{ marginLeft: 0, marginBottom: '2rem', textAlign: 'left' }}>
            Skip dialer stacks and mailbox ops. Buy outcomes from performance-gated humans.
          </p>
        </Reveal>

        <div className="lp-ath-tri">
          <Reveal className="lp-ath-col">
            <p className="lp-ath-col__label">Train</p>
            <h3 className="lp-ath-col__title">Performance-gated setters</h3>
            <p className="lp-ath-col__body">
              Reps pass brand-specific voice sims — gatekeepers, objections, transfers — before they
              touch your list.
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
            <h3 className="lp-ath-col__title">Humans on the dial</h3>
            <p className="lp-ath-col__body">
              Real voices. Live AI coaching. No robocalls getting blocked by corporate gatekeepers.
            </p>
            <div className="lp-ath-mock lp-ath-mock--volume" aria-hidden>
              <span>Live dials</span>
              <span>Your script</span>
              <span>Your ICP</span>
            </div>
          </Reveal>

          <Reveal className="lp-ath-col">
            <p className="lp-ath-col__label">Book</p>
            <h3 className="lp-ath-col__title">Escrow-backed results</h3>
            <p className="lp-ath-col__body">
              Meetings land on your calendar. Capital releases only after post-call AI verifies a
              real appointment.
            </p>
            <div className="lp-ath-gift" aria-hidden>
              <strong>Meeting booked</strong>
              <span>Discovery · Thu 2:00p · Escrow released</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Lead fuel ─── */}
      <section className="lp-ath-fuel" id="lead-fuel">
        <div className="lp-ath-fuel__grid">
          <Reveal>
            <p className="lp-ath-kicker">Lead fuel</p>
            <h2 className="lp-ath-h2">Your reps dial people who can actually buy.</h2>
            <p className="lp-ath-sub" style={{ marginLeft: 0, maxWidth: '42ch' }}>
              Tell us who you sell to and where. We hand your team a clean list of reachable
              decision-makers — so every dial has a shot at a real conversation.
            </p>
            <div className="lp-ath-fuel__points">
              <div className="lp-ath-fuel__point">
                <i aria-hidden />
                <div>
                  <h4>Right accounts</h4>
                  <p>Businesses that match your ICP — not a scrapyard of random listings.</p>
                </div>
              </div>
              <div className="lp-ath-fuel__point">
                <i aria-hidden />
                <div>
                  <h4>Numbers that pick up</h4>
                  <p>Direct lines worth dialing, so reps stop burning time on dead ends.</p>
                </div>
              </div>
              <div className="lp-ath-fuel__point">
                <i aria-hidden />
                <div>
                  <h4>Ready when they are</h4>
                  <p>Leads land in the queue dial-ready — no spreadsheet babysitting before the first call.</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="lp-ath-fuel-card" aria-hidden>
            <p className="lp-ath-fuel-card__eyebrow">Your dial queue · today</p>
            <strong className="lp-ath-fuel-card__stat">298</strong>
            <span className="lp-ath-fuel-card__label">decision-makers ready to call</span>
            <ul className="lp-ath-fuel-card__list">
              <li>
                <span>Matched to your ICP</span>
                <em>Commercial plumbing · Chicago</em>
              </li>
              <li>
                <span>Reachable lines</span>
                <em>Direct / mobile verified</em>
              </li>
              <li>
                <span>Queued for setters</span>
                <em>Live campaign unlocked</em>
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ─── Matching ─── */}
      <section className="lp-ath-lab" id="lab">
        <Reveal>
          <h2 className="lp-ath-h2">High scores unlock real campaigns.</h2>
          <p className="lp-ath-sub" style={{ marginLeft: 0, marginTop: '0.75rem', maxWidth: '46ch' }}>
            Proven skill beats resumes. Only reps who crush brand-specific practice get paid gigs.
          </p>
        </Reveal>

        <div className="lp-ath-lab-grid">
          <Reveal className="lp-ath-card">
            <p className="lp-ath-card__eyebrow">For SDRs</p>
            <h3>Train. Prove. Get paid.</h3>
            <p>
              Practice on the brand pack with AI voice. Hit the score gate. Apply to live campaigns
              and earn on booked meetings.
            </p>
            <Link href="/sign-up?role=REP" className="lp-ath-link">
              Join as an SDR →
            </Link>
          </Reveal>

          <Reveal className="lp-ath-card">
            <p className="lp-ath-card__eyebrow">For brands</p>
            <h3>Post a campaign. Only battle-tested reps apply.</h3>
            <p>
              You set price per lead and choose qualified lead or booked appointment. Pay only when
              the goal is met.
            </p>
            <Link href="/sign-up?role=BRAND" className="lp-ath-link" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Post a Campaign →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="lp-ath-faq" id="faq" aria-labelledby="lp-faq-title">
        <Reveal>
          <p className="lp-ath-kicker">FAQ</p>
          <h2 id="lp-faq-title" className="lp-ath-h2">
            Straight answers before you dial.
          </h2>
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
            Lock escrow, fuel the list, and let verified sales athletes run outbound.
          </p>
          <div className="lp-ath-cta">
            <Link href="/sign-up?role=BRAND" className="lp-ath-btn lp-ath-btn--primary">
              Generate Leads
            </Link>
            <Link href="/sign-up?role=REP" className="lp-ath-btn lp-ath-btn--ghost">
              Join as an SDR
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
