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
import BrandBillingPanel from '@/components/BrandBillingPanel';

const MONTHLY_CARDS: { tier: 'STARTER' | 'PRO'; features: string[]; highlight?: boolean }[] = [
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

export default function AppPricingPage() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [orgPool, setOrgPool] = useState<number | null>(null);
  const [minuteSource, setMinuteSource] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [orgSeats, setOrgSeats] = useState(PLAN.TEAM.seats || 5);

  useEffect(() => {
    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load billing profile.');
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setPlan(d.plan);
        setMinutes(d.minutesRemaining);
        setOrgPool(typeof d.orgPoolMinutes === 'number' ? d.orgPoolMinutes : null);
        setMinuteSource(d.minuteSource || null);
        setHasSubscription(Boolean(d.hasSubscription));
        setPlatformRole(d.platformRole || null);
      })
      .catch((e) => setLoadError(e.message || 'Could not load billing profile.'));
  }, []);

  async function buyPack(pack: string, target: 'personal' | 'org_pool' = 'personal') {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/billing/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, target }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || 'Pack checkout failed');
    } catch (e: any) {
      setMsg(e.message || 'Pack checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function checkout(tier: PaidPlanKey, seats?: number) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          ...(tier === 'TEAM' ? { seats: seats ?? orgSeats } : {}),
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || data.hint || 'Checkout failed');
    } catch (e: any) {
      setMsg(e.message || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function activateBrand() {
    setBusy(true);
    setMsg('');
    try {
      const roleRes = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformRole: 'BRAND' }),
      });
      const roleData = await roleRes.json();
      if (!roleRes.ok) {
        setMsg(roleData.error || 'Could not switch to Brand');
        return;
      }
      setPlatformRole(roleData.platformRole || 'BRAND');
      setMsg('Brand role active — post campaigns from your dashboard.');
      window.location.href = '/dashboard';
    } catch (e: any) {
      setMsg(e.message || 'Could not activate Brand');
    } finally {
      setBusy(false);
    }
  }

  async function portal() {
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnPath: '/billing' }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMsg(data.error || 'Portal unavailable');
  }

  const role = platformRole || 'REP';
  const isBrandDesk = role === 'BRAND' || role === 'RECRUITER';
  const showSdrPlans = role === 'REP' || role === 'MANAGER' || role === 'SUPERADMIN';
  const showOrgPlan = role === 'REP' || role === 'MANAGER' || role === 'SUPERADMIN';
  const showBrandPlan = !isBrandDesk && (role === 'SUPERADMIN' || role === 'REP');
  const showMinutePacks = showSdrPlans;
  const brandActive = role === 'BRAND' || role === 'SUPERADMIN';
  const orgPriceLabel = `$${PLAN.TEAM.price.toFixed(2)}`;

  return (
    <main className="app-page">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="page-eyebrow">Account</p>
          <h1 className="page-title">Billing</h1>
          <p className="page-desc">
            {role === 'BRAND' || role === 'RECRUITER' ? (
              <>Fund campaign escrow, review the ledger, and manage payment methods.</>
            ) : plan ? (
              <>
                Current plan: <strong style={{ color: 'var(--ink)' }}>{plan}</strong>
                {minutes != null && <> · {minutes} min left</>}
                {orgPool != null && <> · team pool {orgPool}</>}
                {minuteSource === 'org_pool' && <> (drawing from team pool)</>}
              </>
            ) : (
              `New accounts start on Free with ${TRIAL_MINUTES} practice minutes.`
            )}
          </p>
        </div>
        {(hasSubscription || role === 'BRAND' || role === 'RECRUITER') && (
          <div className="page-header__actions">
            <button type="button" onClick={portal} className="btn-ghost">
              {role === 'BRAND' || role === 'RECRUITER'
                ? 'Payment methods & invoices'
                : 'Manage subscription'}
            </button>
          </div>
        )}
      </header>
      {loadError && <p className="msg-err">{loadError}</p>}

      {isBrandDesk ? <BrandBillingPanel /> : null}

      {showSdrPlans && (
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
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                  margin: '0.35rem 0',
                  letterSpacing: '-0.03em',
                }}
              >
                $0
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>/mo</span>
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

            {MONTHLY_CARDS.map((p) => {
              const meta = PLAN[p.tier];
              return (
                <section
                  key={p.tier}
                  className="panel"
                  style={{
                    margin: 0,
                    borderColor: p.highlight ? 'rgba(var(--accent-rgb), 0.45)' : undefined,
                  }}
                >
                  <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                    {meta.audience} · {meta.label}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.2rem',
                      fontWeight: 800,
                      margin: '0.35rem 0',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    ${meta.price}
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
                      /mo
                    </span>
                  </p>
                  <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => checkout(p.tier)}
                    className={p.highlight ? 'btn' : 'btn-ghost'}
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    {plan === p.tier ? 'Current' : `Get ${meta.label}`}
                  </button>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {showOrgPlan && (
        <section style={{ marginBottom: '1.5rem' }}>
          <p className="page-eyebrow" style={{ marginBottom: '0.35rem' }}>
            Org subscription
          </p>
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            For desks and academies — billed per seat. Most founders use campaigns instead.
          </p>
          <div className="auto-fit-grid--lg">
            <section
              className="panel"
              style={{
                margin: 0,
                borderColor: plan === 'TEAM' ? 'rgba(var(--accent-2-rgb), 0.35)' : 'rgba(var(--accent-rgb), 0.28)',
              }}
            >
              <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                Orgs · {PLAN.TEAM.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                  margin: '0.35rem 0',
                  letterSpacing: '-0.03em',
                }}
              >
                {orgPriceLabel}
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
                  /user/mo
                </span>
              </p>
              <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                {PLAN.TEAM.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <label
                className="form-field"
                style={{ marginTop: '0.85rem', marginBottom: '0.65rem' }}
              >
                <span className="form-field__label">Seats</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={100}
                  value={orgSeats}
                  onChange={(e) =>
                    setOrgSeats(Math.min(Math.max(Number(e.target.value) || 1, 1), 100))
                  }
                  style={{ maxWidth: 120 }}
                />
                <span className="form-field__hint">
                  Starting at {(orgSeats * PLAN.TEAM.price).toFixed(2)}/mo — adjust seats in
                  Checkout too.
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => checkout('TEAM', orgSeats)}
                className="btn"
                style={{ width: '100%' }}
              >
                {plan === 'TEAM' ? 'Manage / update seats' : `Get Org · ${orgSeats} seats`}
              </button>
            </section>
          </div>
        </section>
      )}

      {showBrandPlan && (
        <section style={{ marginBottom: '1.5rem' }}>
          <p className="page-eyebrow" style={{ marginBottom: '0.65rem' }}>
            Brand
          </p>
          <div className="auto-fit-grid">
            <section
              className="panel"
              style={{
                margin: 0,
                borderColor: brandActive ? 'rgba(var(--accent-2-rgb), 0.35)' : undefined,
              }}
            >
              <p className="page-eyebrow" style={{ color: 'var(--muted)' }}>
                Brands · Campaigns
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                  margin: '0.35rem 0',
                  letterSpacing: '-0.03em',
                }}
              >
                Free
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>
                  {' '}
                  for now
                </span>
              </p>
              <ul className="list-quiet" style={{ paddingLeft: '1.1rem' }}>
                <li>Post outbound campaigns</li>
                <li>Review practice-backed SDRs</li>
                <li>Product packs + talk tracks</li>
                <li>Pay for results (~20% platform fee)</li>
              </ul>
              <button
                type="button"
                disabled={busy || brandActive}
                onClick={activateBrand}
                className={brandActive ? 'btn-ghost' : 'btn'}
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {brandActive ? 'Active' : 'Activate Brand'}
              </button>
            </section>
          </div>
        </section>
      )}

      {showMinutePacks && (
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
                onClick={() => buyPack(p.key, 'personal')}
                className="btn"
              >
                {p.label} · ${p.priceUsd}
              </button>
            ))}
          </div>
        </section>
      )}

      {role === 'REP' && (
        <p className="muted" style={{ marginTop: '1.25rem', fontSize: '0.9rem' }}>
          Founder posting campaigns? Activate Brand above or switch role in{' '}
          <Link href="/settings" className="soft-link">
            Settings
          </Link>
          .
        </p>
      )}

      {msg && <p className="msg-ok">{msg}</p>}
    </main>
  );
}
