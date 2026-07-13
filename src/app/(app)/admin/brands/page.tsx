'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminSubNav } from '@/components/AdminSubNav';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { brandHref } from '@/lib/brand-context';
import type { AdminBrandsMatrix } from '@/lib/admin-platform-types';

type BrandRow = AdminBrandsMatrix['brands'][number];

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    const res = await fetch('/api/admin/brands');
    if (res.status === 403 || res.status === 401) {
      setForbidden(true);
      return;
    }
    const d = await res.json();
    setBrands(d.brands || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function override(
    brandId: string,
    patch: { grantCredits?: number; walletAdjustCents?: number }
  ) {
    setBusyId(brandId);
    setMsg('');
    const res = await fetch('/api/admin/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, ...patch }),
    });
    const d = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setMsg(d.error || 'Override failed');
      return;
    }
    setBrands(d.brands || []);
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

  const filtered = q.trim()
    ? brands.filter((b) => {
        const hay = `${b.name} ${b.slug} ${b.ownerEmail || ''} ${b.ownerName || ''}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      })
    : brands;

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Brand accounts"
        description="Escrow, credits, campaigns, and risk across every corporate desk."
      />
      <AdminSubNav />

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
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState title="No brands" description="Create a brand desk to populate this matrix." />
        ) : (
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
                  <th>Risk</th>
                  <th>Overrides</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className={b.risk >= 50 ? 'admin-table__row--risk' : undefined}>
                    <td>
                      <Link href={brandHref(b)} className="admin-table__brand">
                        {b.name}
                      </Link>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {b.ownerEmail || 'no owner'}
                      </div>
                      {b.topSignal ? (
                        <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                          {b.topSignal.label}
                        </div>
                      ) : null}
                    </td>
                    <td>{b.leadPlan}</td>
                    <td>{b.creditsRemaining}</td>
                    <td>{b.walletLabel}</td>
                    <td>{b.openCampaigns}</td>
                    <td>{b.activeSdrs}</td>
                    <td>{b.dialReady}</td>
                    <td>{b.goals7d}</td>
                    <td>
                      <span
                        className={
                          b.risk >= 50
                            ? 'admin-risk admin-risk--high'
                            : b.risk >= 25
                              ? 'admin-risk admin-risk--mid'
                              : 'admin-risk'
                        }
                      >
                        {b.risk}
                      </span>
                    </td>
                    <td>
                      <div className="admin-override-row">
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busyId === b.id}
                          onClick={() => override(b.id, { grantCredits: 100 })}
                        >
                          +100 credits
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={busyId === b.id}
                          onClick={() =>
                            override(b.id, { walletAdjustCents: 10000 })
                          }
                        >
                          +$100 wallet
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {msg ? (
        <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
