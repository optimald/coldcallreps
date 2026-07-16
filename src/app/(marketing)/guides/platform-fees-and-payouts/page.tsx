import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'platform-fees-and-payouts';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="See exactly what you keep"
      ctaSub="One capped platform fee, transparent payouts through Stripe Connect. Check the full pricing breakdown."
    >
      <section>
        <h2 className="guide-h2">The fee in one line</h2>
        <p>
          Cold Call Reps keeps a <strong>20% platform fee on SDR payouts</strong>, with hard dollar
          caps so it never balloons on large amounts. Reps keep the rest. Every payout runs through
          Stripe Connect and releases from campaign escrow when a claim passes audit.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Fee</th>
                <th scope="col">Cap</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Per outcome (meeting / lead)</th>
                <td>20%</td>
                <td>$30 maximum</td>
              </tr>
              <tr>
                <th scope="row">Base pay — weekly</th>
                <td>20%</td>
                <td>$40/wk maximum</td>
              </tr>
              <tr>
                <th scope="row">Base pay — bi-weekly</th>
                <td>20%</td>
                <td>$75/bi-weekly maximum</td>
              </tr>
              <tr>
                <th scope="row">Base pay — monthly</th>
                <td>20%</td>
                <td>$150/mo maximum</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">Worked examples</h2>
        <p>These are the canonical examples from the platform fee policy:</p>
        <ul>
          <li>
            <strong>$75 booked meeting.</strong> 20% is $15, which is under the $30 cap — so the fee
            is $15 and the rep keeps $60.
          </li>
          <li>
            <strong>$200 enterprise set.</strong> 20% would be $40, but the per-outcome cap holds the
            fee at $30 — so the rep keeps $170.
          </li>
          <li>
            <strong>$2,000/mo base pay.</strong> A flat 20% would be $400, but the monthly cap holds
            the fee at $150 — not $400.
          </li>
        </ul>
        <p>
          The caps mean that on higher payouts, your effective fee percentage drops well below 20%.
          That is deliberate: the fee is designed not to be extractive on large bases or premium sets.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">How payouts reach reps</h2>
        <ol className="guide-steps">
          <li>
            <strong>Connect your Stripe account.</strong>
            <p>
              Reps finish Stripe Connect onboarding under Billing or Earnings. Approved payouts
              cannot land without it.
            </p>
          </li>
          <li>
            <strong>Deliver and claim an outcome.</strong>
            <p>A booked meeting or qualified lead is submitted with supporting evidence.</p>
          </li>
          <li>
            <strong>Pass the audit.</strong>
            <p>The AI post-call audit verifies the claim against the outcome definition.</p>
          </li>
          <li>
            <strong>Get paid from escrow.</strong>
            <p>
              The payout releases from the brand’s funded escrow to the rep’s Stripe account, minus
              the capped platform fee.
            </p>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="guide-h2">Where these numbers come from</h2>
        <p>
          The 20% rate, the $30 per-outcome cap, and the base-pay caps ($40/wk · $75/bi-weekly ·
          $150/mo) are the platform’s documented fee policy — the same figures shown on the{' '}
          <Link href="/pricing">pricing page</Link>. Escrow and audit determine <em>when</em> a payout
          is eligible; the fee determines the split. For the safety mechanics, see{' '}
          <Link href="/guides/campaign-escrow-and-claims">campaign escrow and claims</Link>, and for
          the rep-side earning view, see{' '}
          <Link href="/guides/get-paid-per-meeting-cold-calling">
            how reps get paid per meeting
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">What the fee does and does not cover</p>
          <ul>
            <li>
              <strong>The fee applies to SDR payouts.</strong> It is taken from the rep side of
              outcome and base payouts.
            </li>
            <li>
              <strong>Practice plans and lead credits are separate.</strong> Rep practice
              subscriptions and brand lead enrichment are billed on their own, not from campaign
              escrow.
            </li>
            <li>
              <strong>Stripe’s own processing terms apply.</strong> Payout timing and availability
              follow Stripe Connect.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
