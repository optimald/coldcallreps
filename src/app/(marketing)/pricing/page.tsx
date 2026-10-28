import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAN, TRIAL_MINUTES } from '@/lib/product';
import { PLATFORM_FEE_EXAMPLES } from '@/lib/platform-fees';
import SignupLink from '@/components/SignupLink';

export const metadata: Metadata = {
  title: 'Free to train. Brands pay you.',
  description:
    'ColdCallReps is free for SDRs: generous free AI practice (buying minutes is the exception), brand-provided leads, paid per verified appointment. Stripe Connect live; Remitly coming soon.',
};

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-head">
        <p className="pricing-kicker">For SDRs</p>
        <h1 className="pricing-title">Free to train. Brands pay you.</h1>
        <p className="pricing-lede">
          You’re here to earn — not buy a subscription. The free tier is generous on purpose: enough
          AI practice to unlock Resume and clear the gate without paying. Brands provide the clients
          and lead lists. You get paid when verified appointments land — typically ~$30–$40 per B2B
          set.
        </p>
      </header>

      <section className="pricing-hero-free" aria-labelledby="pricing-free-title">
        <p className="pricing-hero-free__label">The deal for reps</p>
        <h2 id="pricing-free-title" className="pricing-hero-free__minutes">
          $0 to practice · $0 to join campaigns · leads provided
        </h2>
        <p className="pricing-hero-free__sub">
          Start with {TRIAL_MINUTES}+ free practice minutes — meant to cover training end-to-end. No
          card required. Buying extra minutes is only if you burn through free and want more
          practice.
        </p>
        <ol className="pricing-path">
          <li>
            <strong>Polish</strong> — generous free AI voice practice + scorecards
          </li>
          <li>
            <strong>Apply</strong> — brands provide leads; no fee to accept a campaign
          </li>
          <li>
            <strong>Get paid</strong> — Stripe Connect live · Remitly coming soon
          </li>
        </ol>
        <SignupLink className="btn pricing-hero-free__cta">
          Join MarketPounce as an SDR
        </SignupLink>
        <p className="pricing-hero-free__fine">
          ColdCallReps by MarketPounce · accounts created on MarketPounce
        </p>
      </section>

      <section className="pricing-promise" aria-labelledby="pricing-promise-title">
        <h2 id="pricing-promise-title" className="pricing-promise__title">
          Why practice isn’t a paywall
        </h2>
        <p>
          Charging people who are trying to earn is the wrong model. The free tier is generous so
          you can train, unlock Resume, and clear the gate without paying. Buying extra minutes is
          the exception — only if you burn through free and want more practice. Upgrading is never
          required to get paid on brand deals.
        </p>
      </section>

      <section className="pricing-fees">
        <h2 className="pricing-fees__title">How your payouts work</h2>
        <p className="pricing-fees__lede">
          Brands fund escrow on MarketPounce. You get paid through the platform — not as a side deal
          with the brand. Stripe Connect is live where supported; Remitly payouts — coming soon. No
          fee to accept a brand; a small capped commission comes out of each payout (not a bill you
          pay up front).
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
            Brand deals stay free either way. Brands fund the desk and escrow — you never pay a fee
            to join a brand. The capped commission only comes out of verified payouts.
          </p>
        </div>
      </details>

      <p className="pricing-foot">
        <Link href="/for/reps" className="soft-link">
          SDR path
        </Link>
        {' · '}
        <SignupLink className="soft-link">
          Join free and get paid
        </SignupLink>
      </p>
    </main>
  );
}
