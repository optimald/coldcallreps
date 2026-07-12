export default function PrivacyPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        ColdCallReps (“we”, “us”) operates coldcallreps.com. This policy explains what we collect and
        how we use it.
      </p>
      <h2 style={{ fontSize: '1.15rem' }}>Data we process</h2>
      <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        <li>Account data: email, display name (via Clerk)</li>
        <li>Practice data: session transcripts, scorecards, coach logs, points, badges, streaks</li>
        <li>Optional hiring-board fields you choose to publish</li>
        <li>Prospect data you import (Maps results, website hooks) for personalization</li>
        <li>Billing metadata via Stripe (we do not store full card numbers)</li>
        <li>Email you provide for digests or Direct Connect</li>
      </ul>
      <h2 style={{ fontSize: '1.15rem' }}>Voice</h2>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        During a practice call, audio is streamed to our realtime voice provider for the duration of
        the session. We store the text transcript and scorecard. If you save a highlight, a short
        audio clip may be stored in Cloudflare R2 and shown on your public highlight page.
      </p>
      <h2 style={{ fontSize: '1.15rem' }}>Sharing</h2>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        We do not sell personal data. We use subprocessors necessary to run the product (Clerk for
        auth, Stripe for payments, Resend for email, our database host, and the voice/LLM provider).
        Public profiles, hiring board, and leaderboards only show what you opt into or earn in-app.
      </p>
      <h2 style={{ fontSize: '1.15rem' }}>Retention & contact</h2>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        You may request deletion of your account data by emailing reps@coldcallreps.com. We retain
        session and billing records as needed to operate the service and meet legal obligations.
      </p>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>Last updated: July 9, 2026</p>
    </main>
  );
}
