'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brandPathKey } from '@/lib/brand-context';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import { BRAND_LEAD_PLAN, LEAD_PACKS } from '@/lib/product';
import { useShell } from '@/components/ShellProvider';

type SubscribePayload = {
  brand: { id: string; slug: string; name: string };
  canCheckout: boolean;
  demo?: boolean;
  credits: {
    plan: string;
    allotmentRemaining: number;
    packRemaining: number;
    totalRemaining: number;
    usedThisPeriod: number;
    periodLimit: number;
  };
  plan: { key: string; label: string; priceUsd: number; allotment: number };
  subscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
  } | null;
};

type BillingInterval = 'month' | 'year';

export default function BrandSubscribeClient() {
  const shell = useShell();
  const selected = shell?.selectedBrand || null;
  const brandKey = selected ? brandPathKey(selected) : '';

  const [data, setData] = useState<SubscribePayload | null>(null);
  const [loading, setLoading] = useState(Boolean(brandKey));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [interval, setInterval] = useState<BillingInterval>('month');

  const load = useCallback(async (key: string) => {
    if (!key) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(key)}/subscribe`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load plan');
      setData(json);
      if (json.credits?.plan === 'LEAD_ANNUAL') setInterval('year');
      else setInterval('month');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Load failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lead_plan') === 'success') {
      setMsg('Enrichment plan activated — credits refresh after Stripe confirms.');
    } else if (params.get('lead_pack') === 'success') {
      setMsg('Enrichment pack purchased — credits appear after Stripe confirms.');
    } else if (params.get('lead_plan') === 'cancel' || params.get('lead_pack') === 'cancel') {
      setErr('Checkout canceled — no charge was made.');
    }
  }, []);

  useEffect(() => {
    void load(brandKey);
  }, [brandKey, load]);

  async function subscribeLead() {
    const brandId = data?.brand.id;
    if (!brandId || !data?.canCheckout) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/billing/lead-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, interval }),
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
    const brandId = data?.brand.id;
    if (!brandId || !data?.canCheckout) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/billing/lead-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, pack }),
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
        body: JSON.stringify({ returnPath: '/subscribe/brand' }),
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

  const currentKey = data?.credits.plan || 'FREE';
  const onPaidPlan = currentKey === 'LEAD_MONTHLY' || currentKey === 'LEAD_ANNUAL';
  const paidMatchesInterval =
    (interval === 'month' && currentKey === 'LEAD_MONTHLY') ||
    (interval === 'year' && currentKey === 'LEAD_ANNUAL');
  const paidMeta = interval === 'year' ? BRAND_LEAD_PLAN.LEAD_ANNUAL : BRAND_LEAD_PLAN.LEAD_MONTHLY;
  const canCheckout = Boolean(data?.canCheckout);
  const demo = Boolean(data?.demo);

  return (
    <main className="app-page">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="page-eyebrow">Brand</p>
          <h1 className="page-title">Subscribe</h1>
          <p className="page-desc">
            {data ? (
              <>
                Subscribe for lead enrichment — Maps scrape + phones + intel so SDRs dial
                ready contacts.
                <br />
                Current:{' '}
                <strong style={{ color: 'var(--ink)' }}>{data.plan.label}</strong>
                {selected ? <> · {selected.name}</> : null}
                {' · '}
                {data.credits.totalRemaining.toLocaleString()} enrichment credits left
                {demo ? ' · Demo desk (checkout on Live brands)' : ''}
              </>
            ) : selected ? (
              <>
                Enrichment plans for {selected.name} — buy credits to turn raw businesses into
                dial-ready leads.
              </>
            ) : (
              'Enrichment plans power Generate Leads: scrape, enrich phones & intel, then campaign.'
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/billing" className="btn-ghost">
            Billing & ledger →
          </Link>
        </div>
      </header>

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}

      {!selected ? (
        <Panel title="Select a brand">
          <EmptyState
            title="No brand selected"
            description="Open a brand desk first — plans apply to the active brand in the sidebar."
            action={
              <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                My brands →
              </Link>
            }
          />
        </Panel>
      ) : null}

      {selected && loading && !data ? <p className="muted">Loading plans…</p> : null}

      {selected ? (
        <>
          <div className="subscribe-interval" role="group" aria-label="Billing interval">
            <button
              type="button"
              className={`subscribe-interval__btn${interval === 'month' ? ' is-active' : ''}`}
              onClick={() => setInterval('month')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`subscribe-interval__btn${interval === 'year' ? ' is-active' : ''}`}
              onClick={() => setInterval('year')}
            >
              Yearly
              <span className="subscribe-interval__save">Save 20%</span>
            </button>
          </div>

          <section style={{ marginBottom: '1.5rem' }}>
            <p className="page-eyebrow" style={{ marginBottom: '0.35rem' }}>
              Enrichment plans
            </p>
            <p className="muted" style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', maxWidth: '40rem' }}>
              Credits are spent when Generate Leads saves an enriched lead (phone + intel). CSV /
              manual imports stay free.
            </p>
            <div className="auto-fit-grid">
              <section
                className="panel"
                style={{
                  margin: 0,
                  borderColor:
                    currentKey === 'FREE' ? 'rgba(var(--accent-2-rgb), 0.45)' : undefined,
                }}
              >
                <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                  {BRAND_LEAD_PLAN.FREE.label}
                  {currentKey === 'FREE' ? ' · Current' : ''}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {BRAND_LEAD_PLAN.FREE.tagline}
                </p>
                <p className="subscribe-price">
                  $0
                  <span>/mo</span>
                </p>
                <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                  {BRAND_LEAD_PLAN.FREE.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: '1rem', width: '100%' }}
                  disabled
                >
                  {currentKey === 'FREE' ? 'Current' : 'Included'}
                </button>
              </section>

              <section
                className="panel"
                style={{
                  margin: 0,
                  borderColor: onPaidPlan ? 'rgba(var(--accent-2-rgb), 0.45)' : undefined,
                }}
              >
                <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                  {paidMeta.label}
                  {paidMatchesInterval ? ' · Current' : onPaidPlan ? ' · Subscribed' : ''}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {paidMeta.tagline}
                </p>
                <p className="subscribe-price">
                  {interval === 'year' ? (
                    <>
                      ${paidMeta.priceUsd}
                      <span>/yr</span>
                      <em>≈ ${BRAND_LEAD_PLAN.LEAD_ANNUAL.monthlyEquivalentUsd}/mo</em>
                    </>
                  ) : (
                    <>
                      ${paidMeta.priceUsd}
                      <span>/mo</span>
                    </>
                  )}
                </p>
                <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                  {paidMeta.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {paidMatchesInterval ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ marginTop: '1rem', width: '100%' }}
                    disabled={busy || !canCheckout}
                    onClick={() => void openPortal()}
                  >
                    Current · Manage
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: '1rem', width: '100%' }}
                    disabled={busy || !canCheckout}
                    onClick={() => void subscribeLead()}
                  >
                    {onPaidPlan
                      ? interval === 'year'
                        ? 'Switch to yearly'
                        : 'Switch to monthly'
                      : interval === 'year'
                        ? 'Get enrichment yearly'
                        : 'Get enrichment plan'}
                  </button>
                )}
              </section>
            </div>
          </section>

          {data?.subscription ? (
            <p className="muted" style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Subscription {data.subscription.status}
              {data.subscription.currentPeriodEnd
                ? ` · renews ${new Date(data.subscription.currentPeriodEnd * 1000).toLocaleDateString()}`
                : ''}
            </p>
          ) : null}

          <Panel
            title="Enrichment credit packs"
            description="One-time top-ups when your monthly enrichment allotment is spent. Each credit = one enriched lead saved from Generate Leads. 12-month shelf life."
          >
            <div className="billing-fund-presets" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {LEAD_PACKS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="btn-ghost"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                  disabled={busy || !canCheckout}
                  onClick={() => void buyPack(p.key)}
                  title={!canCheckout && demo ? 'Switch to Live to purchase' : undefined}
                >
                  <span>
                    {p.label}
                    <span className="muted" style={{ marginLeft: '0.5rem', fontWeight: 500 }}>
                      {p.blurb}
                    </span>
                  </span>
                  <span>${p.priceUsd}</span>
                </button>
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </main>
  );
}
