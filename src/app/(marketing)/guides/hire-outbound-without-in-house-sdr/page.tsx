import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'hire-outbound-without-in-house-sdr';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Run outbound before you hire"
      ctaSub="Validate your offer and pipeline with pay-per-outcome reps — then hire in-house once volume justifies it."
    >
      <section>
        <h2 className="guide-h2">You don’t have to hire first</h2>
        <p>
          The instinct is to hire an SDR to “do outbound.” But hiring means fixed salary, tooling, and
          weeks of ramp <em>before</em> you know whether your offer, list, and message convert on the
          phone. An outcome-based marketplace flips the order: you run outbound now, pay only for
          verified meetings, and learn what works before you commit to payroll.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Decision tree: in-house, marketplace, or agency</h2>
        <p>Use this to pick a path based on where you are:</p>
        <ol className="guide-steps">
          <li>
            <strong>Is your volume high and steady, with budget for ramp?</strong>
            <p>If yes, an in-house SDR can be cheapest per meeting over time.</p>
          </li>
          <li>
            <strong>Do you want speed, variable volume, and direct control?</strong>
            <p>
              If yes, use a marketplace — post, fund escrow, approve reps, and pay per verified
              outcome.
            </p>
          </li>
          <li>
            <strong>Do you need a fully managed team and will pay a retainer?</strong>
            <p>If yes, an agency fits — you trade control for done-for-you service.</p>
          </li>
          <li>
            <strong>Still unsure or pre-validation?</strong>
            <p>
              Start on a marketplace to prove the motion, then hire in-house once volume is high and
              steady.
            </p>
          </li>
        </ol>
        <p>
          For the head-to-head on the last option, see{' '}
          <Link href="/guides/cold-call-reps-vs-outbound-agency">
            Cold Call Reps vs an outbound agency
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The cost comparison</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col">In-house SDR</th>
                <th scope="col">Marketplace</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Upfront commitment</th>
                <td>Salary + tooling + ramp</td>
                <td>Fund escrow for the campaign</td>
              </tr>
              <tr>
                <th scope="row">Cost when nothing books</th>
                <td>Full salary owed</td>
                <td>≈ $0 in payouts</td>
              </tr>
              <tr>
                <th scope="row">Time to first dials</th>
                <td>Weeks (hire + ramp)</td>
                <td>Days (fund + approve)</td>
              </tr>
              <tr>
                <th scope="row">Quality control</th>
                <td>You train &amp; manage</td>
                <td>Score gate + certification + audit</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The compensation math is covered in{' '}
          <Link href="/guides/pay-per-appointment-setting">pay-per-appointment setting</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Quality without an in-house team</h2>
        <p>
          Skipping the hire does not mean skipping quality control. Reps are gated by practice score
          and brand certification before they can dial, you approve each applicant, and every outcome
          is audited before it pays. You get quality guardrails without building and managing a
          training program. The operational how-to is in{' '}
          <Link href="/guides/hire-cold-callers">how to hire cold callers</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">When to still hire in-house</p>
          <ul>
            <li>
              <strong>Very high, steady volume.</strong> Fixed cost per meeting can beat per-outcome
              rates at scale.
            </li>
            <li>
              <strong>Deep product complexity.</strong> Some motions benefit from a dedicated,
              embedded rep.
            </li>
            <li>
              <strong>Booking, not closing.</strong> The marketplace books and qualifies; your team
              still closes.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
