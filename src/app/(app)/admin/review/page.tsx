'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { adminGetJson, ADMIN_DEMO_MSG } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';
import type { AdminReviewQueue } from '@/lib/admin-platform-types';

type CallItem = AdminReviewQueue['calls'][number];
type ClaimItem = AdminReviewQueue['claims'][number];

type AuditField = { label: string; value: string };

const AUDIT_LABELS: Record<string, string> = {
  score: 'Score',
  confidence: 'Score',
  reason: 'Reason',
  reasoning: 'Reason',
  failureReason: 'Failure reason',
  fail: 'Failure',
  passed: 'Passed',
  isLegitAppointment: 'Legitimate appointment',
  reasons: 'Reasons',
  bant: 'BANT',
};

const SKIP_AUDIT_KEYS = new Set(['raw', 'rawResponse', 'raw_response']);

function humanizeKey(key: string): string {
  return (
    AUDIT_LABELS[key] ||
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatAuditPrimitive(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || null;
  }
  return null;
}

function formatBant(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parts = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      if (typeof v !== 'boolean') return null;
      return `${humanizeKey(k)}: ${v ? 'Yes' : 'No'}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Parse aiAuditResult / auditJSON into labeled rows (no raw JSON dump). */
function parseAuditSummary(raw: string | null | undefined): AuditField[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ label: 'Audit notes', value: raw.trim() }];
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const fallback = formatAuditPrimitive(parsed);
    return fallback ? [{ label: 'Audit', value: fallback }] : [];
  }

  const obj = parsed as Record<string, unknown>;
  const fields: AuditField[] = [];
  const used = new Set<string>();

  const push = (key: string, label: string, value: string | null) => {
    if (!value || used.has(key)) return;
    used.add(key);
    fields.push({ label, value });
  };

  const score =
    formatAuditPrimitive(obj.score) ?? formatAuditPrimitive(obj.confidence);
  if (score != null) {
    push('score', 'Score', score);
    used.add('confidence');
  }

  const reason =
    formatAuditPrimitive(obj.reason) ??
    formatAuditPrimitive(obj.reasoning) ??
    formatAuditPrimitive(obj.failureReason);
  if (reason) {
    push('reason', 'Reason', reason);
    used.add('reasoning');
    used.add('failureReason');
  }

  if (Array.isArray(obj.reasons)) {
    const lines = obj.reasons
      .map((r) => formatAuditPrimitive(r))
      .filter((r): r is string => Boolean(r));
    if (lines.length) {
      push('reasons', 'Reasons', lines.join('; '));
    } else {
      used.add('reasons');
    }
  }

  const fail = formatAuditPrimitive(obj.fail);
  if (fail) push('fail', 'Failure', fail.replace(/_/g, ' '));

  for (const key of ['passed', 'isLegitAppointment'] as const) {
    const v = formatAuditPrimitive(obj[key]);
    if (v) push(key, humanizeKey(key), v);
  }

  const bant = formatBant(obj.bant);
  if (bant) push('bant', 'BANT', bant);

  for (const [key, value] of Object.entries(obj)) {
    if (used.has(key) || SKIP_AUDIT_KEYS.has(key)) continue;
    if (key === 'bant') continue;
    if (Array.isArray(value)) {
      const lines = value
        .map((r) => formatAuditPrimitive(r))
        .filter((r): r is string => Boolean(r));
      if (lines.length) push(key, humanizeKey(key), lines.join('; '));
      continue;
    }
    if (value && typeof value === 'object') {
      // Skip nested blobs (e.g. raw LLM payloads) — keep summary flat.
      continue;
    }
    const prim = formatAuditPrimitive(value);
    if (prim) push(key, humanizeKey(key), prim);
  }

  return fields;
}

function AuditSummary({ raw }: { raw: string | null | undefined }) {
  const fields = parseAuditSummary(raw);
  if (!fields.length) return null;
  return (
    <dl className="admin-review__audit">
      {fields.map((f) => (
        <div key={f.label} className="admin-review__audit-row">
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminReviewPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [selected, setSelected] = useState<
    { kind: 'call'; item: CallItem } | { kind: 'claim'; item: ClaimItem } | null
  >(null);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const res = await adminGetJson<{ calls: CallItem[]; claims: ClaimItem[] }>(
      '/api/admin/review',
      isDemo
    );
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;
    setCalls(res.data?.calls || []);
    setClaims(res.data?.claims || []);
  }

  useEffect(() => {
    if (!hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, hydrated]);

  async function resolve(
    kind: 'call' | 'claim',
    id: string,
    action: 'clear' | 'approve' | 'reject'
  ) {
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }
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

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Review queue"
        description="AI audit failures and calls flagged for human referee. Approve overrides or clear the flag."
      />
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

        <Panel
          compact
          title="Detail"
          description="Recording, transcript, and audit summary"
        >
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
                <div className="admin-review__block">
                  <p className="admin-review__block-label">Transcript</p>
                  <pre className="admin-review__pre">{selected.item.transcript}</pre>
                </div>
              ) : null}
              <AuditSummary raw={selected.item.aiAuditResult} />
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
                <div className="admin-review__block">
                  <p className="admin-review__block-label">Transcript</p>
                  <pre className="admin-review__pre">
                    {selected.item.transcriptSnippet}
                  </pre>
                </div>
              ) : null}
              <AuditSummary raw={selected.item.auditJSON} />
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
                Approve marks the claim PASSED, clears the linked call review,
                and auto-releases escrow / Connect payout.
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
