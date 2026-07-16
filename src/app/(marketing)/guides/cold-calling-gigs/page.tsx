import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'cold-calling-gigs';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Start finding paid cold calling gigs"
      ctaSub="Train free, clear the quality gate, and apply to brand campaigns that pay per booked meeting or qualified lead."
    >
      <section>
        <h2 className="guide-h2">Where cold calling gigs come from on Cold Call Reps</h2>
        <p>
          Most “cold calling gigs” online are either hourly call-center roles or vague commission
          promises with no protection that you will actually get paid. Cold Call Reps is different:
          gigs are <strong>brand campaigns funded in escrow</strong>. A brand commits a budget before
          you dial, you deliver verified outcomes, and the money releases to you. The gig and the pay
          are tied to the same funded campaign.
        </p>
        <p>
          Joining and running campaigns is <strong>free for reps</strong>. There is no fee to apply
          and no cut of your pay beyond the standard platform fee. Paid plans exist only to buy more
          AI practice minutes and coaching tools — they are never required to take a gig.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The path: train → apply → dial → claim</h2>
        <ol className="guide-steps">
          <li>
            <strong>Train with AI voice.</strong>
            <p>
              Practice gatekeeper navigation, decision-maker conversations, pricing objections, and
              rejection recovery. Practice builds the score you need to apply.
            </p>
          </li>
          <li>
            <strong>Apply through the quality gate.</strong>
            <p>
              Complete at least one practice session on the brand pack, hit the score threshold
              (80 by default), and earn certification. Then apply to the campaign.
            </p>
          </li>
          <li>
            <strong>Dial live prospects.</strong>
            <p>
              Once approved, you place real calls to the brand’s never-contacted list. You are the
              human on the line — AI only coaches and audits.
            </p>
          </li>
          <li>
            <strong>Claim your outcomes and get paid.</strong>
            <p>
              Submit each booked meeting or qualified lead. Once the AI post-call audit passes, the
              payout releases from escrow to your Stripe Connect account.
            </p>
          </li>
        </ol>
        <p>
          For the mechanics of getting approved, see{' '}
          <Link href="/guides/sdr-applications-and-approval">SDR applications and approval</Link>.
          For how the earnings actually add up, see{' '}
          <Link href="/guides/get-paid-per-meeting-cold-calling">
            how reps get paid per meeting
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What you can earn</h2>
        <p>
          Payouts use flat tier bands per verified set, so you know the rate before you dial — no
          bidding wars:
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Per verified set</th>
                <th scope="col">Typical difficulty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">High Volume</th>
                <td>$35–$60</td>
                <td>Lower gatekeeper friction, faster reps</td>
              </tr>
              <tr>
                <th scope="row">Mid-Market</th>
                <td>$75–$120</td>
                <td>Stricter screening, script conditioning</td>
              </tr>
              <tr>
                <th scope="row">Enterprise</th>
                <td>$150–$250+</td>
                <td>C-suite, heavy gatekeeper resistance</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Some campaigns add optional base pay on top of outcome pay, and tiered accelerators reward
          volume and quality. There is no hard ceiling on outcome earnings — it scales with how
          skilled, fast, and consistent you are.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Who this is for</h2>
        <p>
          Signup is global, including reps in the Philippines and other remote markets. It fits
          experienced SDRs looking for flexible outcome pay, appointment setters who want steady
          campaign access, and newer reps willing to train up before dialing. If you treat the dial
          like a craft, the model rewards it. Read more on the{' '}
          <Link href="/for/reps">for reps</Link> page.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Set expectations before you apply</p>
          <ul>
            <li>
              <strong>You must clear the gate.</strong> No score and certification means no campaign
              access. Practice is the entry ticket.
            </li>
            <li>
              <strong>Only verified outcomes pay.</strong> A claim without enough evidence of a
              qualified, booked outcome does not release money.
            </li>
            <li>
              <strong>You are booking, not closing.</strong> Gigs pay for qualified meetings and
              leads — not for closing deals.
            </li>
            <li>
              <strong>Payouts need Stripe Connect.</strong> Finish Connect onboarding under Billing
              or Earnings before payouts can land.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
