import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.5rem',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 0,
          backdropFilter: 'blur(12px)',
          background: 'rgba(12,18,34,0.85)',
          zIndex: 20,
        }}
      >
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
          Cold<span style={{ color: 'var(--accent)' }}>Call</span>Reps
        </Link>
        <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.95rem' }}>
          <Link href="/pricing" style={{ color: 'var(--muted)' }}>
            Pricing
          </Link>
          <SignedOut>
            <Link href="/sign-in" style={{ color: 'var(--muted)' }}>
              Sign in
            </Link>
            <Link
              href="/sign-up"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '0.55rem 1rem',
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Start reps
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" style={{ color: 'var(--muted)' }}>
              Dashboard
            </Link>
            <UserButton />
          </SignedIn>
        </nav>
      </header>
      {children}
    </div>
  );
}
