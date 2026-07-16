import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'cold-call-reps-vs-outbound-agency';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Compare the models for your team"
      ctaSub="Pay-per-outcome with direct control and escrow, or a managed retainer — start free and see which fits."
    >
      <section>
        <h2 className="guide-h2">The core trade-off</h2>
        <p>
          Cold Call Reps is an <strong>outcome-based marketplace</strong>: you pay vetted human reps
          per verified meeting through escrow, with no retainer, and you keep direct control over the
          offer, list, and who dials. A traditional <strong>outbound agency</strong> is a managed
          service you pay via retainer or monthly fee whether or not meetings get booked. The trade-off
          is fixed managed service versus variable, escrow-backed, pay-per-outcome cost with more
          hands-on control.
        </p>
        <p>
          The comparisons below describe the <em>general</em> outbound-agency model, not any specific
          provider. Evaluate your shortlist against your own contract terms.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Side by side</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Cold Call Reps (marketplace)</th>
                <th scope="col">Outbound agency (typical)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Cost structure</th>
                <td>Per verified outcome + capped 20% fee</td>
                <td>Retainer / monthly fee</td>
              </tr>
              <tr>
                <th scope="row">Pay when nothing books</th>
                <td>≈ $0 in payouts</td>
                <td>Retainer still due</td>
              </tr>
              <tr>
                <th scope="row">Control</th>
                <td>You set offer, list, payout; approve reps</td>
                <td>Managed for you</td>
              </tr>
              <tr>
                <th scope="row">Speed to start</th>
                <td>Days — fund &amp; approve reps</td>
                <td>Onboarding + ramp</td>
              </tr>
              <tr>
                <th scope="row">Money protection</th>
                <td>Escrow releases on verified outcome</td>
                <td>Prepaid retainer</td>
              </tr>
              <tr>
                <th scope="row">Who dials</th>
                <td>Vetted human reps you approve</td>
                <td>Agency’s assigned reps</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">How escrow changes the risk</h2>
        <p>
          The biggest structural difference is where your risk sits. With a retainer you pay first and
          hope for meetings. With Cold Call Reps, your budget sits in escrow and releases only on
          outcomes that pass audit — so your spend is tied to verified meetings, not a prepayment. Reps
          benefit too: the budget is funded before they dial. Read the mechanics in{' '}
          <Link href="/guides/campaign-escrow-and-claims">campaign escrow and claims</Link> and the fee
          math in <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Which should you choose?</h2>
        <p>
          Choose the marketplace when you want direct control, variable volume, fast starts, and
          pay-per-outcome economics. Choose an agency when you specifically want a fully managed team,
          strategy, and reporting handled for you, and you will pay a retainer for that service. Many
          teams start on the marketplace to validate, then layer in other channels. For the category
          context, see{' '}
          <Link href="/guides/appointment-setting-marketplace">
            what an appointment-setting marketplace is
          </Link>
          , and for the build-vs-buy angle,{' '}
          <Link href="/guides/hire-outbound-without-in-house-sdr">
            running outbound without an in-house SDR
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Read this before deciding</p>
          <ul>
            <li>
              <strong>Marketplace is not fully hands-off.</strong> You define the offer and approve
              reps; an agency does more for you.
            </li>
            <li>
              <strong>Both book, neither closes here.</strong> Cold Call Reps pays for qualified
              meetings and leads, not closed deals.
            </li>
            <li>
              <strong>Agency terms vary widely.</strong> Compare specific contracts; the “typical”
              column is a general description.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
