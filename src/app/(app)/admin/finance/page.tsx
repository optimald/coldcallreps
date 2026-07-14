'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';
import { adminGetJson, ADMIN_DEMO_MSG } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';

type Ledger = {
  summary: {
    pendingCount: number;
    pendingGrossLabel: string;
    heldCount: number;
    heldGrossLabel: string;
    disputedCount: number;
    disputedGrossLabel: string;
    paid30Count: number;
    paid30GrossLabel: string;
    paid30FeeLabel: string;
  };
  payouts: Array<{
    id: string;
    status: string;
    grossLabel: string;
    feeLabel: string;
    netLabel: string;
    holdReason: string | null;
    disputeReason: string | null;
    campaignTitle: string;
    brandId: string;
    rep: { id: string; email: string | null; name: string | null };
    brand: { id: string; email: string | null; name: string | null };
    createdAt: string;
  }>;
};

export default function AdminFinancePage() {
  const [data, setData] = useState<Ledger | null>(null);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const params = new URLSearchParams({ status });
    if (q.trim()) params.set('q', q.trim());
    const res = await adminGetJson<Ledger>(`/api/admin/finance?${params}`, isDemo);
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok || !res.data) return;
    setData(res.data);
  }

  useEffect(() => {
    if (!hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isDemo, hydrated]);

  async function act(action: string) {
    if (!selected) return;
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutId: selected, action, reason }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Updated.' : d.error || 'Failed');
    if (res.ok) {
      setReason('');
      load();
    }
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Finance" description="Finance ops access required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  const s = data?.summary;

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Finance ledger"
        description="Campaign payouts, holds, and disputes — link out to Stripe for deep transaction work."
      />
      {s ? (
        <StatGrid>
          <Stat label="Pending" value={`${s.pendingCount}`} tone="accent" />
          <Stat label="Pending $" value={s.pendingGrossLabel} />
          <Stat label="Held" value={`${s.heldCount}`} tone="warn" />
          <Stat label="Held $" value={s.heldGrossLabel} />
          <Stat label="Disputed" value={`${s.disputedCount}`} />
          <Stat label="Paid 30d fee" value={s.paid30FeeLabel} tone="good" />
        </StatGrid>
      ) : null}

      <Panel title="Filters">
        <div className="search-row">
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Rep, brand, campaign, payout id…"
          />
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto' }}
          >
            {['ALL', 'PENDING', 'HELD', 'DISPUTED', 'PAID', 'FAILED', 'CANCELED'].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </Panel>

      <div className="admin-split">
        <Panel title="Payouts" description="Select a row, then hold / dispute / release.">
          {!data?.payouts?.length ? (
            <EmptyState title="No payouts" description="Nothing matches this filter." />
          ) : (
            <div className="admin-review__list">
              {data.payouts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`admin-review__item${selected === p.id ? ' is-active' : ''}`}
                  onClick={() => setSelected(p.id)}
                >
                  <strong>
                    {p.status} · {p.netLabel}
                  </strong>
                  <span className="muted">
                    {p.campaignTitle} · {p.rep.name || p.rep.email} ←{' '}
                    {p.brand.name || p.brand.email}
                  </span>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(p.createdAt).toLocaleString()} · fee {p.feeLabel}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Dispute workspace" description="Reason is required and audit-logged.">
          {selected ? (
            <>
              {(() => {
                const p = data?.payouts.find((x) => x.id === selected);
                if (!p) return null;
                return (
                  <div className="stack">
                    <p style={{ marginTop: 0 }}>
                      <strong>{p.status}</strong> · {p.grossLabel} gross · {p.netLabel} to SDR
                    </p>
                    <p className="muted">
                      Campaign: {p.campaignTitle}
                      <br />
                      SDR:{' '}
                      <Link href={`/admin/users/${p.rep.id}`}>
                        {p.rep.name || p.rep.email}
                      </Link>
                      <br />
                      Brand:{' '}
                      <Link href={`/admin/users/${p.brand.id}`}>
                        {p.brand.name || p.brand.email}
                      </Link>
                    </p>
                    {p.holdReason ? <p>Hold: {p.holdReason}</p> : null}
                    {p.disputeReason ? <p>Dispute: {p.disputeReason}</p> : null}
                    <textarea
                      className="field"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for hold / dispute / cancel"
                    />
                    <div className="admin-review__actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => act('hold')}
                      >
                        Hold
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => act('dispute')}
                      >
                        Dispute
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => act('release_hold')}
                      >
                        Release to pending
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => act('cancel')}
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: '0.8rem' }}>
                      Deep Stripe work:{' '}
                      <a
                        href="https://dashboard.stripe.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Stripe Dashboard ↗
                      </a>
                    </p>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="muted">Select a payout to act on it.</p>
          )}
        </Panel>
      </div>

      {msg ? (
        <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
