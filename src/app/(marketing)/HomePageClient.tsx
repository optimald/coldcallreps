'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import SignupLink from '@/components/SignupLink';
import { HOME_FAQS } from '@/lib/home-faq';
import './landing.css';

/** Hero starts visible so Messenger / no-hydration browsers never show a blank page. */
const heroReveal = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
} as const;

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
    body: 'Run realistic cold calls with a live AI coach. Generous free minutes are meant to cover training end-to-end — you should not need to pay. Buying extra minutes is only if free runs out.',
    Mock: MockPractice,
    photo: '/people/story-train.webp',
    alt: 'An SDR smiling while practicing a cold call with the AI voice coach',
  },
  {
    title: 'Brand Deals',
    body: 'Clear the quality gate, then apply. Brands provide the clients and lead lists — you dial their prospects. Campaigns stay $0 for reps; no fee to accept a brand.',
    Mock: MockDeals,
    photo: '/people/story-deals.webp',
    alt: 'An SDR excited after finding a brand deal they love selling for',
  },
  {
    title: 'Get Paid Per Result',
    body: 'Earn per booked meeting or qualified lead — typically ~$30–$40 per B2B appointment set, higher on harder deals. Paid through the platform (Stripe Connect live · Remitly coming soon). No earning ceiling.',
    Mock: MockPayout,
    photo: '/people/story-paid.webp',
    alt: 'An SDR working on her own hours and celebrating a verified payout',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Train',
    body: 'Practice with AI voice on real brand offers — generous free minutes are meant to cover training without paying.',
  },
  {
    n: '02',
    title: 'Prove',
    body: 'Hit the score gate. Build a profile brands trust.',
  },
  {
    n: '03',
    title: 'Apply',
    body: 'Unlock brand deals. Brands provide the leads — you pick campaigns that fit.',
  },
  {
    n: '04',
    title: 'Get Paid',
    body: 'Dial brand-provided leads. Get paid per verified result (Stripe Connect live · Remitly coming soon).',
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
            {...heroReveal}
          >
            Train. Prove. Get Paid.
          </motion.h1>

          <motion.p className="lp-ath-sub lp-ath-sub--hero lp-ath-sub--center" {...heroReveal}>
            For SDRs and appointment setters who want training and brand deals. Practice with AI
            voice, prove your score, then get paid to dial brand-provided leads — typically ~$30–$40
            per B2B appointment. Completely free to join. No earning ceiling.
          </motion.p>

          <motion.div className="lp-ath-cta lp-ath-cta--hero lp-ath-cta--center" {...heroReveal}>
            <SignupLink className="lp-ath-btn lp-ath-btn--primary">
              Join MarketPounce as an SDR
            </SignupLink>
            <a href="#how-it-works" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
              How it works
            </a>
          </motion.div>

          <motion.p className="lp-ath-proof lp-ath-proof--center" {...heroReveal}>
            Completely free · leads provided · Stripe Connect live · Remitly coming soon
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
                <strong>Leads provided.</strong> Brands hand you their clients and dial lists — you
                do not find your own.
              </li>
              <li>
                <strong>Funded before you dial.</strong> Brands escrow the budget. You get paid
                through the platform when results verify — Stripe Connect live, Remitly coming soon —
                not a side deal with the brand.
              </li>
              <li>
                <strong>No fee to join a brand.</strong> Campaigns are free for reps. A small capped
                commission comes out of each payout, not your pocket up front.
              </li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Mid CTA */}
      <section className="lp-ath-sdr" id="for-sdrs" aria-labelledby="lp-sdr-title">
        <Reveal className="lp-ath-sdr__inner">
          <div className="lp-ath-sdr__copy">
            <p className="lp-ath-kicker">Recruiting SDRs</p>
            <h2 id="lp-sdr-title" className="lp-ath-h2">
              Training + brand deals in one path.
            </h2>
            <p className="lp-ath-sub lp-ath-sdr__sub">
              Create your MarketPounce account free. Generous free practice covers training — buying
              minutes is the exception. Apply to campaigns — brands provide the leads — and earn per
              verified result.
            </p>
            <div className="lp-ath-cta lp-ath-cta--left">
              <SignupLink className="lp-ath-btn lp-ath-btn--primary">
                Join MarketPounce as an SDR
              </SignupLink>
              <a href="/pricing" className="lp-ath-btn lp-ath-btn--ghost lp-ath-btn--sub">
                Free to train
              </a>
            </div>
          </div>
          <div className="lp-ath-sdr__media">
            <img
              src="/people/story-join.webp"
              alt="Two SDRs training together and closing brand deals on ColdCallReps"
              loading="lazy"
              decoding="async"
              width={1200}
              height={900}
            />
          </div>
        </Reveal>
      </section>

      {/* Proof bar */}
      <section className="lp-ath-proofbar" aria-label="Why reps join">
        <div className="lp-ath-proofbar__grid">
          <div>
            <strong>Generous free training</strong>
            <span>You shouldn’t need to pay — buy minutes only if free runs out</span>
          </div>
          <div>
            <strong>Leads provided</strong>
            <span>Brands supply clients and dial lists</span>
          </div>
          <div>
            <strong>~$30–$40 / appt</strong>
            <span>Stripe Connect live · Remitly coming soon</span>
          </div>
        </div>
      </section>

      {/* FAQ — visible answers to the questions reps actually ask */}
      <section className="lp-ath-faq" id="faq" aria-labelledby="lp-faq-title">
        <Reveal>
          <p className="lp-ath-kicker">Straight answers</p>
          <h2 id="lp-faq-title" className="lp-ath-h2">
            What reps ask before they join
          </h2>
          <p className="lp-ath-faq__lead lp-ath-sub">
            Free to join. Leads provided. Paid through the platform. No fee to accept a brand.
          </p>
        </Reveal>
        <div className="lp-ath-faq__list">
          {HOME_FAQS.map((item) => (
            <details key={item.question} className="lp-ath-faq__item">
              <summary className="lp-ath-faq__q">{item.question}</summary>
              <div className="lp-ath-faq__a">
                <p>{item.answer}</p>
                {item.links && item.links.length > 0 ? (
                  <p className="lp-ath-faq__links">
                    {item.links.map((l, i) => (
                      <span key={l.href}>
                        {i > 0 ? ' · ' : null}
                        <a href={l.href} className="soft-link">
                          {l.label}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-ath-final lp-ath-final--climax" aria-labelledby="lp-final-title">
        <Reveal>
          <h2 id="lp-final-title" className="lp-ath-h2 lp-ath-h2--xl">
            Ready to train, prove, and get paid?
          </h2>
          <SignupLink className="lp-ath-btn lp-ath-btn--primary lp-ath-btn--xl">
            Join MarketPounce as an SDR
          </SignupLink>
          <div className="lp-ath-final__alt">
            <a href="/for/reps">see the full SDR path →</a>
            <a href="/pricing">or see free to train →</a>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
