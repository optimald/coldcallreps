import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'appointment-setting-marketplace';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Try the marketplace model"
      ctaSub="Post a campaign, connect directly with vetted human reps, and pay per verified outcome — no retainer."
    >
      <section>
        <h2 className="guide-h2">Defining the category</h2>
        <p>
          An appointment-setting marketplace connects brands directly with vetted human reps who book
          meetings for <strong>outcome-based pay</strong>, while the platform handles vetting, escrow,
          and payouts. It sits between two familiar options: hiring an in-house SDR (fixed cost, full
          control, slow to start) and hiring an agency (managed service, retainer, less direct
          control). The marketplace keeps direct control and pay-per-outcome economics.
        </p>
        <p>
          Cold Call Reps is an appointment-setting marketplace: brands fund escrow, application-gated
          reps dial, and money releases only on verified outcomes.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Marketplace vs agency vs in-house</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Cost</th>
                <th scope="col">Control</th>
                <th scope="col">Speed to start</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">In-house SDR</th>
                <td>Fixed salary + ramp</td>
                <td>Full</td>
                <td>Weeks</td>
              </tr>
              <tr>
                <th scope="row">Agency</th>
                <td>Retainer / monthly</td>
                <td>Lower (managed for you)</td>
                <td>Onboarding + ramp</td>
              </tr>
              <tr>
                <th scope="row">Marketplace</th>
                <td>Per verified outcome + capped fee</td>
                <td>High (you approve reps)</td>
                <td>Days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          For the direct agency comparison, see{' '}
          <Link href="/guides/cold-call-reps-vs-outbound-agency">
            Cold Call Reps vs an outbound agency
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Buyer checklist: what a good marketplace needs</h2>
        <p>Before choosing any appointment-setting marketplace, confirm all four:</p>
        <ol className="guide-steps">
          <li>
            <strong>Real escrow.</strong>
            <p>Is the budget funded and held until an outcome is verified? Cold Call Reps: yes.</p>
          </li>
          <li>
            <strong>Human callers.</strong>
            <p>Are live calls placed by people, not AI autodialers? Cold Call Reps: humans only.</p>
          </li>
          <li>
            <strong>Defined, audited outcomes.</strong>
            <p>
              Is a booked meeting or qualified lead clearly defined and verified? Cold Call Reps: AI
              post-call audit on every claim.
            </p>
          </li>
          <li>
            <strong>Transparent fees.</strong>
            <p>
              Are fees clear and capped? Cold Call Reps: 20%, capped at $30 per outcome and
              $40/$75/$150 on base.
            </p>
          </li>
        </ol>
        <p>
          Details live in <Link href="/guides/campaign-escrow-and-claims">escrow and claims</Link> and{' '}
          <Link href="/guides/platform-fees-and-payouts">fees and payouts</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">When to use a marketplace</h2>
        <p>
          Reach for a marketplace when you want to start outbound quickly, run variable volume, or
          validate an offer before committing to payroll. If your volume is high and steady, compare
          against building in-house in{' '}
          <Link href="/guides/hire-outbound-without-in-house-sdr">
            running outbound without an in-house SDR
          </Link>
          . To get started operationally, the{' '}
          <Link href="/guides/hire-cold-callers">hire cold callers</Link> guide walks the steps.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">What a marketplace is not</p>
          <ul>
            <li>
              <strong>Not a done-for-you agency.</strong> You define the offer and approve reps; it is
              not fully hands-off.
            </li>
            <li>
              <strong>Not a closing service.</strong> Reps book and qualify; closing is your team’s
              job.
            </li>
            <li>
              <strong>Not AI dialing.</strong> Humans place live calls; AI only trains and audits.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
