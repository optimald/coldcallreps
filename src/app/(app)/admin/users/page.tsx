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

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
  minutesRemaining: number;
  totalPoints: number;
  repProfile?: { verified?: boolean; slug?: string | null } | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      overallScore: number;
      focusArea: string;
      duration: number;
      integrityFlags: string | null;
      user?: { displayName?: string | null } | null;
    }>
  >([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);

  async function loadUsers(query = q) {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (res.status === 403 || res.status === 401) {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;
    const d = await res.json();
    setUsers(d.users || []);
    if (Array.isArray(d.recentSessions)) setSessions(d.recentSessions);
  }

  useEffect(() => {
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
    if (res.ok) loadUsers();
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Users" description="Superadmin required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Search accounts, adjust role and minutes, verify reps."
      />
      <AdminSubNav />

      <Panel
        title="Directory"
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
                  onClick={() =>
                    patchUser(u.id, { minutesRemaining: u.minutesRemaining + 20 })
                  }
                >
                  +20 min
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patchUser(u.id, { verified: !u.repProfile?.verified })
                  }
                >
                  {u.repProfile?.verified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {sessions.length > 0 ? (
        <Panel title="Recent practice sessions">
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
        </Panel>
      ) : null}

      {msg ? (
        <p className={msg === 'Updated.' ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
