export default function TermsPage() {
  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Terms of Service</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        ColdCallReps provides AI-assisted cold-call practice. Scores, badges, and leaderboards are
        training signals — not employment guarantees. You are responsible for how you use practice
        content and any outreach you perform outside the product.
      </p>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        Subscriptions renew monthly until canceled. Practice minutes reset on successful invoice
        payment. Referral bonuses are subject to fair-use limits. Open-to-work resume profiles are opt-in
        and may be removed at any time.
      </p>
      <p style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
        Do not attempt to abuse scoring, create fake accounts for leaderboard manipulation, or use
        the service for unlawful activity. Contact: reps@coldcallreps.com.
      </p>
    </main>
  );
}
