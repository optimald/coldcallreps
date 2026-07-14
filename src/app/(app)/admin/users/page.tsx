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

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
  opsRole?: string | null;
  accountStatus?: string;
  statusReason?: string | null;
  minutesRemaining: number;
  totalPoints: number;
  plan?: string;
  stripeConnectPayoutsEnabled?: boolean;
  repProfile?: { verified?: boolean; slug?: string | null } | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function loadUsers(query = q) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status !== 'ALL') params.set('status', status);
    if (role !== 'ALL') params.set('role', role);
    const res = await adminGetJson<{ users: AdminUser[] }>(`/api/admin/users?${params}`, isDemo);
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok) {
      setMsg(res.error || 'Failed to load users');
      return;
    }
    setUsers(res.data?.users || []);
  }

  useEffect(() => {
    if (!hydrated) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role, isDemo, hydrated]);

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Users" description="Ops access required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Search SDRs and brands — open a record to suspend, adjust credits, or impersonate."
      />
      <Panel
        title="Directory"
        description="Filter by status and role. Click a row for the full ops dossier."
      >
        <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            placeholder="Email, name, handle, Stripe ID…"
          />
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 'auto' }}
          >
            {['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: 'auto' }}
          >
            {['ALL', 'REP', 'BRAND', 'RECRUITER', 'MANAGER', 'SUPERADMIN'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => loadUsers()}>
            Search
          </button>
        </div>

        {users.length === 0 ? (
          <EmptyState title="No users" description="Try a different filter." />
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Minutes</th>
                  <th>Connect</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="admin-table__brand">
                        <strong>{u.displayName || '—'}</strong>
                      </Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {u.email}
                        {u.repProfile?.slug ? ` · /${u.repProfile.slug}` : ''}
                      </div>
                    </td>
                    <td>
                      {u.platformRole}
                      {u.opsRole ? (
                        <div className="muted" style={{ fontSize: '0.75rem' }}>
                          ops:{u.opsRole}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={
                          u.accountStatus === 'BANNED'
                            ? 'admin-risk admin-risk--high'
                            : u.accountStatus === 'SUSPENDED'
                              ? 'admin-risk admin-risk--mid'
                              : undefined
                        }
                      >
                        {u.accountStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td>{u.minutesRemaining}</td>
                    <td>{u.stripeConnectPayoutsEnabled ? 'Ready' : '—'}</td>
                    <td>
                      <SoftLink href={`/admin/users/${u.id}`}>Open →</SoftLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {msg ? <p className="msg-err">{msg}</p> : null}
    </main>
  );
}
