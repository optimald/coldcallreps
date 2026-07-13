'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref, brandPathKey, type BrandRef } from '@/lib/brand-context';
import { EmptyState, Panel, Stat, StatGrid } from '@/components/ui/PagePrimitives';

type LedgerRow = {
  id: string;
  type: string;
  amountCents: number;
  balanceAfter: number;
  campaignId: string | null;
  campaignTitle: string | null;
  note: string | null;
  createdAt: string;
};

type EscrowCampaign = {
  id: string;
  title: string;
  status: string;
  escrowLockedCents: number;
  escrowLabel: string;
};

type WalletData = {
  brand: { id: string; slug: string; name: string };
  balanceCents: number;
  balanceLabel: string;
  escrowLockedCents: number;
  escrowLockedLabel: string;
  ledger: LedgerRow[];
  campaignsWithEscrow: EscrowCampaign[];
};

const FUND_PRESETS = [100, 250, 500, 1000, 2500];

const LEDGER_LABELS: Record<string, string> = {
  FUND: 'Wallet funded',
  ESCROW_LOCK: 'Locked to campaign',
  ESCROW_RELEASE: 'Released to payout',
  ESCROW_REFUND: 'Escrow refunded',
  ADJUSTMENT: 'Adjustment',
};

function money(cents: number) {
  const sign = cents < 0 ? '−' : cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function BrandBillingPanel() {
  const [brands, setBrands] = useState<BrandRef[]>([]);
  const [brandKey, setBrandKey] = useState('');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [customDollars, setCustomDollars] = useState('500');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadBrands = useCallback(async () => {
    const res = await fetch('/api/brands?mine=1');
    const data = await res.json().catch(() => ({}));
    const list: BrandRef[] = (data.brands || []).map((b: BrandRef) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
    }));
    setBrands(list);
    if (!brandKey && list[0]) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('brand');
      const hit = fromUrl
        ? list.find((b) => b.slug === fromUrl || b.id === fromUrl)
        : null;
      setBrandKey(hit ? brandPathKey(hit) : brandPathKey(list[0]));
    }
  }, [brandKey]);

  const loadWallet = useCallback(async (key: string) => {
    if (!key) {
      setWallet(null);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(key)}/wallet`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load wallet');
      setWallet(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Load failed');
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
    const params = new URLSearchParams(window.location.search);
    if (params.get('wallet') === 'funded') {
      setMsg('Wallet funded — balance updates after Stripe confirms payment.');
    } else if (params.get('wallet') === 'cancel') {
      setErr('Checkout canceled — no charge was made.');
    }
  }, [loadBrands]);

  useEffect(() => {
    if (brandKey) void loadWallet(brandKey);
  }, [brandKey, loadWallet]);

  async function fund(dollars: number) {
    if (!wallet?.brand.id) return;
    const amountCents = Math.round(dollars * 100);
    if (amountCents < 5000) {
      setErr('Minimum fund is $50');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${wallet.brand.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, returnTo: 'billing' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/billing' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal unavailable');
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setBusy(false);
    }
  }

  if (brands.length === 0 && !loading) {
    return (
      <Panel title="Campaign funding">
        <EmptyState
          title="Create a brand first"
          description="Escrow wallets are per brand. Create a brand, then fund campaigns from here."
          action={
            <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
              Brands →
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div className="billing-brand-bar">
        <label className="billing-brand-bar__field">
          <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 650 }}>
            Brand wallet
          </span>
          <select
            className="field"
            value={brandKey}
            onChange={(e) => setBrandKey(e.target.value)}
            aria-label="Brand for billing"
          >
            {brands.map((b) => (
              <option key={b.id} value={brandPathKey(b)}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="billing-brand-bar__actions">
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
            Payment methods &amp; invoices
          </button>
          {wallet ? (
            <Link href={brandHref(wallet.brand, 'campaigns')} className="btn-ghost">
              Campaigns →
            </Link>
          ) : null}
        </div>
      </div>

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}

      {loading && !wallet ? (
        <p className="muted">Loading wallet…</p>
      ) : wallet ? (
        <>
          <StatGrid>
            <Stat label="Available balance" value={wallet.balanceLabel} tone="accent" />
            <Stat label="Locked in campaigns" value={wallet.escrowLockedLabel} />
            <Stat
              label="Ledger entries"
              value={wallet.ledger.length}
            />
          </StatGrid>

          <Panel
            title="Fund campaigns"
            description="Top up the prepaid escrow wallet. Capital locks when you open a campaign and releases to SDRs on verified appointments (~20% platform fee)."
          >
            <div className="billing-fund-presets">
              {FUND_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void fund(d)}
                >
                  ${d.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="billing-fund-custom">
              <input
                className="field"
                type="number"
                min={50}
                max={5000}
                step={50}
                value={customDollars}
                onChange={(e) => setCustomDollars(e.target.value)}
                aria-label="Custom fund amount USD"
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void fund(Number(customDollars) || 0)}
              >
                {busy ? 'Opening Stripe…' : 'Fund custom amount'}
              </button>
            </div>
            <p className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.82rem' }}>
              Minimum $50 · max $5,000 per checkout · card saved via Stripe Customer Portal for
              invoices.
            </p>
          </Panel>

          {wallet.campaignsWithEscrow.length > 0 ? (
            <Panel title="Escrow by campaign" description="Currently locked against OPEN / active campaigns.">
              <ul className="brand-list">
                {wallet.campaignsWithEscrow.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.title}
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        {c.status}
                      </span>
                    </span>
                    <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <strong>{c.escrowLabel}</strong>
                      <Link
                        href={brandHref(wallet.brand, 'campaigns', c.id)}
                        className="soft-link"
                      >
                        Open
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Ledger"
            description="All wallet movements — funds, escrow locks, releases, and adjustments."
            actions={
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void loadWallet(brandKey)}
                disabled={loading}
              >
                Refresh
              </button>
            }
          >
            {wallet.ledger.length === 0 ? (
              <EmptyState
                title="No ledger entries yet"
                description="Fund the wallet to see your first credit. Opening a campaign locks capital here."
              />
            ) : (
              <div className="billing-ledger-wrap">
                <table className="billing-ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Type</th>
                      <th scope="col">Campaign</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.ledger.map((row) => (
                      <tr key={row.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {new Date(row.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <span className={`billing-ledger__type billing-ledger__type--${row.type.toLowerCase()}`}>
                            {LEDGER_LABELS[row.type] || row.type}
                          </span>
                          {row.note ? (
                            <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                              {row.note}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {row.campaignId ? (
                            <Link
                              href={brandHref(wallet.brand, 'campaigns', row.campaignId)}
                              className="soft-link"
                            >
                              {row.campaignTitle || 'Campaign'}
                            </Link>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td
                          style={{
                            fontWeight: 650,
                            color:
                              row.amountCents > 0
                                ? 'var(--good, var(--accent))'
                                : row.amountCents < 0
                                  ? 'var(--ink)'
                                  : undefined,
                          }}
                        >
                          {money(row.amountCents)}
                        </td>
                        <td className="muted">${(row.balanceAfter / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="How brand billing works">
            <ol className="billing-how" style={{ margin: 0, paddingLeft: '1.15rem' }}>
              <li>Fund the escrow wallet with a card (Stripe Checkout + invoice).</li>
              <li>Open a campaign — required capital locks from available balance.</li>
              <li>SDRs deliver verified appointments; escrow releases and SDRs get paid via Connect.</li>
              <li>Manage cards, receipts, and tax IDs anytime in the Stripe customer portal.</li>
            </ol>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link href={brandHref(wallet.brand, 'sdrs', 'payouts')} className="btn-ghost">
                Payout history →
              </Link>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
                Open Stripe portal
              </button>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
