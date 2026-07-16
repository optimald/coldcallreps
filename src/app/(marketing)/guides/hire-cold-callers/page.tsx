import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'hire-cold-callers';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Ready to hire cold callers?"
      ctaSub="Post a campaign, fund escrow, and let vetted human reps book meetings — you only pay for verified results."
    >
      <section>
        <h2 className="guide-h2">What hiring cold callers on Cold Call Reps looks like</h2>
        <p>
          Traditional hiring means recruiting, interviewing, onboarding, and paying a salary before
          you know whether outbound will work for your offer. Cold Call Reps replaces that with an
          outcome-based marketplace: you describe the campaign, fund an escrow budget, and{' '}
          <strong>application-gated human reps</strong> dial your never-contacted list. You pay when
          a rep delivers a verified booked meeting or qualified lead — not for dial time, and never
          for the close.
        </p>
        <p>
          The model is built for founders and lean revenue teams who want first-touch volume without
          the fixed cost and ramp risk of a full-time SDR. Because reps are paid per outcome from a
          funded escrow, your spend tracks results instead of headcount.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">How it works, step by step</h2>
        <ol className="guide-steps">
          <li>
            <strong>Post a campaign.</strong>
            <p>
              Define your offer, target list, the outcome you pay for (booked meeting or qualified
              lead), the payout tier, and any optional base pay.
            </p>
          </li>
          <li>
            <strong>Fund escrow.</strong>
            <p>
              Your campaign budget is committed up front so reps know the money is real. Nothing
              releases until an outcome is verified.
            </p>
          </li>
          <li>
            <strong>Reps apply through the quality gate.</strong>
            <p>
              Reps practice against your brand pack with AI voice, hit the required score, and earn
              certification before they can apply. You review and approve applicants.
            </p>
          </li>
          <li>
            <strong>Humans dial live.</strong>
            <p>
              Approved reps place real calls to your list. AI is used only for their practice,
              coaching, and the post-call audit — it never dials for them.
            </p>
          </li>
          <li>
            <strong>Claims are audited and paid.</strong>
            <p>
              Reps claim outcomes; an AI post-call audit checks the evidence; passing claims release
              from escrow to the rep via Stripe Connect, minus the platform fee.
            </p>
          </li>
        </ol>
        <p>
          For the full lifecycle from both the brand and rep side, see{' '}
          <Link href="/guides/how-campaigns-work">how campaigns work</Link>. To understand exactly
          how money is protected, read{' '}
          <Link href="/guides/campaign-escrow-and-claims">campaign escrow and claims</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What it costs</h2>
        <p>
          You set the per-outcome payout using flat tier bands based on how hard the prospect is to
          reach and qualify. On top of the rep payout, Cold Call Reps keeps a{' '}
          <strong>20% platform fee, capped at $30 per outcome</strong>.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Per verified set</th>
                <th scope="col">Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">High Volume</th>
                <td>$35–$60</td>
                <td>Local services, SMB software, agencies — lower gatekeeper friction</td>
              </tr>
              <tr>
                <th scope="row">Mid-Market</th>
                <td>$75–$120</td>
                <td>B2B SaaS, mid-level managers — BANT screening + script conditioning</td>
              </tr>
              <tr>
                <th scope="row">Enterprise</th>
                <td>$150–$250+</td>
                <td>C-suite / complex tech — extreme gatekeeper resistance</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          You can also add optional <strong>base pay</strong> (weekly, bi-weekly, or monthly) to
          attract stronger reps; it stacks on top of outcome pay and has its own fee caps of $40/wk,
          $75/bi-weekly, and $150/mo. See{' '}
          <Link href="/guides/platform-fees-and-payouts">platform fees and payouts</Link> for worked
          examples, or the <Link href="/pricing">pricing page</Link> for the full picture.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">How reps are vetted</h2>
        <p>
          Every rep clears an apply gate before they can dial for you. By default that means
          completing at least one practice session on your brand pack, scoring at least 80, and
          earning brand certification. You then see each applicant’s score and certification and
          approve or decline. This keeps first-touch quality high without you managing a training
          program. For the rep’s view of this process, see{' '}
          <Link href="/guides/sdr-applications-and-approval">SDR applications and approval</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">What Cold Call Reps does not do</p>
          <ul>
            <li>
              <strong>No closing.</strong> Reps qualify or book — they do not close deals or handle
              full-cycle sales. Closer compensation is out of scope by design.
            </li>
            <li>
              <strong>No AI placing live calls.</strong> Humans dial every live brand call; AI is
              limited to practice, coaching, and claim audits. This is not an autodialer.
            </li>
            <li>
              <strong>Outcomes must be verifiable.</strong> A booked meeting needs a calendar hold
              with a qualified decision-maker plus notes or transcript to pass audit and pay.
            </li>
            <li>
              <strong>Payouts require Stripe Connect.</strong> Reps must complete Connect onboarding
              before approved payouts can land.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
