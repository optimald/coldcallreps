import { Suspense } from 'react';
import BillingPageClient from '@/components/BillingPageClient';

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page">
          <p className="muted">Loading billing…</p>
        </main>
      }
    >
      <BillingPageClient />
    </Suspense>
  );
}
