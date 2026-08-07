import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAN, TRIAL_MINUTES } from '@/lib/product';
import { PLATFORM_FEE_EXAMPLES } from '@/lib/platform-fees';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

export const metadata: Metadata = {
  title: 'Free to train. Brands pay you.',
  description:
    'ColdCallReps is free for SDRs: polish with AI practice, train on the brand offer, clear the gate, then get paid by brands. Brands fund the tool — reps never pay to earn.',
};

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-head">
        <p className="pricing-kicker">For SDRs</p>
        <h1 className="pricing-title">Free to train. Brands pay you.</h1>
        <p className="pricing-lede">
          You’re here to earn on brand deals — not buy a practice subscription. Free AI practice is
          how you polish, learn the brand offer, and clear the quality gate. Brands fund escrow and
          the desk. You get paid when verified results land.
        </p>
      </header>

      <section className="pricing-hero-free" aria-labelledby="pricing-free-title">
        <p className="pricing-hero-free__label">The deal for reps</p>
        <h2 id="pricing-free-title" className="pricing-hero-free__minutes">
          $0 to practice · $0 to join campaigns
        </h2>
        <p className="pricing-hero-free__sub">
          Start with {TRIAL_MINUTES}+ free practice minutes — enough to get sharp on the brand pack
          and apply. No card required.
        </p>
        <ol className="pricing-path">
          <li>
            <strong>Polish</strong> — AI voice practice + scorecards
          </li>
          <li>
            <strong>Train the offer</strong> — rehearse the brand pack until you clear the gate
          </li>
          <li>
            <strong>Get paid</strong> — brands fund escrow; you earn on verified meetings and leads
          </li>
        </ol>
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="btn pricing-hero-free__cta">
          Join MarketPounce as an SDR
        </a>
        <p className="pricing-hero-free__fine">
          ColdCallReps by MarketPounce · accounts created on MarketPounce
        </p>
      </section>

      <section className="pricing-promise" aria-labelledby="pricing-promise-title">
        <h2 id="pricing-promise-title" className="pricing-promise__title">
          Why practice isn’t a paywall
        </h2>
        <p>
          Charging people who are trying to earn is the wrong model. Free practice is how we recruit
          and qualify talent. If you burn through free minutes, take a short break (same idea as
          free ChatGPT / Claude limits) or move on to brand deals you’ve already unlocked —
          upgrading is never required to get paid.
        </p>
      </section>

      <section className="pricing-fees">
        <h2 className="pricing-fees__title">How your payouts work</h2>
        <p className="pricing-fees__lede">
          Brands fund escrow. One platform fee is capped so your take-home stays strong.
        </p>
        <div className="pricing-fees__grid">
          <div className="pricing-fee">
            <strong>20%</strong>
            <span>Platform fee on SDR payouts</span>
          </div>
          <div className="pricing-fee">
            <strong>$30</strong>
            <span>Max fee per outcome payout</span>
          </div>
          <div className="pricing-fee">
            <strong>$40 · $75 · $150</strong>
            <span>Base-pay fee caps · wk / bi-weekly / mo</span>
          </div>
        </div>
        <p className="pricing-fees__example">{PLATFORM_FEE_EXAMPLES}</p>
      </section>

      <details className="pricing-optional">
        <summary>Teams &amp; heavy practice (not required to earn)</summary>
        <div className="pricing-optional__body">
          <p>
            Most SDRs never need this. Optional plans exist for sales orgs or reps who want extra AI
            practice volume — not to unlock campaigns or payouts.
          </p>
          <ul>
            <li>
              <strong>Starter</strong> · ${PLAN.STARTER.price}/mo · {PLAN.STARTER.minutes} practice
              minutes / mo
            </li>
            <li>
              <strong>Pro</strong> · ${PLAN.PRO.price}/mo · {PLAN.PRO.minutes} practice minutes / mo
              + recording storage
            </li>
            <li>
              <strong>Org</strong> · ${PLAN.TEAM.price}/user/mo · shared minute pool for managed teams
            </li>
          </ul>
          <p className="pricing-optional__note">
            Brand deals stay free either way. Brands pay for the growth desk and escrow — reps pay
            nothing to earn.
          </p>
        </div>
      </details>

      <p className="pricing-foot">
        <Link href="/for/reps" className="soft-link">
          SDR path
        </Link>
        {' · '}
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="soft-link">
          Join free and get paid
        </a>
      </p>
    </main>
  );
}
