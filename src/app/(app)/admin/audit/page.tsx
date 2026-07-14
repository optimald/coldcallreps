'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { adminGetJson } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';

type AuditRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metaJSON: string;
  createdAt: string;
  actorEmail: string;
  actorName: string | null;
  actorId: string | null;
};

type MetaLine = { key: string; label: string; value: string };

const ACTION_LABELS: Record<string, string> = {
  USER_SUSPEND: 'User suspended',
  USER_UNSUSPEND: 'User unsuspended',
  USER_BAN: 'User banned',
  USER_UNBAN: 'User unbanned',
  USER_VIEW: 'User viewed',
  PAYOUT_HOLD: 'Payout held',
  PAYOUT_RELEASE: 'Payout released',
  CAMPAIGN_PAUSE: 'Campaign paused',
  CAMPAIGN_RESUME: 'Campaign resumed',
};

function softActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const parts = action.split(/[._]+/).filter(Boolean);
  if (!parts.length) return action;
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPrimitive(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || null;
  }
  return null;
}

/** Parse metaJSON into a primary reason/note plus labeled short lines (no JSON dump). */
function parseMetaSummary(raw: string | null | undefined): {
  primary: string | null;
  lines: MetaLine[];
} {
  if (!raw?.trim()) return { primary: null, lines: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const t = raw.trim();
    return t ? { primary: t, lines: [] } : { primary: null, lines: [] };
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const fallback = formatPrimitive(parsed);
    return fallback
      ? { primary: fallback, lines: [] }
      : { primary: null, lines: [] };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Object.keys(obj).length) return { primary: null, lines: [] };

  const used = new Set<string>();
  // Prefer reason / note as plain primary text; skip them as labeled lines.
  const primary =
    formatPrimitive(obj.reason) ??
    formatPrimitive(obj.note) ??
    formatPrimitive(obj.notes) ??
    null;
  if (primary) {
    used.add('reason');
    used.add('note');
    used.add('notes');
  }

  const lines: MetaLine[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (used.has(key)) continue;
    if (Array.isArray(value)) {
      const parts = value
        .map((v) => formatPrimitive(v))
        .filter((v): v is string => Boolean(v));
      if (parts.length) {
        lines.push({ key, label: humanizeKey(key), value: parts.join('; ') });
      }
      continue;
    }
    if (value && typeof value === 'object') continue;
    const prim = formatPrimitive(value);
    if (prim) lines.push({ key, label: humanizeKey(key), value: prim });
  }

  return { primary, lines };
}

function MetaSummary({ metaJSON }: { metaJSON: string }) {
  const { primary, lines } = parseMetaSummary(metaJSON);
  if (!primary && !lines.length) {
    return <span className="muted">—</span>;
  }
  return (
    <div className="admin-audit__meta">
      {primary ? <p className="admin-audit__meta-primary">{primary}</p> : null}
      {lines.map((l) => (
        <div key={l.key} className="admin-audit__meta-line">
          <span className="admin-audit__meta-key">{l.label}:</span> {l.value}
        </div>
      ))}
    </div>
  );
}

/** True when targetId is worth linking as a user profile id. */
function looksLikeUserId(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  if (t.startsWith('demo-admin-user-')) return true;
  if (t.startsWith('user_')) return true;
  if (/^[a-z][a-z0-9]{20,}$/i.test(t)) return true;
  return t.length >= 8 && !t.includes('@') && !/\s/.test(t);
}

function TargetCell({
  targetType,
  targetId,
}: {
  targetType: string | null;
  targetId: string | null;
}) {
  const linkUser =
    targetType === 'UserProfile' && targetId && looksLikeUserId(targetId);

  return (
    <td>
      {targetType || '—'}
      {targetId ? (
        <>
          <br />
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            {linkUser ? (
              <Link href={`/admin/users/${targetId}`}>{targetId}</Link>
            ) : (
              targetId
            )}
          </span>
        </>
      ) : null}
    </td>
  );
}

export default function AdminAuditPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (action.trim()) params.set('action', action.trim());
    const res = await adminGetJson<{ audits: AuditRow[] }>(
      `/api/admin/audit?${params}`,
      isDemo
    );
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;
    setAudits(res.data?.audits || []);
  }

  useEffect(() => {
    if (!hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, hydrated]);

  function exportCsv() {
    const header = ['createdAt', 'action', 'actorEmail', 'targetType', 'targetId', 'metaJSON'];
    const lines = [
      header.join(','),
      ...audits.map((a) =>
        [
          a.createdAt,
          a.action,
          a.actorEmail,
          a.targetType || '',
          a.targetId || '',
          JSON.stringify(a.metaJSON).replace(/"/g, '""'),
        ]
          .map((c) => `"${c}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccr-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Audit" description="Audit access required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        description="Every admin action — suspend, ban, credits, payout holds, impersonation."
        actions={
          <button type="button" className="btn-ghost" onClick={exportCsv}>
            Export CSV
          </button>
        }
      />
      <Panel title="Search">
        <div className="search-row">
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Actor, target, action…"
          />
          <input
            className="field"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action contains…"
            style={{ maxWidth: 200 }}
            title="Matches raw action codes (e.g. USER_SUSPEND)"
          />
          <button type="button" className="btn" onClick={() => load()}>
            Search
          </button>
        </div>
      </Panel>

      <Panel title="Events">
        {audits.length === 0 ? (
          <EmptyState title="No events" description="Try a broader search." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className="admin-audit__action" title={a.action}>
                        {softActionLabel(a.action)}
                      </span>
                    </td>
                    <td>
                      {a.actorId ? (
                        <Link href={`/admin/users/${a.actorId}`}>
                          {a.actorName || a.actorEmail}
                        </Link>
                      ) : (
                        a.actorEmail
                      )}
                    </td>
                    <TargetCell targetType={a.targetType} targetId={a.targetId} />
                    <td>
                      <MetaSummary metaJSON={a.metaJSON} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
