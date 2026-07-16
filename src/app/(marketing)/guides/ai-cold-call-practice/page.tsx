import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import GuidePage from '../_components/GuidePage';

const SLUG = 'ai-cold-call-practice';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Practice free, then go earn"
      ctaSub="Rehearse with an AI voice trainer, hit your score, and unlock live brand campaigns."
    >
      <section>
        <h2 className="guide-h2">What AI practice is for</h2>
        <p>
          AI cold call practice on Cold Call Reps is a rehearsal environment. You run realistic voice
          roleplays against an AI trainer, get coached in real time, and earn a score that proves you
          are ready. The point is to build skill and pass the quality gate before you dial real
          prospects — so your first live call is not your first call ever.
        </p>
        <p>
          Crucially, <strong>the AI never places live brand calls</strong>. It is a practice partner,
          a coach, and a claim auditor. All live dialing is done by human reps. Cold Call Reps is not
          an autodialer.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">The trainer vs live dial boundary</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Who / what does it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Roleplay scenarios &amp; coaching</th>
                <td>AI voice trainer + live coach</td>
              </tr>
              <tr>
                <th scope="row">Scoring &amp; certification</th>
                <td>AI quality gate</td>
              </tr>
              <tr>
                <th scope="row">Live brand calls</th>
                <td>Human reps only</td>
              </tr>
              <tr>
                <th scope="row">Post-call claim audit</th>
                <td>AI audit</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="guide-h2">What you can rehearse</h2>
        <p>Practice scenarios map to the situations that actually decide a cold call:</p>
        <ul>
          <li>
            <strong>Gatekeeper navigation</strong> — getting past the front line to the
            decision-maker.
          </li>
          <li>
            <strong>Decision-maker conversations</strong> — opening strong and holding the frame.
          </li>
          <li>
            <strong>Pricing objections</strong> — handling cost pushback without folding.
          </li>
          <li>
            <strong>Rejection recovery</strong> — staying composed and keeping the call alive.
          </li>
        </ul>
        <p>
          Consistent practice builds the score and certification you need to apply. See{' '}
          <Link href="/guides/sdr-applications-and-approval">SDR applications and approval</Link> for
          exactly how the gate uses your practice.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">What practice costs</h2>
        <p>
          Practice is where the plans matter — not the gigs. Free includes practice minutes to start;
          Starter is $7/mo and Pro is $29/mo for more minutes and coaching tools. Running brand
          campaigns stays free for reps, so plans only ever buy practice, never campaign access. See
          the <Link href="/pricing">pricing page</Link> for the full breakdown, and{' '}
          <Link href="/guides/get-paid-per-meeting-cold-calling">how reps get paid</Link> for the
          earning side.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Why practice keeps paying off</h2>
        <p>
          Reps who keep practicing after going live tend to hold higher scores, warm up before live
          blocks, and qualify for higher-tier campaigns and accelerators. Practice is not a one-time
          gate to clear — it is the training habit that compounds into more earnings. Ready to find
          work? Start with <Link href="/guides/cold-calling-gigs">cold calling gigs</Link>.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">Limitations and scope</h2>
        <div className="guide-callout">
          <p className="guide-callout__title">Set expectations</p>
          <ul>
            <li>
              <strong>Practice is not a live call.</strong> The AI simulates prospects; it does not
              call real people for you.
            </li>
            <li>
              <strong>Minutes are metered by plan.</strong> Free has a starter allotment; paid plans
              add more.
            </li>
            <li>
              <strong>Score thresholds still apply.</strong> Practice alone does not unlock a
              campaign — you must hit the gate and earn certification.
            </li>
          </ul>
        </div>
      </section>
    </GuidePage>
  );
}
