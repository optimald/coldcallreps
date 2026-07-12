'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [loadError, setLoadError] = useState('');

  async function load() {
    setLoadError('');
    try {
      const [tRes, meRes] = await Promise.all([fetch('/api/tournaments'), fetch('/api/me')]);
      if (!tRes.ok) {
        const d = await tRes.json().catch(() => ({}));
        setLoadError(d.error || 'Could not load tournaments.');
      } else {
        const d = await tRes.json();
        setTournaments(d.tournaments || []);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.platformRole || 'REP';
        // Mirror canCreateTournament from src/lib/roles.ts
        setCanCreate(role === 'MANAGER' || role === 'SUPERADMIN' || role === 'BRAND');
      }
    } catch {
      setLoadError('Could not load tournaments. Try again.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function join(id: string) {
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: id }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? 'Entered with season pass — scores sync from matching practice sessions.'
        : data.error
    );
    if (res.ok) load();
  }

  async function create() {
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, focusArea: focusArea || undefined }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Tournament created.' : data.error);
    if (res.ok) {
      setName('');
      load();
    }
  }

  return (
    <main className="app-page">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Tournaments</h1>
      <p style={{ color: 'var(--muted)' }}>
        Live seasons — enter, then grind. Points from matching practice sessions update your entry score.
      </p>
      {loadError && <p style={{ color: 'var(--bad)' }}>{loadError}</p>}

      {canCreate ? (
        <div
          style={{
            padding: '1rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <strong>Create tournament</strong>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            style={input}
          />
          <input
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="Focus area filter (optional, e.g. budget_500)"
            style={input}
          />
          <button type="button" onClick={create} className="btn">
            Create
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Creating tournaments requires Manager, Brand, or Superadmin.{' '}
          <Link href="/settings" style={{ color: 'var(--accent)' }}>
            Switch role in Settings
          </Link>
        </p>
      )}

      {tournaments.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No active tournaments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {tournaments.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <strong>{t.name}</strong>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                {t._count?.entries || 0} entries
                {t.focusArea ? ` · focus ${t.focusArea}` : ''}
              </div>
              {(t.entries || []).length > 0 && (
                <ol style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                  {t.entries.map((e: any) => (
                    <li key={e.id}>
                      {e.user?.displayName || 'Rep'} — {e.score} pts
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" onClick={() => join(t.id)} className="btn" style={{ marginTop: '0.5rem' }}>
                Enter
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p style={{ color: 'var(--accent-2)' }}>{msg}</p>}
    </main>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
};
