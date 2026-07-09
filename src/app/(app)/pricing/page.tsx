import Link from 'next/link';
import { PLAN } from '@/lib/product';

export default function AppPricingPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Upgrade your minutes</h1>
      <p style={{ color: 'var(--muted)' }}>Starter ${PLAN.STARTER.price} · Pro ${PLAN.PRO.price}. Manage billing in Settings.</p>
      <Link href="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>
        Go to Settings →
      </Link>
    </main>
  );
}
