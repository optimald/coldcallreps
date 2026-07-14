'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

type ConnectState = {
  hasAccount?: boolean;
  ready?: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  statusLabel?: string;
};

type PayoutRow = {
  id: string;
  status: string;
  netLabel: string;
  grossLabel: string;
  feeLabel: string;
  paidAt?: string | null;
  createdAt?: string;
  failureReason?: string | null;
  campaign: {
    id: string;
    title: string;
    brandName: string;
  };
};

type Summary = {
  availableCents: number | null;
  availableLabel: string | null;
  pendingCents: number;
  pendingLabel: string;
  lifetimePaidCents: number;
  lifetimePaidLabel: string;
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'PENDING':
      return 'Pending';
    case 'FAILED':
      return 'Failed';
    case 'CANCELED':
      return 'Canceled';
    default:
      return status;
  }
}

export default function EarningsPage() {
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/earnings');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Could not load earnings.');
        return;
      }
      setConnect(data.connect || null);
      setSummary(data.summary || null);
      setPayouts(data.payouts || []);
    } catch (e: any) {
      setLoadError(e.message || 'Could not load earnings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'return') {
      setMsg('Stripe Connect returned — refreshing payout status…');
      fetch('/api/billing/connect')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.connect) {
            setConnect(d.connect);
            setMsg(
              d.connect.ready
                ? 'Payouts connected — brands can pay you for completed brand deals.'
                : 'Connect onboarding saved. Finish any remaining Stripe steps if status is still incomplete.'
            );
          }
          return load();
        })
        .catch(() => {});
    } else if (params.get('connect') === 'refresh') {
      setMsg('Connect link expired — start onboarding again below.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  async function startConnect(action: 'onboard' | 'dashboard' = 'onboard') {
    setConnectBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/billing/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          returnPath: '/earnings?connect=return',
          refreshPath: '/earnings?connect=refresh',
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || 'Could not open Stripe Connect');
    } catch (e: any) {
      setMsg(e.message || 'Could not open Stripe Connect');
    } finally {
      setConnectBusy(false);
    }
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Earn"
        title="Earnings"
        description="Brand deal payouts from campaigns. Connect payouts once, then track pending and paid results here."
        actions={
          <Link href="/gigs" className="btn-ghost">
            Browse brand deals →
          </Link>
        }
      />

      {loadError && <p className="msg-err">{loadError}</p>}
      {msg && <p className="msg-ok">{msg}</p>}

      {loading ? (
        <p className="muted">Loading earnings…</p>
      ) : (
        <>
          <StatGrid>
            <Stat
              label="Available in Stripe"
              value={summary?.availableLabel ?? (connect?.ready ? '—' : 'Connect')}
              tone={connect?.ready ? 'accent' : 'warn'}
            />
            <Stat
              label="Pending"
              value={summary?.pendingLabel ?? '$0'}
              tone={summary && summary.pendingCents > 0 ? 'warn' : undefined}
            />
            <Stat
              label="Lifetime paid"
              value={summary?.lifetimePaidLabel ?? '$0'}
              tone={summary && summary.lifetimePaidCents > 0 ? 'good' : undefined}
            />
          </StatGrid>

          <Panel
            title="Stripe Connect"
            description="Brands pay approved outcomes and optional base via Connect (20% fee, capped). Your net lands in Stripe Express."
            actions={
              connect?.detailsSubmitted ? (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={connectBusy}
                  onClick={() => startConnect('dashboard')}
                >
                  Express dashboard
                </button>
              ) : undefined
            }
          >
            <p className="muted" style={{ marginTop: 0, fontSize: '0.95rem' }}>
              Status:{' '}
              <strong style={{ color: 'var(--ink)' }}>
                {connect?.statusLabel ||
                  (connect?.ready
                    ? 'Ready for payouts'
                    : connect?.detailsSubmitted
                      ? 'Under review'
                      : connect?.hasAccount
                        ? 'Onboarding incomplete'
                        : 'Not connected')}
              </strong>
            </p>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                disabled={connectBusy}
                onClick={() => startConnect('onboard')}
              >
                {connectBusy
                  ? 'Opening…'
                  : connect?.ready
                    ? 'Update payout details'
                    : 'Connect Stripe for payouts'}
              </button>
            </div>
          </Panel>

          <Panel
            title="Payout history"
            description="Each row is one campaign result payment. Amounts are your net after the platform fee."
          >
            {payouts.length === 0 ? (
              <EmptyState
                title="No payouts yet"
                description="Apply to brand deals, get activated, and deliver results. When a brand pays an approved application, it shows up here."
                action={
                  <Link href="/gigs" className="btn" style={{ marginTop: '1rem' }}>
                    Find a brand deal
                  </Link>
                }
              />
            ) : (
              <div className="stack">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="session-row"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>{p.campaign.title}</strong>
                      <div className="session-row__meta">
                        {p.campaign.brandName} · {p.netLabel} net
                        {p.grossLabel ? ` (${p.grossLabel} gross)` : ''}
                        {p.failureReason ? ` · ${p.failureReason}` : ''}
                      </div>
                      <div className="session-row__meta">
                        {p.status === 'PAID'
                          ? `Paid ${formatDate(p.paidAt)}`
                          : `Created ${formatDate(p.createdAt)}`}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.65rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color:
                            p.status === 'PAID'
                              ? 'var(--good, var(--accent-2))'
                              : p.status === 'PENDING'
                                ? 'var(--warn, var(--accent))'
                                : p.status === 'FAILED' || p.status === 'CANCELED'
                                  ? 'var(--bad, #c44)'
                                  : 'var(--muted)',
                        }}
                      >
                        {statusLabel(p.status)}
                      </span>
                      <Link href={`/campaigns/${p.campaign.id}`} className="btn-ghost">
                        Campaign
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </main>
  );
}
