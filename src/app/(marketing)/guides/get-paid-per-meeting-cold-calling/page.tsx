import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'get-paid-per-meeting-cold-calling';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Get paid for the meetings you book"
      ctaSub="Train, apply, dial, and claim. Verified outcomes pay out from funded escrow via Stripe Connect."
    >
      <section>
        <h2 className="guide-h2">How rep earnings work</h2>
        <p>
          On Cold Call Reps you earn per <strong>outcome</strong>, not per hour. Two outcome types
          pay: a <strong>booked meeting</strong> (a calendar hold with a qualified decision-maker) and
          a <strong>qualified lead</strong>. You claim each outcome, it passes an AI post-call audit,
          and the payout releases from the brand’s funded escrow to your Stripe Connect account — minus
          the platform fee.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Outcome types and accelerators</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Earning component</th>
                <th scope="col">How it works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Booked meeting</th>
                <td>Paid per verified calendar hold with a qualified decision-maker</td>
              </tr>
              <tr>
                <th scope="row">Qualified lead</th>
                <td>Paid per lead that meets the campaign’s qualification bar</td>
              </tr>
              <tr>
                <th scope="row">Tiered accelerator</th>
                <td>Higher effective pay as you deliver more verified volume and quality</td>
              </tr>
              <tr>
                <th scope="row">Optional base pay</th>
                <td>Weekly, bi-weekly, or monthly base that stacks on top of outcome pay</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Payout rates follow flat tier bands per verified set: High Volume $35–$60, Mid-Market
          $75–$120, and Enterprise $150–$250+, depending on ICP difficulty and gatekeeper friction.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What you keep after fees</h2>
        <p>
          The platform fee is 20% of your payout, capped at $30 per outcome. Because of the cap, your
          effective take-home percentage improves on larger sets:
        </p>
        <ul>
          <li>
            <strong>$75 booked meeting →</strong> $15 fee, you keep <strong>$60</strong>.
          </li>
          <li>
            <strong>$200 enterprise set →</strong> fee capped at $30, you keep <strong>$170</strong>.
          </li>
          <li>
            <strong>Base pay caps →</strong> $40/wk, $75/bi-weekly, $150/mo, so a large base is never
            eaten by fees.
          </li>
        </ul>
        <p>
          Full detail and more examples are in{' '}
          <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Getting paid, start to finish</h2>
        <ol className="guide-steps">
          <li>
            <strong>Set up Stripe Connect.</strong>
            <p>Finish Connect onboarding under Billing or Earnings — payouts cannot land without it.</p>
          </li>
          <li>
            <strong>Deliver an outcome.</strong>
            <p>Book a qualified meeting or deliver a qualified lead on a live campaign.</p>
          </li>
          <li>
            <strong>Claim with evidence.</strong>
            <p>Submit the calendar hold, notes, or transcript that proves the outcome.</p>
          </li>
          <li>
            <strong>Pass audit and get paid.</strong>
            <p>Once the AI post-call audit passes, escrow releases your payout, minus the fee.</p>
          </li>
        </ol>
        <p>
          New to campaigns? Start with{' '}
          <Link href="/guides/cold-calling-gigs">finding cold calling gigs</Link>, and sharpen your
          score first with <Link href="/guides/ai-cold-call-practice">AI cold call practice</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">What to keep in mind</p>
          <ul>
            <li>
              <strong>Only verified claims pay.</strong> Weak evidence means no payout for that claim.
            </li>
            <li>
              <strong>You book, you do not close.</strong> Outcome pay is for qualified meetings and
              leads, not closed deals.
            </li>
            <li>
              <strong>Base pay is campaign-dependent.</strong> Many campaigns are outcome-only; each
              shows its structure before you apply.
            </li>
            <li>
              <strong>Stripe Connect is required.</strong> Onboarding must be complete before any
              payout.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
