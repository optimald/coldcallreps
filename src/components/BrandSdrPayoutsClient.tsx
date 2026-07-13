'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { brandHref } from '@/lib/brand-context';
import { formatPayout } from '@/lib/campaigns';
import { DEMO_MSG, getDemoKpis, getDemoPayouts } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import { DeskToolbar, DeskToolbarSelect } from '@/components/ui/DeskChrome';

type PayoutRow = {
  id: string;
  status: string;
  grossCents: number;
  campaignId: string;
  campaignTitle: string;
  sdrName: string;
  sdrId?: string | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState(() => searchParams.get('rep') || '');

  useEffect(() => {
    setRows(initial);
  }, [initial, brandKey]);

  useEffect(() => {
    setRepFilter(searchParams.get('rep') || '');
  }, [searchParams]);

  const displayEscrow = isDemo ? getDemoKpis(brandKey).escrowLabel : escrowLabel;
  const allRows = rows.length > 0 || !isDemo ? rows : getDemoPayouts(brandKey);

  const reps = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allRows) {
      if (p.sdrId) map.set(p.sdrId, p.sdrName);
    }
    if (repFilter && !map.has(repFilter)) {
      map.set(repFilter, 'Selected SDR');
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows, repFilter]);

  const displayRows = useMemo(() => {
    if (!repFilter) return allRows;
    return allRows.filter((p) => p.sdrId === repFilter);
  }, [allRows, repFilter]);

  function setRepFilterAndUrl(next: string) {
    setRepFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('rep', next);
    else params.delete('rep');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

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
        compact
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

      <Panel
        compact
        title="Recent payouts"
        description={`${displayRows.length}${displayRows.length !== allRows.length ? ` of ${allRows.length}` : ''} records`}
      >
        {allRows.length > 0 ? (
          <DeskToolbar>
            <DeskToolbarSelect
              value={repFilter}
              onChange={setRepFilterAndUrl}
              label="SDR"
            >
              <option value="">All SDRs</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </DeskToolbarSelect>
          </DeskToolbar>
        ) : null}
        {displayRows.length === 0 ? (
          <EmptyState
            title={repFilter ? 'No payouts for this SDR' : 'No payouts yet'}
            description={
              repFilter
                ? 'Try another rep, or clear the filter.'
                : 'When you approve and pay an SDR on a campaign, it will appear here.'
            }
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
