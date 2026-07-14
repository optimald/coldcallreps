import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for ColdCallReps — AI voice practice, quality gates, and paid outbound campaigns.',
};

const sectionTitle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.2rem',
  marginTop: '2rem',
  marginBottom: '0.65rem',
};

const body: CSSProperties = {
  color: 'var(--muted)',
  lineHeight: 1.7,
  marginBottom: '0.85rem',
};

const list: CSSProperties = {
  color: 'var(--muted)',
  lineHeight: 1.75,
  paddingLeft: '1.25rem',
  marginBottom: '0.85rem',
};

export default function TermsPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.5rem' }}>
        Terms of Service
      </h1>
      <p style={{ ...body, fontSize: '0.95rem' }}>Last updated: July 13, 2026</p>

      <p style={body}>
        These Terms of Service (“Terms”) govern your access to and use of ColdCallReps
        (coldcallreps.com) and related products, including AI voice practice, scorecards,
        leaderboards, hiring profiles, brand campaigns, and payouts (the “Service”). By creating an
        account or using the Service, you agree to these Terms.
      </p>

      <h2 style={sectionTitle}>1. Who we are</h2>
      <p style={body}>
        ColdCallReps (“we”, “us”, “our”) operates a training-first outbound marketplace: reps practice
        with AI voice, prove quality, and can get paid to run outbound for brands and founders. Brand
        customers fund campaigns; reps may receive payouts for approved results.
      </p>

      <h2 style={sectionTitle}>2. Accounts & eligibility</h2>
      <p style={body}>
        You must provide accurate account information and keep credentials secure. You are
        responsible for activity under your account. If you use the Service on behalf of a company,
        you represent that you have authority to bind that company to these Terms.
      </p>

      <h2 style={sectionTitle}>3. The Service (what it is — and isn’t)</h2>
      <ul style={list}>
        <li>
          Practice scores, badges, streaks, and leaderboards are <strong style={{ color: 'var(--ink)' }}>training signals</strong>, not employment, income, or hiring guarantees.
        </li>
        <li>
          Marketplace gigs and campaign payouts depend on brand funding, quality gates, verification
          rules, and your eligibility (including payout onboarding where required).
        </li>
        <li>
          You are responsible for how you use practice content and for any real-world outreach you
          perform outside the product, including compliance with telemarketing, spam, and privacy
          laws that apply to you.
        </li>
      </ul>

      <h2 style={sectionTitle}>4. Acceptable use</h2>
      <p style={body}>You agree not to:</p>
      <ul style={list}>
        <li>Abuse scoring, create fake accounts, or manipulate leaderboards or quality gates</li>
        <li>Harass others, upload unlawful content, or use the Service for fraud or scams</li>
        <li>Interfere with the Service, scrape without permission, or reverse-engineer core systems beyond what the law allows</li>
        <li>Share API keys or credentials, or exceed fair-use / rate limits</li>
        <li>Import or process prospect data you are not authorized to use</li>
      </ul>
      <p style={body}>
        We may suspend or terminate access for violations, integrity failures, chargebacks abuse, or
        risk to the platform or other users.
      </p>

      <h2 style={sectionTitle}>5. Subscriptions, minutes & billing</h2>
      <ul style={list}>
        <li>Paid plans renew on the billing cycle shown at checkout until canceled.</li>
        <li>Practice minutes are granted per plan or trial and typically reset on successful invoice payment (or per seat rules for org plans).</li>
        <li>Brand lead plans, lead packs, and campaign escrow are separate from rep practice subscriptions where applicable.</li>
        <li>Fees are generally non-refundable except where required by law or where we expressly offer a refund.</li>
        <li>You can manage or cancel subscriptions through the billing portal linked from the app (Stripe).</li>
      </ul>

      <h2 style={sectionTitle}>6. Marketplace payouts</h2>
      <p style={body}>
        Brands fund campaign payouts. Approved results may be paid to eligible reps via Stripe
        Connect (or similar). ColdCallReps may retain a platform fee (approximately 20% on
        marketplace payouts, subject to published fee caps on the Pricing page, unless otherwise
        stated for a campaign). Payout timing, verification,
        clawbacks for invalid or fraudulent results, and Connect onboarding requirements are
        controlled by campaign rules and Stripe’s terms. We are not a bank or employer of reps by
        default.
      </p>

      <h2 style={sectionTitle}>7. Referrals & promotions</h2>
      <p style={body}>
        Referral bonuses and promotions are subject to fair-use limits, eligibility rules, and
        anti-abuse checks. We may modify or end promotions at any time.
      </p>

      <h2 style={sectionTitle}>8. Profiles, hiring & public content</h2>
      <p style={body}>
        Open-to-work resume profiles, public handles, highlight clips, and leaderboard displays are
        opt-in or earned in-app as described in the product. You grant us a license to host and
        display content you publish for the purpose of operating the Service. You may remove
        opt-in profile content at any time, subject to residual caching or legal retention.
      </p>

      <h2 style={sectionTitle}>9. Voice, AI & third parties</h2>
      <p style={body}>
        Practice calls stream audio to our realtime voice / AI providers for the session. Outputs
        (transcripts, coach notes, scores) may be imperfect. Third-party services (e.g. Clerk,
        Stripe, email, hosting, voice/LLM) have their own terms; your use of those features is also
        subject to them.
      </p>

      <h2 style={sectionTitle}>10. Intellectual property</h2>
      <p style={body}>
        The Service, branding, playbooks we provide, and software are owned by ColdCallReps or our
        licensors. You retain rights to your own content; you grant us rights needed to run the
        Service. Feedback you send may be used without obligation to you.
      </p>

      <h2 style={sectionTitle}>11. Disclaimers</h2>
      <p style={body}>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW,
        WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. We do not guarantee uninterrupted availability, specific scores, hiring
        outcomes, or payout amounts.
      </p>

      <h2 style={sectionTitle}>12. Limitation of liability</h2>
      <p style={body}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, COLDCALLREPS AND ITS AFFILIATES WILL NOT BE LIABLE
        FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS,
        REVENUE, OR DATA. OUR AGGREGATE LIABILITY FOR CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED
        THE GREATER OF (A) AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE
        CLAIM OR (B) ONE HUNDRED U.S. DOLLARS ($100).
      </p>

      <h2 style={sectionTitle}>13. Indemnity</h2>
      <p style={body}>
        You will defend and indemnify ColdCallReps against claims arising from your misuse of the
        Service, your content or prospect data, your outreach practices, or your breach of these
        Terms.
      </p>

      <h2 style={sectionTitle}>14. Changes & termination</h2>
      <p style={body}>
        We may update these Terms by posting a revised version with an updated date. Material
        changes may also be communicated in-app or by email. Continued use after the effective date
        constitutes acceptance. You may stop using the Service at any time. We may suspend or end
        access as described above.
      </p>

      <h2 style={sectionTitle}>15. Governing law</h2>
      <p style={body}>
        These Terms are governed by the laws of the United States and the State of Delaware,
        excluding conflict-of-law rules, unless mandatory local law says otherwise. Courts in that
        jurisdiction will have exclusive venue, except where prohibited.
      </p>

      <h2 style={sectionTitle}>16. Contact</h2>
      <p style={body}>
        Questions about these Terms:{' '}
        <a href="mailto:support@coldcallreps.com" style={{ color: 'var(--accent)' }}>
          support@coldcallreps.com
        </a>
        . See also our{' '}
        <Link href="/privacy" style={{ color: 'var(--accent)' }}>
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
