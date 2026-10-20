import type { Metadata } from 'next';
import Link from 'next/link';
import { buildGuideMetadata, getGuide } from '@/lib/guides';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import GuidePage from '../_components/GuidePage';

const SLUG = 'remote-cold-calling-jobs';
export const metadata: Metadata = buildGuideMetadata(SLUG);

export default function Page() {
  const guide = getGuide(SLUG)!;
  return (
    <GuidePage
      guide={guide}
      ctaTitle="Start finding remote cold calling jobs"
      ctaSub="Train free, clear the quality gate, and apply to funded brand campaigns you can run from anywhere."
    >
      <section>
        <h2 className="guide-h2">Remote cold calling jobs, without the call-center model</h2>
        <p>
          Most remote cold calling jobs are hourly call-center seats: fixed shifts, scripts you did
          not choose, and pay that stops when the shift does. Cold Call Reps runs the opposite
          model — <strong>funded brand campaigns that pay per verified meeting</strong>. A brand
          commits escrow before you dial; you book qualified meetings or leads; the audit passes;
          the money releases to your Stripe Connect account.
        </p>
        <p>
          Joining, training, and applying are <strong>free for reps worldwide</strong>, including
          the Philippines and other remote markets. You need a voice, a connection, and the craft —
          not a commute.
        </p>
      </section>

      <section>
        <h2 className="guide-h2">How you get hired remotely</h2>
        <ol className="guide-steps">
          <li>
            <strong>Train free with AI voice.</strong>
            <p>Rehearse gatekeepers, decision-makers, pricing objections, and rejection recovery with <Link href="/guides/ai-cold-call-practice">AI cold call practice</Link> until your score proves you are ready.</p>
          </li>
          <li>
            <strong>Clear the quality gate.</strong>
            <p>By default: one practice session on the brand pack, a score of 80+, and brand certification. Brands see that proof when you apply — see <Link href="/guides/sdr-applications-and-approval">applications and approval</Link>.</p>
          </li>
          <li>
            <strong>Dial live, from anywhere.</strong>
            <p>Approved reps place real calls to the brand&apos;s list. You are the human on the line; AI only coaches and audits.</p>
          </li>
          <li>
            <strong>Get paid per verified meeting.</strong>
            <p>High Volume $35–$60, Mid-Market $75–$120, Enterprise $150–$250+ per set. Full mechanics in <Link href="/guides/get-paid-per-meeting-cold-calling">how reps get paid per meeting</Link>.</p>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="guide-h2">Who remote gigs fit</h2>
        <p>
          Experienced SDRs who want outcome pay without a seat, appointment setters who want steady
          campaign access, and newer reps willing to train up first. Browse the broader market on{' '}
          <Link href="/guides/cold-calling-gigs">cold calling gigs</Link>, follow the{' '}
          <Link href="/for/reps">SDR path</Link>, check <Link href="/hire-cold-callers">hire cold callers</Link> for
          how brands see you, or <a href={MARKETPOUNCE_SIGN_UP_REP}>sign up free</a>.
        </p>
      </section>
    </GuidePage>
  );
}
