'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { formatPayout } from '@/lib/campaigns';
import { DEMO_MSG, getDemoKpis, getDemoPayouts } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';

type PayoutRow = {
  id: string;
  status: string;
  grossCents: number;
  campaignId: string;
  campaignTitle: string;
  sdrName: string;
  createdAt: string;
};

export default function BrandSdrPayoutsClient({
  brandKey,
  brandId,
  initial,
  escrowLabel,
}: {
  brandKey: string;
  brandId: string;
  initial: PayoutRow[];
  escrowLabel: string;
}) {
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(isDemo ? getDemoPayouts(brandKey) : initial);
  }, [isDemo, initial, brandKey]);

  const displayEscrow = isDemo ? getDemoKpis(brandKey).escrowLabel : escrowLabel;
  const displayRows = isDemo ? getDemoPayouts(brandKey) : rows;

  async function fundEscrow() {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: 50000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start checkout');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <Panel
        title="Escrow wallet"
        description={`Prepaid balance for verified appointments. Current: ${displayEscrow}.`}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void fundEscrow()}>
            {busy ? 'Starting…' : 'Fund $500'}
          </button>
          <Link href={brandHref(brandKey, 'campaigns')} className="btn-ghost">
            Campaigns →
          </Link>
        </div>
        {msg ? <p className={isDemo ? 'muted' : 'msg-err'}>{msg}</p> : null}
      </Panel>

      <Panel title="Recent payouts" description={`${displayRows.length} records`}>
        {displayRows.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="When you approve and pay an SDR on a campaign, it will appear here."
          />
        ) : (
          <ul className="brand-list">
            {displayRows.map((p) => (
              <li key={p.id}>
                <span>
                  {p.sdrName} · {p.campaignTitle} · {formatPayout(p.grossCents)} · {p.status}
                </span>
                <Link href={brandHref(brandKey, 'campaigns', p.campaignId)} className="soft-link">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
