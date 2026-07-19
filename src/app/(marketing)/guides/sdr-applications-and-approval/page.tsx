import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import GuidePage from '../_components/GuidePage';

const SLUG = 'sdr-applications-and-approval';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Start your application path"
      ctaSub="Practice to your score, earn certification, and apply to campaigns that pay per verified outcome."
    >
      <section>
        <h2 className="guide-h2">How campaign access works</h2>
        <p>
          Cold Call Reps gates campaign access on <strong>proven skill</strong>, not resumes. Before
          you can dial for a brand, you clear an apply gate, submit an application, and get approved by
          the brand. This keeps first-touch quality high — which is exactly why brands trust the
          marketplace and fund escrow.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The apply gate</h2>
        <p>By default, to apply to a campaign you must:</p>
        <ol className="guide-steps">
          <li>
            <strong>Complete practice on the brand pack.</strong>
            <p>At least one practice session against the brand’s scenario pack.</p>
          </li>
          <li>
            <strong>Hit the score threshold.</strong>
            <p>Score at least 80 on your practice — proof you can handle the conversation.</p>
          </li>
          <li>
            <strong>Earn brand certification.</strong>
            <p>Certify on the brand pack so the brand knows you are conditioned for their offer.</p>
          </li>
        </ol>
        <p>
          Exact thresholds can vary by campaign, but practice and proof always come first. Build the
          skill with <Link href="/guides/ai-cold-call-practice">AI cold call practice</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What brands see when you apply</h2>
        <p>
          When you apply, the brand reviews your <strong>practice score</strong>,{' '}
          <strong>certification status</strong>, and <strong>public profile</strong>. Strong,
          consistent scores and completed certification make approval far more likely. A thin profile
          or a score below threshold is the most common reason to be passed over.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">Helps approval</th>
                <th scope="col">Hurts approval</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Practice score</th>
                <td>Consistently at or above threshold</td>
                <td>Below the campaign minimum</td>
              </tr>
              <tr>
                <th scope="row">Certification</th>
                <td>Completed on the brand pack</td>
                <td>Missing for the campaign</td>
              </tr>
              <tr>
                <th scope="row">Profile</th>
                <td>Complete, credible, verified path</td>
                <td>Incomplete or empty</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">After you’re approved</h2>
        <p>
          Approval unlocks live dialing for that campaign. From there you dial real prospects, submit
          outcome claims, and — once the AI post-call audit passes — get paid from escrow via Stripe
          Connect. See where this sits in the whole flow in{' '}
          <Link href="/guides/how-campaigns-work">how campaigns work</Link>, and the earning detail in{' '}
          <Link href="/guides/get-paid-per-meeting-cold-calling">how reps get paid per meeting</Link>.
          Looking for campaigns to apply to? Browse{' '}
          <Link href="/guides/cold-calling-gigs">cold calling gigs</Link> or open{' '}
          <a href={MARKETPOUNCE_SIGN_UP_REP}>brand deals</a>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Good to know</p>
          <ul>
            <li>
              <strong>Applying is free.</strong> Applying to and running campaigns costs nothing; plans
              only buy practice minutes.
            </li>
            <li>
              <strong>Approval is the brand’s call.</strong> Clearing the gate qualifies you to apply;
              the brand still approves or declines.
            </li>
            <li>
              <strong>Thresholds vary.</strong> Some campaigns set higher score or certification bars
              than the defaults.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
