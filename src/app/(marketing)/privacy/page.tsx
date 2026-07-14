import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for ColdCallReps — how we collect, use, and share data for AI practice and marketplace features.',
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

export default function PrivacyPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.5rem' }}>
        Privacy Policy
      </h1>
      <p style={{ ...body, fontSize: '0.95rem' }}>Last updated: July 13, 2026</p>

      <p style={body}>
        ColdCallReps (“we”, “us”, “our”) operates coldcallreps.com and related apps (the “Service”).
        This Privacy Policy explains what we collect, how we use it, and the choices you have.
      </p>

      <h2 style={sectionTitle}>1. Information we collect</h2>
      <p style={body}>We process:</p>
      <ul style={list}>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Account data</strong> — email, display name, and
          authentication identifiers via Clerk (and similar profile fields you set).
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Practice & training data</strong> — session
          transcripts, scorecards, coach logs, points, badges, streaks, integrity signals, and
          related metadata.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Voice</strong> — live audio streamed during a
          practice call to our realtime voice provider for the duration of the session. We store the
          text transcript and scorecard. If you save a highlight, a short audio clip may be stored
          (e.g. in object storage) and shown on a public highlight or profile page you choose to
          publish.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Hiring & profile content</strong> — optional
          headline, bio, open-to-work fields, public handle, and other content you publish.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Prospect & CRM data</strong> — leads and enrichment
          you import or generate in-product (e.g. maps/website hooks) for personalization and
          campaigns. You are responsible for having a lawful basis to process that data.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Marketplace & brand data</strong> — campaign
          settings, applications, claims, payouts, and brand workspace content needed to run deals.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Billing</strong> — payment and payout metadata via
          Stripe (we do not store full card numbers). Stripe Connect onboarding data is processed by
          Stripe for eligible reps.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Communications</strong> — email for digests, Direct
          Connect, support, and product notices when you provide an address or opt in.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Usage & device</strong> — approximate analytics
          (e.g. Google Analytics), logs, and cookies or similar technologies needed for auth,
          preferences (such as theme), and security.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>API usage</strong> — if you create API keys, we log
          key metadata and request activity as needed to operate and secure the API.
        </li>
      </ul>

      <h2 style={sectionTitle}>2. How we use information</h2>
      <ul style={list}>
        <li>Provide, secure, and improve the Service (practice, scoring, campaigns, payouts)</li>
        <li>Operate leaderboards, quality gates, integrity checks, and anti-abuse systems</li>
        <li>Process subscriptions, lead packs, escrow, and marketplace payouts</li>
        <li>Send transactional email and optional digests or hiring-related messages you enable</li>
        <li>Show public profiles, highlights, and leaderboard entries you opt into or earn</li>
        <li>Comply with law, enforce our Terms, and respond to support requests</li>
      </ul>

      <h2 style={sectionTitle}>3. Sharing</h2>
      <p style={body}>
        We do <strong style={{ color: 'var(--ink)' }}>not sell</strong> personal data. We share
        information with:
      </p>
      <ul style={list}>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Service providers</strong> needed to run the
          product — including Clerk (auth), Stripe (payments / Connect), Resend (email), our
          database host (e.g. Turso), Cloudflare (edge / realtime / storage), voice and LLM
          providers (e.g. xAI for practice sessions), and analytics (Google Analytics).
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Other users</strong> — only what you publish or
          what the product surfaces by design (e.g. public profile, hiring board, leaderboard,
          brand–rep campaign interactions).
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Legal & safety</strong> — when required by law or
          to protect rights, users, or the Service.
        </li>
        <li>
          <strong style={{ color: 'var(--ink)' }}>Business transfers</strong> — in connection with a
          merger, acquisition, or asset sale, subject to appropriate safeguards.
        </li>
      </ul>

      <h2 style={sectionTitle}>4. Cookies & analytics</h2>
      <p style={body}>
        We use essential cookies for authentication and preferences. We may use Google Analytics (or
        similar) to understand product usage. You can control cookies through your browser settings;
        disabling essential cookies may break sign-in or core features.
      </p>

      <h2 style={sectionTitle}>5. Retention</h2>
      <p style={body}>
        We retain account, session, campaign, and billing records as needed to operate the Service,
        resolve disputes, and meet legal, tax, and accounting obligations. Highlight audio and
        published profile content remain until you delete them or close your account, subject to
        backups and legal holds.
      </p>

      <h2 style={sectionTitle}>6. Your choices & rights</h2>
      <ul style={list}>
        <li>Update profile and privacy-related settings in the app where available.</li>
        <li>Opt out of non-essential marketing or digest email via unsubscribe links or settings.</li>
        <li>Request access, correction, or deletion of your account data by contacting us.</li>
        <li>
          Depending on your location (e.g. EEA/UK/California), you may have additional rights such
          as access, deletion, portability, or objection. We will respond as required by applicable
          law.
        </li>
      </ul>
      <p style={body}>
        To request deletion or an export of your account data, email{' '}
        <a href="mailto:support@coldcallreps.com" style={{ color: 'var(--accent)' }}>
          support@coldcallreps.com
        </a>
        . We may need to verify your identity and retain certain records as required by law or for
        legitimate business purposes (e.g. completed transactions).
      </p>

      <h2 style={sectionTitle}>7. Children</h2>
      <p style={body}>
        The Service is not directed to children under 16 (or the minimum age required in your
        jurisdiction). We do not knowingly collect personal information from children.
      </p>

      <h2 style={sectionTitle}>8. International transfers</h2>
      <p style={body}>
        We and our providers may process data in the United States and other countries. Where
        required, we rely on appropriate transfer mechanisms and contractual protections.
      </p>

      <h2 style={sectionTitle}>9. Security</h2>
      <p style={body}>
        We use reasonable technical and organizational measures to protect data. No method of
        transmission or storage is 100% secure; please use a strong password and protect your
        account.
      </p>

      <h2 style={sectionTitle}>10. Changes</h2>
      <p style={body}>
        We may update this policy by posting a revised version with a new “Last updated” date.
        Material changes may also be communicated in-app or by email.
      </p>

      <h2 style={sectionTitle}>11. Contact</h2>
      <p style={body}>
        Privacy questions:{' '}
        <a href="mailto:support@coldcallreps.com" style={{ color: 'var(--accent)' }}>
          support@coldcallreps.com
        </a>
        . Related:{' '}
        <Link href="/terms" style={{ color: 'var(--accent)' }}>
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
