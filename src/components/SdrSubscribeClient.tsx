'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PLAN,
  TRIAL_MINUTES,
  REFERRAL_REWARD_LABEL,
  MINUTE_PACKS,
  type PaidPlanKey,
} from '@/lib/product';
import { useShell } from '@/components/ShellProvider';

type BillingInterval = 'month' | 'year';

const PAID_TIERS: {
  tier: 'STARTER' | 'PRO';
  features: string[];
  highlight?: boolean;
}[] = [
  {
    tier: 'STARTER',
    highlight: true,
    features: [
      `${PLAN.STARTER.minutes} practice minutes / mo`,
      ...PLAN.STARTER.features,
      `Refer a friend → ${REFERRAL_REWARD_LABEL} each`,
    ],
  },
  {
    tier: 'PRO',
    features: [...PLAN.PRO.features],
  },
];

export default function SdrSubscribeClient() {
  const shell = useShell();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<string | null>(() => shell?.metrics.plan || null);
  const [minutes, setMinutes] = useState<number | null>(
    () => shell?.metrics.minutesRemaining ?? null
  );
  const [loadError, setLoadError] = useState('');
  const [interval, setInterval] = useState<BillingInterval>('month');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'cancel') setMsg('Checkout canceled — no charge was made.');
    if (params.get('pack') === 'success')
      setMsg('Minute pack purchased — balance updates after Stripe confirms.');
    if (params.get('pack') === 'cancel') setMsg('Pack checkout canceled.');

    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load plan.');
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setPlan(d.plan);
        setMinutes(d.minutesRemaining);
      })
      .catch((e) => setLoadError(e.message || 'Could not load plan.'));
  }, []);

  async function buyPack(pack: string) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/billing/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, target: 'personal' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || 'Pack checkout failed');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Pack checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function checkout(tier: PaidPlanKey) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || data.hint || 'Checkout failed');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="page-eyebrow">SDR</p>
          <h1 className="page-title">Subscribe</h1>
          <p className="page-desc">
            {plan ? (
              <>
                Current plan: <strong style={{ color: 'var(--ink)' }}>{plan}</strong>
                {minutes != null && <> · {minutes} min left</>}
              </>
            ) : (
              `New accounts start on Free with ${TRIAL_MINUTES} practice minutes.`
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/billing" className="btn-ghost">
            Billing & charges →
          </Link>
        </div>
      </header>

      {loadError ? <p className="msg-err">{loadError}</p> : null}
      {msg ? <p className={msg.includes('canceled') ? 'msg-err' : 'msg-ok'}>{msg}</p> : null}

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
        <p className="page-eyebrow" style={{ marginBottom: '0.65rem' }}>
          Practice plans
        </p>
        <div className="auto-fit-grid">
          <section
            className="panel"
            style={{
              margin: 0,
              borderColor: plan === 'FREE' || !plan ? 'rgba(var(--accent-2-rgb), 0.35)' : undefined,
            }}
          >
            <p className="page-eyebrow">{PLAN.FREE.audience} · Free</p>
            <p className="subscribe-price">
              $0
              <span>/mo</span>
            </p>
            <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
              {PLAN.FREE.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {(plan === 'FREE' || !plan) && (
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: '1rem', width: '100%' }}
                disabled
              >
                Current
              </button>
            )}
          </section>

          {PAID_TIERS.map((p) => {
            const meta = PLAN[p.tier];
            const isCurrent = plan === p.tier;
            const price =
              interval === 'year' && 'annualPriceUsd' in meta
                ? meta.annualPriceUsd
                : meta.price;
            const unit = interval === 'year' ? '/yr' : '/mo';
            const monthlyHint =
              interval === 'year' && 'annualPriceUsd' in meta
                ? Math.round((meta.annualPriceUsd / 12) * 10) / 10
                : null;
            return (
              <section
                key={p.tier}
                className="panel"
                style={{
                  margin: 0,
                  borderColor: isCurrent
                    ? 'rgba(var(--accent-2-rgb), 0.45)'
                    : p.highlight
                      ? 'rgba(var(--accent-rgb), 0.45)'
                      : undefined,
                }}
              >
                <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                  {meta.audience} · {meta.label}
                  {isCurrent ? ' · Current' : ''}
                </p>
                <p className="subscribe-price">
                  ${price}
                  <span>{unit}</span>
                  {monthlyHint != null ? <em>≈ ${monthlyHint}/mo</em> : null}
                </p>
                <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy || isCurrent}
                  onClick={() => checkout(p.tier)}
                  className={p.highlight && !isCurrent ? 'btn' : 'btn-ghost'}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {isCurrent ? 'Current' : `Get ${meta.label}`}
                </button>
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Minute packs</h2>
            <p className="panel__desc">
              Out of minutes? Buy a one-time pack. No auto-overage — you choose when to top up.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          {MINUTE_PACKS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy}
              onClick={() => buyPack(p.key)}
              className="btn"
            >
              {p.label} · ${p.priceUsd}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
