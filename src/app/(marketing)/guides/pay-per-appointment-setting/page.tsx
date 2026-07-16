import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'pay-per-appointment-setting';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Pay for meetings, not seat time"
      ctaSub="Set an outcome payout, fund escrow, and pay only when a qualified meeting is booked and verified."
    >
      <section>
        <h2 className="guide-h2">What pay-per-appointment setting means</h2>
        <p>
          Pay-per-appointment setting is a compensation model where you pay a fixed amount for each
          qualified meeting a rep books, instead of paying a salary or hourly rate regardless of
          results. On Cold Call Reps, you set the per-outcome payout, fund escrow, and money releases
          only when a booked meeting passes audit. Your cost tracks booked outcomes, not headcount or
          hours.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Cost model: salary SDR vs pay-per-appointment</h2>
        <p>
          The core difference is <strong>fixed cost vs variable cost</strong>. A salaried SDR costs
          the same whether they book two meetings or twenty in a month; pay-per-appointment costs
          nothing until a meeting is verified.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col">Salaried SDR</th>
                <th scope="col">Pay-per-appointment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Cost structure</th>
                <td>Fixed salary + tooling + ramp</td>
                <td>Per verified meeting + capped 20% fee</td>
              </tr>
              <tr>
                <th scope="row">Cost when nothing books</th>
                <td>Full salary still owed</td>
                <td>≈ $0 in payouts</td>
              </tr>
              <tr>
                <th scope="row">Time to start</th>
                <td>Weeks to hire + ramp</td>
                <td>Days — fund and approve reps</td>
              </tr>
              <tr>
                <th scope="row">Money risk</th>
                <td>Paid before results</td>
                <td>Escrow releases on verified outcome</td>
              </tr>
              <tr>
                <th scope="row">Best at</th>
                <td>High, steady volume</td>
                <td>Variable volume, testing, validation</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Rule of thumb: pay-per-appointment wins when volume is uncertain or you are validating an
          offer; a salaried SDR can win once volume is high and steady enough that fixed cost per
          meeting falls below the per-outcome rate. For the build-vs-buy decision in full, see{' '}
          <Link href="/guides/hire-outbound-without-in-house-sdr">
            running outbound without an in-house SDR
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What an appointment costs here</h2>
        <p>
          Payouts use flat tier bands per verified set — High Volume $35–$60, Mid-Market $75–$120,
          Enterprise $150–$250+ — based on ICP difficulty and gatekeeper friction. On top of the
          payout, the platform fee is 20%, capped at $30 per outcome. So a $75 booked meeting costs
          $75 to the rep plus $15 in fee. See{' '}
          <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link> for the
          full breakdown and caps.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Escrow removes the “junk meeting” risk</h2>
        <p>
          The usual objection to pay-per-meeting is paying for weak or fake meetings. Escrow plus the
          claim audit closes that gap: a claimed meeting must show a qualified decision-maker and a
          calendar hold with supporting notes or transcript before funds release. If it does not pass,
          you are not charged. Read{' '}
          <Link href="/guides/campaign-escrow-and-claims">campaign escrow and claims</Link> for the
          full verification flow.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Adding base pay to attract stronger reps</h2>
        <p>
          Pure outcome pay can be a hard sell for top reps on longer sales cycles. You can stack
          optional <strong>base pay</strong> — weekly, bi-weekly, or monthly — on top of per-meeting
          payouts to lower rep risk and attract better talent. Base pay has its own fee caps of
          $40/wk, $75/bi-weekly, and $150/mo, so even a $2,000/mo base is capped at a $150 platform
          fee.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Where pay-per-appointment fits</p>
          <ul>
            <li>
              <strong>Booking, not closing.</strong> Reps qualify or book meetings; they do not close
              deals.
            </li>
            <li>
              <strong>Quality depends on your definition.</strong> Clear qualification criteria make
              the audit stronger and reduce disputes.
            </li>
            <li>
              <strong>Very high steady volume may favor in-house.</strong> At scale, a salaried team
              can be cheaper per meeting.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
