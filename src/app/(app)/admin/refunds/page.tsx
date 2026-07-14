'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  useAdminFetch,
} from '@/components/AdminPageKit';
import {
  EmptyState,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

type Dispute = {
  id: string;
  stripeDisputeId: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  amountLabel: string;
  reason: string | null;
  status: string;
  isOpen: boolean;
  evidenceDueBy: string | null;
  evidenceDueLabel: string | null;
  evidenceOverdue: boolean;
  evidenceDueSoon: boolean;
  createdAt: string;
  updatedAt: string;
  stripeUrl: string;
};

type Data = {
  kpis: {
    openCount: number;
    openLabel: string;
    totalSynced: number;
    needsResponse: number;
  };
  filter: string;
  disputes: Dispute[];
};

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const { data, forbidden, reload, error, isDemo, demoMsg } = useAdminFetch<Data>(
    `/api/admin/refunds?filter=${filter}`
  );
  const [kind, setKind] = useState('minutes');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const disputes = data?.disputes || [];
  const selected = useMemo(
    () => disputes.find((d) => d.id === selectedId) || null,
    [disputes, selectedId]
  );

  useEffect(() => {
    if (!selectedId && disputes[0]) setSelectedId(disputes[0].id);
    if (selectedId && !disputes.some((d) => d.id === selectedId)) {
      setSelectedId(disputes[0]?.id || null);
    }
  }, [disputes, selectedId]);

  async function submitRefund() {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    const body: Record<string, unknown> = { kind, reason };
    if (kind === 'stripe_payment') {
      body.paymentIntentId = paymentIntentId;
      if (amount) body.amountCents = Math.round(Number(amount) * 100);
    } else if (kind === 'escrow_wallet') {
      body.brandId = brandId;
      body.amountCents = Math.round(Number(amount) * 100);
    } else {
      body.userId = userId;
      body.minutes = Number(amount);
    }
    const res = await fetch('/api/admin/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'Refund recorded.' : d.error || 'Failed');
    if (res.ok) reload();
  }

  async function disputeAct(action: 'sync' | 'accept' | 'sync_open') {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    if (action !== 'sync_open' && !selectedId) return;
    if (action === 'accept' && note.trim().length < 3) {
      setMsg('Add a short note before accepting the chargeback.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/refunds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        disputeId: selectedId,
        note,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || 'Action failed');
      return;
    }
    setMsg(
      action === 'accept'
        ? 'Dispute accepted (closed) in Stripe.'
        : action === 'sync_open'
          ? `Synced ${d.upserted ?? 0} disputes from Stripe.`
          : 'Dispute status refreshed from Stripe.'
    );
    if (action === 'accept') setNote('');
    reload();
  }

  function usePiForRefund() {
    if (!selected?.paymentIntentId) return;
    setKind('stripe_payment');
    setPaymentIntentId(selected.paymentIntentId);
    setAmount((selected.amountCents / 100).toFixed(2));
    setReason(`Goodwill / related to ${selected.stripeDisputeId}`);
    setMsg('Payment intent loaded into Issue refund form.');
  }

  const k = data?.kpis;

  return (
    <AdminGate title="Refunds" forbidden={forbidden}>
      <AdminPageChrome
        title="Refunds & disputes"
        description="Issue goodwill refunds here. Chargebacks: triage locally, sync status, accept when appropriate — evidence upload stays in Stripe."
      >
        {k ? (
          <StatGrid>
            <Stat label="Open disputes" value={k.openCount} tone="warn" />
            <Stat label="Open exposure" value={k.openLabel} tone="accent" />
            <Stat label="Needs response" value={k.needsResponse} tone="bad" />
            <Stat label="Synced total" value={k.totalSynced} />
          </StatGrid>
        ) : null}

        <div className="admin-split">
          <Panel
            title="Chargeback inbox"
            description="Select a dispute, then sync / accept / open in Stripe."
            actions={
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => disputeAct('sync_open')}
              >
                Sync from Stripe
              </button>
            }
          >
            <div className="search-row" style={{ marginBottom: '0.65rem' }}>
              {(['open', 'closed', 'all'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn-ghost${filter === f ? ' is-active' : ''}`}
                  onClick={() => setFilter(f)}
                  style={
                    filter === f
                      ? { borderColor: 'var(--accent)', color: 'var(--ink)' }
                      : undefined
                  }
                >
                  {f === 'open' ? 'Open' : f === 'closed' ? 'Closed' : 'All'}
                </button>
              ))}
            </div>

            {disputes.length === 0 ? (
              <EmptyState
                title="Inbox clear"
                description={
                  filter === 'open'
                    ? 'No open chargebacks. Sync from Stripe if you expect one.'
                    : 'Nothing in this filter.'
                }
              />
            ) : (
              <ul className="admin-review__list">
                {disputes.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`admin-review__item${
                        selectedId === d.id ? ' is-active' : ''
                      }`}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <strong>{d.amountLabel}</strong>
                      {' · '}
                      <span
                        className={
                          d.evidenceOverdue
                            ? 'admin-risk admin-risk--high'
                            : d.evidenceDueSoon
                              ? 'admin-risk admin-risk--mid'
                              : undefined
                        }
                      >
                        {d.status}
                      </span>
                      <span className="muted">
                        {' '}
                        · {d.reason || 'no reason'} · {d.stripeDisputeId}
                        {d.evidenceDueLabel
                          ? ` · due ${d.evidenceDueLabel}`
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            compact
            title="Dispute detail"
            description="Accept closes the dispute in Stripe (you lose). Evidence & challenge live in Stripe Dashboard."
          >
            {!selected ? (
              <EmptyState
                title="Select a dispute"
                description="Pick a row from the chargeback inbox."
              />
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  <strong>{selected.amountLabel}</strong>
                  {' · '}
                  <code>{selected.stripeDisputeId}</code>
                </p>
                <ul className="list-quiet" style={{ marginBottom: '0.85rem' }}>
                  <li>
                    Status:{' '}
                    <strong
                      className={
                        selected.evidenceOverdue
                          ? 'admin-risk admin-risk--high'
                          : selected.isOpen
                            ? 'admin-risk admin-risk--mid'
                            : undefined
                      }
                    >
                      {selected.status}
                    </strong>
                  </li>
                  <li>Reason: {selected.reason || '—'}</li>
                  <li>
                    Evidence due:{' '}
                    {selected.evidenceDueLabel
                      ? `${selected.evidenceDueLabel}${
                          selected.evidenceOverdue ? ' (overdue)' : ''
                        }`
                      : '—'}
                  </li>
                  <li>
                    Charge:{' '}
                    {selected.chargeId ? (
                      <code>{selected.chargeId}</code>
                    ) : (
                      '—'
                    )}
                  </li>
                  <li>
                    Payment intent:{' '}
                    {selected.paymentIntentId ? (
                      <code>{selected.paymentIntentId}</code>
                    ) : (
                      '—'
                    )}
                  </li>
                  <li>
                    First seen:{' '}
                    {new Date(selected.createdAt).toLocaleString()}
                  </li>
                  <li>
                    Updated:{' '}
                    {new Date(selected.updatedAt).toLocaleString()}
                  </li>
                </ul>

                <div className="admin-review__actions">
                  <a
                    className="btn"
                    href={selected.stripeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Stripe ↗
                  </a>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => disputeAct('sync')}
                  >
                    Refresh status
                  </button>
                  {selected.paymentIntentId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={usePiForRefund}
                    >
                      Use PI in refund form
                    </button>
                  ) : null}
                </div>

                {selected.isOpen ? (
                  <div style={{ marginTop: '1rem' }}>
                    <label className="muted" style={{ fontSize: '0.8rem' }}>
                      Accept chargeback (lose funds)
                    </label>
                    <div className="search-row" style={{ marginTop: '0.35rem' }}>
                      <input
                        className="field"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Why accepting (required)"
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => disputeAct('accept')}
                        style={{ color: 'var(--bad)' }}
                      >
                        Accept dispute
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: '0.85rem' }}>
                    This dispute is closed — no accept action available.
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>

        <Panel title="Issue refund">
          <select
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ width: 'auto', marginBottom: '0.5rem' }}
          >
            <option value="minutes">SDR minutes</option>
            <option value="escrow_wallet">Brand escrow wallet</option>
            <option value="stripe_payment">Stripe payment intent</option>
          </select>
          <div className="search-row">
            {kind === 'stripe_payment' ? (
              <input
                className="field"
                value={paymentIntentId}
                onChange={(e) => setPaymentIntentId(e.target.value)}
                placeholder="pi_…"
              />
            ) : null}
            {kind === 'escrow_wallet' ? (
              <input
                className="field"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                placeholder="Brand ID"
              />
            ) : null}
            {kind === 'minutes' ? (
              <input
                className="field"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID"
              />
            ) : null}
            <input
              className="field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={kind === 'minutes' ? 'Minutes' : 'Amount USD'}
              style={{ maxWidth: 120 }}
            />
            <input
              className="field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
            />
            <button type="button" className="btn" onClick={submitRefund}>
              Submit
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
            Deep chargeback evidence stays in{' '}
            <a
              href="https://dashboard.stripe.com/disputes"
              target="_blank"
              rel="noreferrer"
              className="soft-link"
            >
              Stripe Dashboard ↗
            </a>
            .
          </p>
        </Panel>

        {msg || error ? (
          <p
            className={
              msg.includes('recorded') ||
              msg.includes('accepted') ||
              msg.includes('Synced') ||
              msg.includes('refreshed') ||
              msg.includes('loaded')
                ? 'msg-ok'
                : 'msg-err'
            }
          >
            {msg || error}
          </p>
        ) : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
