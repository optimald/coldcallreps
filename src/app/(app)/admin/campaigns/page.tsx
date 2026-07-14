'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  useAdminFetch,
} from '@/components/AdminPageKit';
import { EmptyState, Stat, StatGrid } from '@/components/ui/PagePrimitives';

type Campaign = {
  id: string;
  title: string;
  status: string;
  goalType: string;
  payoutCents: number;
  platformFeeBps: number;
  escrowLockedCents: number;
  applications: number;
  accepted: number;
  brandId: string;
  brandName: string;
  brandSlug: string;
  createdAt: string;
};

type Data = {
  kpis: {
    total: number;
    open: number;
    paused: number;
    escrowLockedLabel: string;
  };
  campaigns: Campaign[];
};

export default function AdminCampaignsPage() {
  const { data, forbidden, reload, error, isDemo, demoMsg } =
    useAdminFetch<Data>('/api/admin/campaigns');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const campaigns = data?.campaigns || [];
  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) || null,
    [campaigns, selectedId]
  );

  useEffect(() => {
    if (!selectedId && campaigns[0]) setSelectedId(campaigns[0].id);
    if (selectedId && !campaigns.some((c) => c.id === selectedId)) {
      setSelectedId(campaigns[0]?.id || null);
    }
  }, [campaigns, selectedId]);

  useEffect(() => {
    setReason('');
    setMsg('');
  }, [selectedId]);

  async function act(action: string) {
    if (!selectedId) return;
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: selectedId, action, reason }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Updated.' : d.error || 'Failed');
    if (res.ok) {
      setReason('');
      reload();
    }
  }

  function selectCampaign(id: string) {
    setSelectedId(id);
  }

  return (
    <AdminGate title="Campaigns" forbidden={forbidden}>
      <AdminPageChrome
        title="Campaign oversight"
        description="All marketplace campaigns — pause/unpublish with reason + audit."
      >
        {data?.kpis ? (
          <StatGrid>
            <Stat label="Listed" value={data.kpis.total} />
            <Stat label="Open" value={data.kpis.open} tone="good" />
            <Stat label="Paused" value={data.kpis.paused} tone="warn" />
            <Stat label="Escrow locked" value={data.kpis.escrowLockedLabel} tone="accent" />
          </StatGrid>
        ) : null}

        <div className="admin-split">
          <Panel
            title="Campaigns"
            description="Select a campaign, then pause / open / close in the workspace."
          >
            {campaigns.length === 0 ? (
              <EmptyState
                title="No campaigns"
                description="Marketplace campaigns will appear here once brands publish."
              />
            ) : (
              <>
                <ul className="admin-campaign-list" aria-label="Campaigns">
                  {campaigns.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`admin-review__item${
                          selectedId === c.id ? ' is-active' : ''
                        }`}
                        onClick={() => selectCampaign(c.id)}
                      >
                        <strong>{c.title}</strong>
                        <span className="muted">
                          {' '}
                          · {c.status} · {c.brandName}
                        </span>
                        <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                          {c.accepted}/{c.applications} apps ·{' '}
                          {(c.platformFeeBps / 100).toFixed(0)}% fee · $
                          {(c.escrowLockedCents / 100).toFixed(0)} escrow
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Apps</th>
                        <th>Fee</th>
                        <th>Escrow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr
                          key={c.id}
                          className={`admin-table__row--selectable${
                            selectedId === c.id ? ' is-active' : ''
                          }`}
                          tabIndex={0}
                          aria-selected={selectedId === c.id}
                          onClick={() => selectCampaign(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectCampaign(c.id);
                            }
                          }}
                        >
                          <td>
                            <strong>{c.title}</strong>
                            <div className="muted" style={{ fontSize: '0.8rem' }}>
                              <Link
                                href={`/brands/${c.brandSlug || c.brandId}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.brandName}
                              </Link>
                              {' · '}
                              {c.goalType} · ${(c.payoutCents / 100).toFixed(0)}
                            </div>
                          </td>
                          <td>{c.status}</td>
                          <td>
                            {c.accepted}/{c.applications}
                          </td>
                          <td>{(c.platformFeeBps / 100).toFixed(0)}%</td>
                          <td>${(c.escrowLockedCents / 100).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          <Panel
            compact
            title="Campaign workspace"
            description="Reason is required and audit-logged."
          >
            {selected ? (
              <div className="stack">
                <p style={{ marginTop: 0 }}>
                  <strong>{selected.title}</strong>
                </p>
                <p className="muted" style={{ marginTop: 0 }}>
                  Brand:{' '}
                  <Link href={`/brands/${selected.brandSlug || selected.brandId}`}>
                    {selected.brandName}
                  </Link>
                  <br />
                  Status: <strong>{selected.status}</strong>
                  {' · '}
                  {selected.goalType} · ${(selected.payoutCents / 100).toFixed(0)} payout
                  <br />
                  Apps: {selected.accepted}/{selected.applications}
                  {' · '}
                  Fee {(selected.platformFeeBps / 100).toFixed(0)}%
                  {' · '}
                  Escrow ${(selected.escrowLockedCents / 100).toFixed(0)}
                </p>
                <textarea
                  className="field"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required reason for pause / open / close"
                />
                <div className="admin-review__actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => act('pause')}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => act('open')}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => act('close')}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Select a campaign to act on it.</p>
            )}
          </Panel>
        </div>

        {msg || error ? (
          <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg || error}</p>
        ) : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
