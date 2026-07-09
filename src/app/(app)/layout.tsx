import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trainer', label: 'Trainer' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/hiring', label: 'Hiring Board' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/settings', label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-elevated)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Cold<span style={{ color: 'var(--accent)' }}>Call</span>Reps
          </Link>
          <nav style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} style={{ color: 'var(--muted)' }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <UserButton />
      </header>
      <div style={{ flex: 1, padding: '1.25rem' }}>{children}</div>
    </div>
  );
}
