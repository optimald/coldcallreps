'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import VerifiedGoalsClient, {
  type VerifiedGoalRow,
} from '@/components/VerifiedGoalsClient';
import { brandPathKey, type BrandRef } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { getDemoVerifiedGoals } from '@/lib/demo/brand-demo-data';
import { PageHeader } from '@/components/ui/PagePrimitives';

export default function BrandVerifiedGoalsClient({
  brand,
}: {
  brand: BrandRef;
}) {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const brandKey = brandPathKey(brand);
  const [goals, setGoals] = useState<VerifiedGoalRow[]>(() =>
    getDemoVerifiedGoals(brandKey, brand.name)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (isDemo) {
        if (!cancelled) {
          setGoals(getDemoVerifiedGoals(brandKey, brand.name));
          setLoading(false);
        }
        return;
      }
      try {
        const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/goals`);
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setGoals((data?.goals || []) as VerifiedGoalRow[]);
      } catch {
        if (!cancelled) setGoals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isDemo, brandKey, brand.name]);

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="Verified goals"
        description="Booked meetings, qualified leads, and appointment claims — outcomes eligible for SDR payout."
        actions={
          <Link href="/sdrs/payouts" className="btn-ghost">
            Payouts →
          </Link>
        }
      />
      {loading ? (
        <p className="muted">Loading goals…</p>
      ) : (
        <Suspense fallback={<p className="muted">Loading goals…</p>}>
          <VerifiedGoalsClient initial={goals} mode="brand" brandKey={brandKey} />
        </Suspense>
      )}
    </main>
  );
}
