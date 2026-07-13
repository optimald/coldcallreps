'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import VerifiedGoalsClient, {
  type VerifiedGoalRow,
} from '@/components/VerifiedGoalsClient';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { getDemoRepVerifiedGoals } from '@/lib/demo/brand-demo-data';
import { PageHeader } from '@/components/ui/PagePrimitives';

function GoalsBody() {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [goals, setGoals] = useState<VerifiedGoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (isDemo) {
        if (!cancelled) {
          setGoals(getDemoRepVerifiedGoals());
          setLoading(false);
        }
        return;
      }
      try {
        const res = await fetch('/api/goals');
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
  }, [hydrated, isDemo]);

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="Verified goals"
        description="Your booked meetings, qualified leads, and audited claims — outcomes that unlock payout."
        actions={
          <Link href="/earnings" className="btn-ghost">
            Earnings →
          </Link>
        }
      />
      {loading ? (
        <p className="muted">Loading goals…</p>
      ) : (
        <VerifiedGoalsClient initial={goals} mode="sdr" />
      )}
    </main>
  );
}

export default function SdrVerifiedGoalsPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <GoalsBody />
    </Suspense>
  );
}
