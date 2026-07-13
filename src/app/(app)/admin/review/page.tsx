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
import type { AdminReviewQueue } from '@/lib/admin-platform-types';

type CallItem = AdminReviewQueue['calls'][number];
type ClaimItem = AdminReviewQueue['claims'][number];

export default function AdminReviewPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [selected, setSelected] = useState<
    { kind: 'call'; item: CallItem } | { kind: 'claim'; item: ClaimItem } | null
  >(null);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/review');
    if (res.status === 403 || res.status === 401) {
      setForbidden(true);
      return;
    }
    const d = await res.json();
    setCalls(d.calls || []);
    setClaims(d.claims || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(
    kind: 'call' | 'claim',
    id: string,
    action: 'clear' | 'approve' | 'reject'
  ) {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, action }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || 'Resolve failed');
      return;
    }
    setCalls(d.calls || []);
    setClaims(d.claims || []);
    setSelected(null);
    setMsg('Resolved.');
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Review" description="Superadmin required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  const auditPretty = (() => {
    if (!selected) return null;
    const raw =
      selected.kind === 'call'
        ? selected.item.aiAuditResult
        : selected.item.auditJSON;
    if (!raw) return null;
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  })();

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Review queue"
        description="AI audit failures and calls flagged for human referee. Approve overrides or clear the flag."
      />
      <AdminSubNav reviewBadge={calls.length} />

      <div className="admin-review">
        <Panel
          compact
          title="Queue"
          description={`${calls.length} calls · ${claims.length} failed claims`}
        >
          {calls.length === 0 && claims.length === 0 ? (
            <EmptyState
              title="Queue clear"
              description="No manual reviews pending."
            />
          ) : (
            <ul className="admin-review__list">
              {calls.map((c) => (
                <li key={`call-${c.id}`}>
                  <button
                    type="button"
                    className={`admin-review__item${
                      selected?.kind === 'call' && selected.item.id === c.id
                        ? ' is-active'
                        : ''
                    }`}
                    onClick={() => setSelected({ kind: 'call', item: c })}
                  >
                    <strong>Call</strong> · {c.companyName || 'Lead'} ·{' '}
                    {c.repName}
                    <span className="muted">
                      {' '}
                      · {c.brandName || '—'} ·{' '}
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
              {claims.map((c) => (
                <li key={`claim-${c.id}`}>
                  <button
                    type="button"
                    className={`admin-review__item${
                      selected?.kind === 'claim' && selected.item.id === c.id
                        ? ' is-active'
                        : ''
                    }`}
                    onClick={() => setSelected({ kind: 'claim', item: c })}
                  >
                    <strong>Claim</strong> · {c.prospectName || 'Meeting'} ·{' '}
                    {c.repName}
                    <span className="muted">
                      {' '}
                      · {c.brandName} · score {c.auditScore ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel compact title="Detail" description="Recording, transcript, audit JSON">
          {!selected ? (
            <EmptyState
              title="Select an item"
              description="Open a call or failed claim from the queue."
            />
          ) : selected.kind === 'call' ? (
            <div className="admin-review__detail">
              <p style={{ marginTop: 0 }}>
                <strong>{selected.item.companyName || 'Lead'}</strong>
                {' · '}
                {selected.item.repName} ({selected.item.repEmail})
              </p>
              <p className="muted">
                {selected.item.brandName || 'No brand'} · {selected.item.status} ·{' '}
                {selected.item.outcome || '—'} ·{' '}
                {selected.item.durationSec != null
                  ? `${selected.item.durationSec}s`
                  : '—'}
              </p>
              {selected.item.brandKey ? (
                <p>
                  <Link href={`/brands/${selected.item.brandKey}/calls`}>
                    Open brand calls →
                  </Link>
                </p>
              ) : null}
              {selected.item.recordingUrl ? (
                <audio controls src={selected.item.recordingUrl} style={{ width: '100%' }} />
              ) : (
                <p className="muted">No recording URL.</p>
              )}
              {selected.item.transcript ? (
                <pre className="admin-review__pre">{selected.item.transcript}</pre>
              ) : null}
              {auditPretty ? (
                <pre className="admin-review__pre admin-review__pre--json">
                  {auditPretty}
                </pre>
              ) : null}
              <div className="admin-review__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => resolve('call', selected.item.id, 'clear')}
                >
                  Clear review flag
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-review__detail">
              <p style={{ marginTop: 0 }}>
                <strong>{selected.item.prospectName || 'Appointment'}</strong>
                {' · '}
                {selected.item.campaignTitle}
              </p>
              <p className="muted">
                {selected.item.brandName} · {selected.item.repName} ·{' '}
                {selected.item.failureReason || 'Audit failed'}
              </p>
              <p>
                <Link href={`/brands/${selected.item.brandKey}/campaigns`}>
                  Open brand campaigns →
                </Link>
              </p>
              {selected.item.notes ? (
                <p>
                  <strong>Notes</strong>
                  <br />
                  {selected.item.notes}
                </p>
              ) : null}
              {selected.item.transcriptSnippet ? (
                <pre className="admin-review__pre">
                  {selected.item.transcriptSnippet}
                </pre>
              ) : null}
              {auditPretty ? (
                <pre className="admin-review__pre admin-review__pre--json">
                  {auditPretty}
                </pre>
              ) : null}
              <div className="admin-review__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => resolve('claim', selected.item.id, 'approve')}
                >
                  Approve claim (override)
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => resolve('claim', selected.item.id, 'reject')}
                >
                  Confirm reject
                </button>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem' }}>
                Approve marks the claim PASSED and clears the linked call review.
                Escrow release / Connect transfer still runs through the normal
                payout path when applicable.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {msg ? (
        <p className={msg === 'Resolved.' ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
