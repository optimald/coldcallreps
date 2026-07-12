'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

export default function AdminPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);

  async function loadOverview() {
    const res = await fetch('/api/admin/overview');
    if (res.status === 403 || res.status === 401) {
      setForbidden(true);
      return;
    }
    const d = await res.json();
    setStats(d.stats || null);
    setSessions(d.recentSessions || []);
    setAudits(d.audits || []);
  }

  async function loadUsers(query = q) {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (!res.ok) return;
    const d = await res.json();
    setUsers(d.users || []);
  }

  useEffect(() => {
    loadOverview();
    loadUsers('');
  }, []);

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch }),
    });
    const d = await res.json();
    setMsg(res.ok ? 'Updated.' : d.error);
    if (res.ok) {
      loadUsers();
      loadOverview();
    }
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Access"
          title="Admin"
          description="Superadmin required to open platform ops."
        />
        <Panel>
          <p className="muted" style={{ marginTop: 0 }}>
            Set <code>SUPERADMIN_EMAILS</code> to your email, or ask an existing superadmin to
            promote you in Settings → Role.
          </p>
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <SoftLink href="/dashboard">← Dashboard</SoftLink>
            <SoftLink href="/settings">Settings</SoftLink>
          </div>
        </Panel>
      </main>
    );
  }

  const toneFor = (key: string): 'good' | 'warn' | 'bad' | 'accent' | undefined => {
    if (key === 'flagged') return 'bad';
    if (key === 'verified') return 'good';
    if (key === 'users' || key === 'sessions') return 'accent';
    return undefined;
  };

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Platform"
        title="Superadmin"
        description="Users, verification, integrity flags, and audit trail."
      />

      {stats && (
        <StatGrid>
          {Object.entries(stats).map(([k, v]) => (
            <Stat key={k} label={k} value={v} tone={toneFor(k)} />
          ))}
        </StatGrid>
      )}

      <Panel
        title="Users"
        description="Search by email or name, then adjust role, minutes, or verification."
      >
        <div className="search-row">
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            placeholder="Search email / name"
          />
          <button type="button" className="btn" onClick={() => loadUsers()}>
            Search
          </button>
        </div>

        {users.length === 0 ? (
          <EmptyState title="No users found" description="Try a different search." />
        ) : (
          <div>
            {users.map((u) => (
              <div key={u.id} className="data-row">
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong>{u.displayName || '—'}</strong>{' '}
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {u.email}
                  </span>
                  <div className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                    {u.platformRole} · {u.minutesRemaining} min · {u.totalPoints} pts
                    {u.repProfile?.verified ? ' · verified' : ''}
                    {u.repProfile?.slug ? ` · /${u.repProfile.slug}` : ''}
                  </div>
                </div>
                <select
                  className="field"
                  value={u.platformRole}
                  onChange={(e) => patchUser(u.id, { platformRole: e.target.value })}
                  style={{ width: 'auto', minWidth: 130 }}
                >
                  {['REP', 'RECRUITER', 'BRAND', 'MANAGER', 'SUPERADMIN'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => patchUser(u.id, { minutesRemaining: u.minutesRemaining + 20 })}
                >
                  +20 min
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => patchUser(u.id, { verified: !u.repProfile?.verified })}
                >
                  {u.repProfile?.verified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.15rem',
        }}
      >
        <Panel title="Recent sessions">
          {sessions.length === 0 ? (
            <EmptyState title="No sessions yet" description="Trainer activity will land here." />
          ) : (
            <ul className="list-quiet">
              {sessions.map((s) => (
                <li key={s.id}>
                  {s.user?.displayName || 'Rep'} · {s.overallScore}/100 · {s.focusArea} ·{' '}
                  {s.duration}s
                  {s.integrityFlags ? ' · flagged' : ''}{' '}
                  <Link href={`/sessions/${s.id}`}>open</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Audit log">
          {audits.length === 0 ? (
            <EmptyState title="No audit events" description="Role changes and ops actions appear here." />
          ) : (
            <ul className="list-quiet">
              {audits.map((a) => (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleString()} · {a.actor?.email || 'system'} ·{' '}
                  {a.action} {a.targetId || ''}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {msg && <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg}</p>}
    </main>
  );
}
