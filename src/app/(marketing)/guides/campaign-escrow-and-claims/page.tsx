import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'campaign-escrow-and-claims';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Fund a campaign with confidence"
      ctaSub="Escrow protects both sides: reps know the budget is real, and you only pay for outcomes that pass audit."
    >
      <section>
        <h2 className="guide-h2">Why escrow exists</h2>
        <p>
          Outbound has a trust problem on both sides. Reps worry a brand will not pay after they do
          the work; brands worry they will pay for meetings that never happen or do not qualify. Cold
          Call Reps solves this with <strong>campaign escrow plus a claim audit</strong>. The brand’s
          budget is committed before dialing starts, and money only moves when an outcome is verified.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The fund → dial → verify → pay flow</h2>
        <ol className="guide-steps">
          <li>
            <strong>Fund.</strong>
            <p>
              The brand commits a campaign budget to escrow. This proves the money exists and defines
              what pool payouts draw from.
            </p>
          </li>
          <li>
            <strong>Dial.</strong>
            <p>
              Approved human reps call the brand’s never-contacted list. Every live call is placed by
              a person; AI handles only coaching and the later audit.
            </p>
          </li>
          <li>
            <strong>Claim.</strong>
            <p>
              A rep submits an outcome — a booked meeting or a qualified lead — with supporting
              evidence such as a calendar hold, notes, or transcript.
            </p>
          </li>
          <li>
            <strong>Audit.</strong>
            <p>
              An AI post-call audit checks the claim against the outcome definition. Strong evidence
              passes; thin or unqualified claims do not.
            </p>
          </li>
          <li>
            <strong>Pay.</strong>
            <p>
              Passing claims release from escrow to the rep via Stripe Connect, minus the platform
              fee. Unreleased funds stay in the brand’s budget.
            </p>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="guide-h2">What counts as a verified outcome</h2>
        <p>
          A <strong>booked meeting</strong> is a claimed outcome that passes AI post-call audit —
          typically a calendar hold with a qualified decision-maker, supported by notes or transcript.
          A <strong>qualified lead</strong> similarly must meet the campaign’s qualification bar with
          evidence. Claims without enough evidence do not pay. This is what keeps brands from paying
          for junk and keeps the marketplace honest for everyone.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Who holds the risk at each stage</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Brand</th>
                <th scope="col">Rep</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Before dialing</th>
                <td>Budget committed to escrow</td>
                <td>Knows the budget is funded</td>
              </tr>
              <tr>
                <th scope="row">Claim submitted</th>
                <td>No charge yet</td>
                <td>Awaiting audit result</td>
              </tr>
              <tr>
                <th scope="row">Claim passes</th>
                <td>Pays for a verified outcome</td>
                <td>Paid via Stripe Connect (less fee)</td>
              </tr>
              <tr>
                <th scope="row">Claim fails</th>
                <td>Funds stay in budget</td>
                <td>No payout for that claim</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">How this connects to fees and the full lifecycle</h2>
        <p>
          Escrow is the money-safety layer; fees are how the platform is paid. Cold Call Reps keeps a
          20% platform fee on rep payouts, capped at $30 per outcome and $40/wk · $75/bi-weekly ·
          $150/mo on base pay — see{' '}
          <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link> for worked
          examples. To see where escrow sits in the end-to-end campaign, read{' '}
          <Link href="/guides/how-campaigns-work">how campaigns work</Link>. If you are hiring, the{' '}
          <Link href="/guides/hire-cold-callers">hire cold callers</Link> guide walks the brand side.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Important boundaries</p>
          <ul>
            <li>
              <strong>Audit is evidence-based.</strong> Outcomes need supporting evidence; an
              unverifiable claim will not release funds.
            </li>
            <li>
              <strong>Escrow covers campaign payouts.</strong> Lead enrichment credits and rep
              practice plans are billed separately from campaign escrow.
            </li>
            <li>
              <strong>Payouts route through Stripe Connect.</strong> Reps must finish Connect
              onboarding before any release can land.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
