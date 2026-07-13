'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref, brandPathKey, type BrandRef } from '@/lib/brand-context';
import { EmptyState, Panel, Stat, StatGrid } from '@/components/ui/PagePrimitives';
import { BRAND_LEAD_PLAN, LEAD_PACKS } from '@/lib/product';

type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  isBackup: boolean;
};

type BillingPayload = {
  brand: { id: string; slug: string; name: string };
  credits: {
    plan: string;
    allotmentRemaining: number;
    packRemaining: number;
    totalRemaining: number;
    usedThisPeriod: number;
    periodLimit: number;
    packExpiresAt: string | null;
    planPeriodEnd: string | null;
  };
  plan: { key: string; label: string; priceUsd: number; allotment: number };
  subscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    planKey: string;
  } | null;
  paymentMethods: PaymentMethod[];
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    currency: string;
    created: number;
    hostedInvoiceUrl: string | null;
    description: string | null;
  }>;
  wallet: {
    balanceCents: number;
    balanceLabel: string;
    ledger: Array<{
      id: string;
      type: string;
      amountCents: number;
      balanceAfter: number;
      campaignId: string | null;
      note: string | null;
      createdAt: string;
    }>;
  };
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    budgetLabel: string;
    escrowLabel: string;
    escrowLockedCents: number | null;
  }>;
  creditLedger: Array<{
    id: string;
    type: string;
    amount: number;
    allotmentAfter: number;
    packAfter: number;
    note: string | null;
    createdAt: string;
  }>;
};

const FUND_PRESETS = [100, 250, 500, 1000, 2500];

const LEDGER_LABELS: Record<string, string> = {
  FUND: 'Wallet funded',
  ESCROW_LOCK: 'Locked to campaign',
  ESCROW_RELEASE: 'Released to payout',
  ESCROW_REFUND: 'Escrow refunded',
  ADJUSTMENT: 'Adjustment',
  GRANT_ALLOTMENT: 'Allotment grant',
  GRANT_PACK: 'Pack purchase',
  DEDUCT_SAVE: 'Lead saved',
  EXPIRE_PACK: 'Pack expired',
};

function money(cents: number) {
  const sign = cents < 0 ? '−' : cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function BrandBillingPanel() {
  const [brands, setBrands] = useState<BrandRef[]>([]);
  const [brandKey, setBrandKey] = useState('');
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [customDollars, setCustomDollars] = useState('500');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadBrands = useCallback(async () => {
    const res = await fetch('/api/brands?mine=1');
    const json = await res.json().catch(() => ({}));
    const list: BrandRef[] = (json.brands || []).map((b: BrandRef) => ({
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

  const loadBilling = useCallback(async (key: string) => {
    if (!key) {
      setData(null);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(key)}/billing`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load billing');
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Load failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
    const params = new URLSearchParams(window.location.search);
    if (params.get('wallet') === 'funded') {
      setMsg('Wallet funded — balance updates after Stripe confirms payment.');
    } else if (params.get('lead_plan') === 'success') {
      setMsg('Brand Lead Plan activated — allotment refreshes after Stripe confirms.');
    } else if (params.get('lead_pack') === 'success') {
      setMsg('Lead pack purchased — credits appear after Stripe confirms.');
    } else if (params.get('wallet') === 'cancel' || params.get('lead_plan') === 'cancel') {
      setErr('Checkout canceled — no charge was made.');
    }
  }, [loadBrands]);

  useEffect(() => {
    if (brandKey) void loadBilling(brandKey);
  }, [brandKey, loadBilling]);

  async function fund(dollars: number) {
    if (!data?.brand.id) return;
    const amountCents = Math.round(dollars * 100);
    if (amountCents < 5000) {
      setErr('Minimum fund is $50');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${data.brand.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, returnTo: 'billing' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setBusy(false);
    }
  }

  async function subscribeLead(interval: 'month' | 'year') {
    if (!data?.brand.id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/billing/lead-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: data.brand.id, interval }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Subscribe failed');
    } finally {
      setBusy(false);
    }
  }

  async function buyPack(pack: string) {
    if (!data?.brand.id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/billing/lead-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: data.brand.id, pack }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Pack checkout failed');
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Portal unavailable');
      if (json.url) window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(pmId: string) {
    if (!data?.brand.id) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/brands/${data.brand.id}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultPaymentMethodId: pmId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not update payment method');
      setMsg('Primary payment method updated.');
      await loadBilling(brandKey);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (brands.length === 0 && !loading) {
    return (
      <Panel title="Brand billing">
        <EmptyState
          title="Create a brand first"
          description="Lead plans, escrow wallets, and campaign budgets are per brand."
          action={
            <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
              Brands →
            </Link>
          }
        />
      </Panel>
    );
  }

  const usagePct =
    data && data.credits.periodLimit > 0
      ? Math.min(100, Math.round((data.credits.usedThisPeriod / data.credits.periodLimit) * 100))
      : 0;

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div className="billing-brand-bar">
        <label className="billing-brand-bar__field">
          <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 650 }}>
            Brand
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
            Stripe portal
          </button>
          {data ? (
            <Link href={brandHref(data.brand, 'campaigns')} className="btn-ghost">
              Campaigns →
            </Link>
          ) : null}
        </div>
      </div>

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}

      {loading && !data ? (
        <p className="muted">Loading billing…</p>
      ) : data ? (
        <>
          <StatGrid>
            <Stat label="Lead plan" value={data.plan.label} tone="accent" />
            <Stat
              label="Credits left"
              value={data.credits.totalRemaining.toLocaleString()}
            />
            <Stat label="Used this period" value={`${data.credits.usedThisPeriod} / ${data.credits.periodLimit}`} />
            <Stat label="Escrow wallet" value={data.wallet.balanceLabel} />
          </StatGrid>

          <Panel
            title="Lead plan & usage"
            description="Generate Leads consumes 1 credit per saved enriched lead. CSV / manual import is unlimited and free."
          >
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--line)',
                overflow: 'hidden',
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  width: `${usagePct}%`,
                  height: '100%',
                  background: 'var(--accent)',
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Allotment {data.credits.allotmentRemaining} · Pack {data.credits.packRemaining}
              {data.credits.packExpiresAt
                ? ` (pack expires ${new Date(data.credits.packExpiresAt).toLocaleDateString()})`
                : ''}
              {data.subscription
                ? ` · Sub ${data.subscription.status}${
                    data.subscription.currentPeriodEnd
                      ? ` · renews ${new Date(data.subscription.currentPeriodEnd * 1000).toLocaleDateString()}`
                      : ''
                  }`
                : ''}
            </p>
            {data.credits.plan === 'FREE' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void subscribeLead('month')}
                >
                  Upgrade ${BRAND_LEAD_PLAN.LEAD_MONTHLY.priceUsd}/mo · 1,000 leads
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => void subscribeLead('year')}
                >
                  Annual ${BRAND_LEAD_PLAN.LEAD_ANNUAL.priceUsd}/yr (20% off)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
                  Manage subscription
                </button>
                {data.credits.plan === 'LEAD_MONTHLY' ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => void subscribeLead('year')}
                  >
                    Switch to annual ${BRAND_LEAD_PLAN.LEAD_ANNUAL.priceUsd}
                  </button>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel title="Lead credit packs" description="Overage packs burn after allotment hits zero. 12-month shelf life.">
            <div className="billing-fund-presets">
              {LEAD_PACKS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => void buyPack(p.key)}
                >
                  {p.label} · ${p.priceUsd}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Payment methods"
            description="Primary card for invoices. Backup is the next saved card — add more in Stripe portal."
            actions={
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
                Add / edit cards
              </button>
            }
          >
            {data.paymentMethods.length === 0 ? (
              <EmptyState
                title="No cards on file"
                description="Fund the wallet or subscribe — Stripe saves the card. Then set primary here."
              />
            ) : (
              <ul className="brand-list">
                {data.paymentMethods.map((pm) => (
                  <li key={pm.id}>
                    <span>
                      {(pm.brand || 'Card').toUpperCase()} ···· {pm.last4}
                      {pm.expMonth && pm.expYear ? (
                        <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                          {pm.expMonth}/{pm.expYear}
                        </span>
                      ) : null}
                      {pm.isDefault ? (
                        <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                          Primary
                        </span>
                      ) : null}
                      {pm.isBackup ? (
                        <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                          Backup
                        </span>
                      ) : null}
                    </span>
                    {!pm.isDefault ? (
                      <button
                        type="button"
                        className="soft-link"
                        disabled={busy}
                        onClick={() => void setPrimary(pm.id)}
                      >
                        Make primary
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Charges & invoices" description="Stripe invoices for subscriptions, packs, and wallet funds.">
            {data.invoices.length === 0 ? (
              <EmptyState title="No invoices yet" description="Charges appear here after the first Stripe checkout." />
            ) : (
              <div className="billing-ledger-wrap">
                <table className="billing-ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Description</th>
                      <th scope="col">Status</th>
                      <th scope="col">Amount</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {new Date(inv.created * 1000).toLocaleDateString()}
                        </td>
                        <td>{inv.description || inv.number || inv.id}</td>
                        <td>{inv.status}</td>
                        <td>${(inv.amountPaid / 100).toFixed(2)}</td>
                        <td>
                          {inv.hostedInvoiceUrl ? (
                            <a href={inv.hostedInvoiceUrl} className="soft-link" target="_blank" rel="noreferrer">
                              View
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Campaign budgets"
            description="Per-campaign budget caps and escrow currently locked."
          >
            {data.campaigns.length === 0 ? (
              <EmptyState title="No campaigns" description="Open a campaign to lock escrow from the wallet." />
            ) : (
              <ul className="brand-list">
                {data.campaigns.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.title}
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        {c.status} · budget {c.budgetLabel}
                      </span>
                    </span>
                    <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <strong>{c.escrowLabel}</strong>
                      <Link href={brandHref(data.brand, 'campaigns', c.id)} className="soft-link">
                        Open
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Fund campaign escrow"
            description="Prepaid wallet for SDR payouts (~20% platform fee on verified results)."
          >
            <div className="billing-fund-presets">
              {FUND_PRESETS.map((d) => (
                <button key={d} type="button" className="btn" disabled={busy} onClick={() => void fund(d)}>
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
          </Panel>

          <Panel title="Wallet ledger">
            {data.wallet.ledger.length === 0 ? (
              <EmptyState title="No wallet movements" description="Fund the wallet to see the first credit." />
            ) : (
              <div className="billing-ledger-wrap">
                <table className="billing-ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Type</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wallet.ledger.map((row) => (
                      <tr key={row.id}>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>
                          {new Date(row.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>{LEDGER_LABELS[row.type] || row.type}</td>
                        <td>{money(row.amountCents)}</td>
                        <td className="muted">${(row.balanceAfter / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Lead credit ledger">
            {data.creditLedger.length === 0 ? (
              <EmptyState title="No credit activity" description="Generate Leads or buy a pack to see movements." />
            ) : (
              <div className="billing-ledger-wrap">
                <table className="billing-ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Type</th>
                      <th scope="col">Δ</th>
                      <th scope="col">Allotment</th>
                      <th scope="col">Pack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.creditLedger.map((row) => (
                      <tr key={row.id}>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>
                          {new Date(row.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          {LEDGER_LABELS[row.type] || row.type}
                          {row.note ? (
                            <div className="muted" style={{ fontSize: '0.75rem' }}>
                              {row.note}
                            </div>
                          ) : null}
                        </td>
                        <td>{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
                        <td>{row.allotmentAfter}</td>
                        <td>{row.packAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
