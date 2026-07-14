'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { adminGetJson, ADMIN_DEMO_MSG } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';
import { brandHref } from '@/lib/brand-context';
import type { AdminBrandsMatrix } from '@/lib/admin-platform-types';

type BrandRow = AdminBrandsMatrix['brands'][number];

function riskClass(risk: number) {
  if (risk >= 50) return 'admin-risk admin-risk--high';
  if (risk >= 25) return 'admin-risk admin-risk--mid';
  return 'admin-risk';
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grantCredits, setGrantCredits] = useState('');
  const [walletDollars, setWalletDollars] = useState('');
  const [note, setNote] = useState('');
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const res = await adminGetJson<{ brands: BrandRow[] }>('/api/admin/brands', isDemo);
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;
    setBrands(res.data?.brands || []);
  }

  useEffect(() => {
    if (!hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, hydrated]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((b) => {
      const hay = `${b.name} ${b.slug} ${b.ownerEmail || ''} ${b.ownerName || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [brands, q]);

  const selected = useMemo(
    () => brands.find((b) => b.id === selectedId) || null,
    [brands, selectedId]
  );

  useEffect(() => {
    if (selectedId && !brands.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [brands, selectedId]);

  useEffect(() => {
    setGrantCredits('');
    setWalletDollars('');
    setNote('');
    setMsg('');
  }, [selectedId]);

  function selectBrand(id: string) {
    setSelectedId(id);
  }

  async function submitOverride() {
    if (!selected) return;
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }

    const reason = note.trim();
    if (!reason) {
      setMsg('Reason is required for audited overrides.');
      return;
    }

    const creditsRaw = grantCredits.trim();
    const walletRaw = walletDollars.trim();
    const credits =
      creditsRaw === '' ? null : Math.round(Number(creditsRaw));
    const walletCents =
      walletRaw === ''
        ? null
        : Math.round(Number(walletRaw) * 100);

    if (
      (credits == null || !Number.isFinite(credits) || credits === 0) &&
      (walletCents == null || !Number.isFinite(walletCents) || walletCents === 0)
    ) {
      setMsg('Enter lead credits to grant and/or a wallet dollar adjust.');
      return;
    }
    if (credits != null && (!Number.isFinite(credits) || credits < 0)) {
      setMsg('Lead credits must be a non-negative whole number.');
      return;
    }
    if (walletCents != null && !Number.isFinite(walletCents)) {
      setMsg('Wallet adjust must be a valid dollar amount.');
      return;
    }

    setBusy(true);
    setMsg('');
    const body: {
      brandId: string;
      note: string;
      grantCredits?: number;
      walletAdjustCents?: number;
    } = { brandId: selected.id, note: reason };
    if (credits != null && credits > 0) body.grantCredits = credits;
    if (walletCents != null && walletCents !== 0) body.walletAdjustCents = walletCents;

    const res = await fetch('/api/admin/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || 'Override failed');
      return;
    }
    setBrands(d.brands || []);
    setGrantCredits('');
    setWalletDollars('');
    setNote('');
    setMsg('Updated.');
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Brands" description="Superadmin required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Brand ops matrix"
        description="Cross-brand risk triage — liquidity, lead credits, campaign/SDR health. Select a brand to apply audited credit or wallet adjustments."
      />

      <div className="admin-split admin-split--brands">
        <Panel
          title="Matrix"
          description={`${brands.length} brands · sorted by risk`}
          actions={
            <div className="search-row" style={{ margin: 0 }}>
              <input
                className="field"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter brand / owner"
                style={{ minWidth: 180 }}
                aria-label="Filter brands"
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              title="No brands"
              description="Create a brand desk to populate this matrix."
            />
          ) : (
            <>
              <ul className="admin-brand-cards" aria-label="Brand accounts">
                {filtered.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={`admin-brand-card${b.risk >= 50 ? ' is-risk' : ''}${
                        selectedId === b.id ? ' is-active' : ''
                      }`}
                      onClick={() => selectBrand(b.id)}
                    >
                      <div className="admin-brand-card__top">
                        <div>
                          <strong className="admin-table__brand">{b.name}</strong>
                          <div className="muted small">
                            {b.ownerName || b.ownerEmail || 'no owner'}
                          </div>
                          {b.topSignal ? (
                            <div className="muted small">{b.topSignal.label}</div>
                          ) : null}
                        </div>
                        <span className={riskClass(b.risk)}>{b.risk}</span>
                      </div>
                      <div className="admin-brand-card__stats">
                        <span>
                          Plan <strong>{b.leadPlan}</strong>
                        </span>
                        <span>
                          Credits <strong>{b.creditsRemaining}</strong>
                        </span>
                        <span>
                          Wallet <strong>{b.walletLabel}</strong>
                        </span>
                        <span>
                          Open <strong>{b.openCampaigns}</strong>
                        </span>
                        <span>
                          SDRs <strong>{b.activeSdrs}</strong>
                        </span>
                        <span>
                          Ready <strong>{b.dialReady}</strong>
                        </span>
                        <span>
                          Goals 7d <strong>{b.goals7d}</strong>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Plan</th>
                      <th>Credits</th>
                      <th>Wallet</th>
                      <th>Open</th>
                      <th>SDRs</th>
                      <th>Ready</th>
                      <th>Goals 7d</th>
                      <th>Risk / signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        className={`admin-table__row--selectable${
                          b.risk >= 50 ? ' admin-table__row--risk' : ''
                        }${selectedId === b.id ? ' is-active' : ''}`}
                        tabIndex={0}
                        aria-selected={selectedId === b.id}
                        onClick={() => selectBrand(b.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectBrand(b.id);
                          }
                        }}
                      >
                        <td>
                          <span className="admin-table__brand">{b.name}</span>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>
                            {b.ownerEmail || 'no owner'}
                          </div>
                        </td>
                        <td>{b.leadPlan}</td>
                        <td>{b.creditsRemaining}</td>
                        <td>{b.walletLabel}</td>
                        <td>{b.openCampaigns}</td>
                        <td>{b.activeSdrs}</td>
                        <td>{b.dialReady}</td>
                        <td>{b.goals7d}</td>
                        <td>
                          <span className={riskClass(b.risk)}>{b.risk}</span>
                          {b.topSignal ? (
                            <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                              {b.topSignal.label}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Brand workspace"
          description="Custom overrides require a reason and are audit-logged."
        >
          {selected ? (
            <div className="stack">
              <div>
                <p style={{ marginTop: 0, marginBottom: '0.25rem' }}>
                  <strong>{selected.name}</strong>
                  <span className="muted"> · {selected.leadPlan}</span>
                </p>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Owner:{' '}
                  {selected.ownerName || selected.ownerEmail || '—'}
                  {selected.ownerEmail && selected.ownerName
                    ? ` · ${selected.ownerEmail}`
                    : null}
                </p>
                {selected.topSignal ? (
                  <p style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                    Signal: <strong>{selected.topSignal.label}</strong>
                    <span className="muted"> — {selected.topSignal.detail}</span>
                  </p>
                ) : (
                  <p className="muted" style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                    No risk signal · score {selected.risk}
                  </p>
                )}
              </div>

              <div className="admin-brand-card__stats">
                <span>
                  Credits <strong>{selected.creditsRemaining}</strong>
                </span>
                <span>
                  Wallet <strong>{selected.walletLabel}</strong>
                </span>
                <span>
                  Open <strong>{selected.openCampaigns}</strong>
                </span>
                <span>
                  SDRs <strong>{selected.activeSdrs}</strong>
                </span>
                <span>
                  Dial-ready <strong>{selected.dialReady}</strong>
                </span>
                <span>
                  Goals 7d <strong>{selected.goals7d}</strong>
                </span>
                <span>
                  Runway{' '}
                  <strong>
                    {selected.runwayDays != null ? `${selected.runwayDays}d` : '—'}
                  </strong>
                </span>
                <span>
                  $/goal <strong>{selected.costPerGoalLabel}</strong>
                </span>
              </div>

              <div className="admin-brand-links">
                <Link href={brandHref(selected)} className="soft-link">
                  Open brand desk →
                </Link>
                {selected.ownerId ? (
                  <Link href={`/admin/users/${selected.ownerId}`} className="soft-link">
                    Owner dossier →
                  </Link>
                ) : null}
                <Link href="/admin/finance" className="soft-link">
                  Finance ledger →
                </Link>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noreferrer"
                  className="soft-link"
                >
                  Stripe Dashboard ↗
                </a>
              </div>

              <label className="admin-field">
                <span>Grant lead credits</span>
                <input
                  className="field"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={grantCredits}
                  onChange={(e) => setGrantCredits(e.target.value)}
                  placeholder="e.g. 50"
                  disabled={busy}
                />
              </label>

              <label className="admin-field">
                <span>Adjust wallet ($)</span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={walletDollars}
                  onChange={(e) => setWalletDollars(e.target.value)}
                  placeholder="e.g. 250 or -50"
                  disabled={busy}
                />
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Positive credits the wallet; negative debits (fails if balance is short).
                </span>
              </label>

              <label className="admin-field">
                <span>Reason (required)</span>
                <textarea
                  className="field"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this override? Ticket / customer request / ops triage…"
                  disabled={busy}
                />
              </label>

              <div className="admin-review__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => submitOverride()}
                >
                  {busy ? 'Applying…' : 'Apply override'}
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Select a brand row to inspect metrics and apply overrides.</p>
          )}
        </Panel>
      </div>

      {msg ? (
        <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
