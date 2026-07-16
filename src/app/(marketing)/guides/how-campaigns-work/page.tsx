import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'how-campaigns-work';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="See a campaign from your side"
      ctaSub="Whether you post the work or run the dials, the same funded, audited lifecycle protects you."
    >
      <section>
        <h2 className="guide-h2">One campaign, two views</h2>
        <p>
          A Cold Call Reps campaign is a single timeline that both the brand and the rep move through.
          The brand posts and funds the work; the rep trains, applies, dials, and claims; the platform
          runs the quality gate, the audit, and the payout rails. Understanding both sides makes it
          clear why the model is fair to each.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The lifecycle, end to end</h2>
        <ol className="guide-steps">
          <li>
            <strong>Post &amp; fund.</strong>
            <p>
              The brand defines the offer, list, outcome payout, and optional base pay, then funds
              escrow so the budget is committed before dialing.
            </p>
          </li>
          <li>
            <strong>Train &amp; apply.</strong>
            <p>
              Reps practice against the brand pack with AI voice, hit the score threshold, earn
              certification, and apply through the quality gate.
            </p>
          </li>
          <li>
            <strong>Approve.</strong>
            <p>
              The brand reviews applicants’ scores and certifications and approves the reps who can
              dial the campaign.
            </p>
          </li>
          <li>
            <strong>Dial live.</strong>
            <p>
              Approved human reps call the never-contacted list. AI coaches and later audits — it does
              not place live calls.
            </p>
          </li>
          <li>
            <strong>Claim.</strong>
            <p>Reps submit booked meetings and qualified leads with supporting evidence.</p>
          </li>
          <li>
            <strong>Audit.</strong>
            <p>An AI post-call audit verifies each claim against the outcome definition.</p>
          </li>
          <li>
            <strong>Pay out.</strong>
            <p>
              Passing claims release from escrow to the rep via Stripe Connect, minus the platform
              fee. Unreleased funds stay in the brand’s budget.
            </p>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="guide-h2">Who does what</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Brand</th>
                <th scope="col">Rep</th>
                <th scope="col">Platform</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Setup</th>
                <td>Defines offer &amp; funds escrow</td>
                <td>Practices to score</td>
                <td>Hosts AI trainer &amp; gate</td>
              </tr>
              <tr>
                <th scope="row">Access</th>
                <td>Approves applicants</td>
                <td>Applies with score + cert</td>
                <td>Enforces the apply gate</td>
              </tr>
              <tr>
                <th scope="row">Execution</th>
                <td>Monitors progress</td>
                <td>Dials &amp; claims outcomes</td>
                <td>Runs the claim audit</td>
              </tr>
              <tr>
                <th scope="row">Payment</th>
                <td>Pays verified outcomes</td>
                <td>Gets paid (less fee)</td>
                <td>Releases escrow via Stripe</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">Where each piece is explained in depth</h2>
        <p>
          This guide is the map; the details live in focused guides. For the money-safety layer, read{' '}
          <Link href="/guides/campaign-escrow-and-claims">campaign escrow and claims</Link>. For the
          fee split and Stripe payouts, read{' '}
          <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link>. For how
          reps get approved, read{' '}
          <Link href="/guides/sdr-applications-and-approval">SDR applications and approval</Link>.
          Brands can start on <Link href="/for/brands">for brands</Link>; reps on{' '}
          <Link href="/for/reps">for reps</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Boundaries of the model</p>
          <ul>
            <li>
              <strong>Humans dial; AI does not.</strong> Live brand calls are always placed by people.
            </li>
            <li>
              <strong>Book or qualify, not close.</strong> Campaigns pay for meetings and leads, not
              closed deals.
            </li>
            <li>
              <strong>Verification gates payment.</strong> Only claims that pass audit release funds.
            </li>
            <li>
              <strong>Timing varies.</strong> Dials start once a campaign is funded and reps clear the
              gate.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
