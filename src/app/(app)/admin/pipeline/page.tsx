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

type Job = {
  id: string;
  status: string;
  query: string;
  location: string;
  errorMessage: string | null;
  brandName: string;
  brandId: string;
  brandSlug?: string | null;
  savedCount: number;
  readyCount: number;
  createdAt: string;
};

type Data = {
  kpis: {
    failedJobs: number;
    runningJobs: number;
    queuedJobs: number;
    scrapeFailed: number;
    webScanFailed: number;
    outreachReady: number;
  };
  jobs: Job[];
  creditMoves: Array<{
    id: string;
    type: string;
    amount: number;
    brandName: string;
    brandId: string;
    note: string | null;
    createdAt: string;
  }>;
  brandsHot: Array<{
    id: string;
    name: string;
    slug?: string | null;
    leadPlan: string;
    remaining: number;
    leadCreditsUsedPeriod: number;
  }>;
};

function brandHref(brandId: string, brandSlug?: string | null) {
  return `/brands/${brandSlug || brandId}`;
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'failed') return 'admin-job-status admin-job-status--fail';
  if (s === 'running') return 'admin-job-status admin-job-status--run';
  if (s === 'queued') return 'admin-job-status admin-job-status--queued';
  return 'admin-job-status admin-job-status--ok';
}

function suggestedRefundReason(job: Job) {
  const err = job.errorMessage?.replace(/^\[acked\]\s*/i, '').trim();
  if (err) return `Bad batch refund: ${err}`.slice(0, 240);
  return `Bad batch refund for ${job.query} @ ${job.location}`.slice(0, 240);
}

export default function AdminPipelinePage() {
  const { data, forbidden, reload, error, isDemo, demoMsg } =
    useAdminFetch<Data>('/api/admin/pipeline');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [credits, setCredits] = useState('25');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const jobs = data?.jobs || [];
  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    if (selectedJobId && !jobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(null);
    }
  }, [jobs, selectedJobId]);

  function selectJobForRefund(job: Job) {
    setSelectedJobId(job.id);
    setReason(suggestedRefundReason(job));
    setMsg('');
  }

  function clearSelection() {
    setSelectedJobId(null);
    setReason('');
    setMsg('');
  }

  async function refundCredits() {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    if (!selected) {
      setMsg('Select a job first.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: selected.brandId,
        jobId: selected.id,
        credits: Number(credits),
        reason,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Credits refunded.' : d.error || 'Failed');
    if (res.ok) {
      clearSelection();
      reload();
    }
  }

  return (
    <AdminGate title="Pipeline" forbidden={forbidden}>
      <AdminPageChrome
        title="Lead pipeline"
        description="Scrape → enrich job health, credit burn, and bad-batch refunds."
      >
        {data?.kpis ? (
          <StatGrid>
            <Stat label="Failed jobs" value={data.kpis.failedJobs} tone="warn" />
            <Stat label="Running" value={data.kpis.runningJobs} />
            <Stat label="Queued" value={data.kpis.queuedJobs} />
            <Stat label="Scrape fails" value={data.kpis.scrapeFailed} />
            <Stat label="Dial-ready" value={data.kpis.outreachReady} tone="good" />
          </StatGrid>
        ) : null}

        <div className="admin-split admin-split--pipeline">
          <Panel
            title="Jobs"
            description="Select a failed job to grant pack credits for a bad batch."
          >
            {jobs.length === 0 ? (
              <EmptyState
                title="No recent jobs"
                description="Pipeline jobs will show up here."
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Brand</th>
                      <th>Query / location</th>
                      <th>Saved / ready</th>
                      <th>Error</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => {
                      const isFailed = j.status.toLowerCase() === 'failed';
                      const isActive = selectedJobId === j.id;
                      return (
                        <tr
                          key={j.id}
                          className={[
                            isFailed ? 'admin-table__row--selectable' : '',
                            isFailed && isActive ? 'is-active' : '',
                            isFailed ? 'admin-table__row--risk' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          tabIndex={isFailed ? 0 : undefined}
                          aria-selected={isFailed ? isActive : undefined}
                          onClick={() => {
                            if (isFailed) selectJobForRefund(j);
                          }}
                          onKeyDown={(e) => {
                            if (!isFailed) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectJobForRefund(j);
                            }
                          }}
                        >
                          <td>
                            <span className={statusClass(j.status)}>{j.status}</span>
                          </td>
                          <td>
                            <Link
                              className="admin-table__brand"
                              href={brandHref(j.brandId, j.brandSlug)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {j.brandName}
                            </Link>
                          </td>
                          <td>
                            <div>{j.query || '—'}</div>
                            <div className="muted" style={{ fontSize: '0.78rem' }}>
                              {j.location || '—'}
                            </div>
                          </td>
                          <td>
                            {j.savedCount}/{j.readyCount}
                          </td>
                          <td className="admin-job-error">
                            {j.errorMessage || '—'}
                          </td>
                          <td>
                            <div className="admin-job-actions">
                              {isFailed ? (
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectJobForRefund(j);
                                  }}
                                >
                                  Refund credits
                                </button>
                              ) : null}
                              <Link
                                className="btn-ghost"
                                href={brandHref(j.brandId, j.brandSlug)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open brand
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            compact
            title="Grant pack credits"
            description="Bound to the selected failed job — no Brand ID typing."
            actions={
              selected ? (
                <button type="button" className="btn-ghost" onClick={clearSelection}>
                  Clear
                </button>
              ) : null
            }
          >
            {selected ? (
              <div className="stack">
                <p style={{ marginTop: 0 }}>
                  <strong>{selected.brandName}</strong>
                  <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
                    Job {selected.status} · {selected.query} @ {selected.location}
                  </span>
                </p>
                {selected.errorMessage ? (
                  <p className="admin-job-detail-error">{selected.errorMessage}</p>
                ) : (
                  <p className="muted" style={{ marginTop: 0 }}>
                    No error message on this job.
                  </p>
                )}
                <label className="admin-field">
                  Credits to grant
                  <input
                    className="field"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    inputMode="numeric"
                    style={{ maxWidth: 120 }}
                  />
                </label>
                <label className="admin-field">
                  Reason (audit-logged)
                  <textarea
                    className="field"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why this batch deserves a credit grant"
                  />
                </label>
                <div className="admin-review__actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={refundCredits}
                  >
                    Grant pack credits
                  </button>
                  <Link
                    className="btn-ghost"
                    href={brandHref(selected.brandId, selected.brandSlug)}
                  >
                    Open brand
                  </Link>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                Select a failed job from the table (or click Refund credits) to grant pack
                credits for that brand.
              </p>
            )}
          </Panel>
        </div>

        <div className="admin-split">
          <Panel title="Credit ledger">
            {(data?.creditMoves || []).length === 0 ? (
              <p className="muted" style={{ marginTop: 0 }}>
                No recent credit moves.
              </p>
            ) : (
              <ul className="list-quiet">
                {(data?.creditMoves || []).map((m) => (
                  <li key={m.id}>
                    {m.type} {m.amount > 0 ? '+' : ''}
                    {m.amount} · {m.brandName} · {m.note || '—'}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Hottest credit burners">
            {(data?.brandsHot || []).length === 0 ? (
              <p className="muted" style={{ marginTop: 0 }}>
                No brands burning credits yet.
              </p>
            ) : (
              <ul className="list-quiet">
                {(data?.brandsHot || []).map((b) => (
                  <li key={b.id}>
                    <Link href={brandHref(b.id, b.slug)}>{b.name}</Link> · {b.leadPlan} ·
                    used {b.leadCreditsUsedPeriod} · rem {b.remaining}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {msg || error ? (
          <p className={msg.includes('refunded') ? 'msg-ok' : 'msg-err'}>{msg || error}</p>
        ) : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
