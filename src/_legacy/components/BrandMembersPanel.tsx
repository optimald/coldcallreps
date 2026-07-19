'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type MemberRow = {
  id: string;
  role: string;
  createdAt?: string;
  user: { id: string; email: string | null; displayName: string | null };
};

type Owner = { id: string; email: string | null; displayName: string | null } | null;

/**
 * Brand multi-seat ACL UI — invite by email (user must already have an account).
 */
export default function BrandMembersPanel({ brandId }: { brandId: string }) {
  const [owner, setOwner] = useState<Owner>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('admin');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}/members`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Could not load members');
        return;
      }
      setOwner(data.owner || null);
      setMembers(data.members || []);
    } catch {
      setErr('Could not load members');
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Invite failed');
        return;
      }
      setMsg(`Added ${data.member?.user?.email || email} as ${role}.`);
      setEmail('');
      await load();
    } catch {
      setErr('Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/members?memberId=${encodeURIComponent(memberId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Remove failed');
        return;
      }
      setMsg('Member removed.');
      await load();
    } catch {
      setErr('Remove failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: '1.25rem' }}>
      <h3 style={{ marginTop: 0 }}>Brand team</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Invite teammates who already have a Cold Call Reps account. Admins can manage campaigns
        and leads; viewers are reserved for future read-only access.
      </p>
      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {owner ? (
            <li className="session-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                <strong>{owner.displayName || owner.email || 'Owner'}</strong>
                <span className="session-row__meta"> · Owner</span>
              </span>
            </li>
          ) : null}
          {members.map((m) => (
            <li
              key={m.id}
              className="session-row"
              style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}
            >
              <span>
                <strong>{m.user.displayName || m.user.email || 'Member'}</strong>
                <span className="session-row__meta">
                  {' '}
                  · {m.role}
                  {m.user.email ? ` · ${m.user.email}` : ''}
                </span>
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void removeMember(m.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {members.length === 0 ? (
            <li className="muted" style={{ listStyle: 'none' }}>
              No invited members yet.
            </li>
          ) : null}
        </ul>
      )}
      <form onSubmit={invite} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <input
          type="email"
          required
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit" className="btn" disabled={busy || !email.trim()}>
          {busy ? 'Saving…' : 'Invite'}
        </button>
      </form>
    </section>
  );
}
