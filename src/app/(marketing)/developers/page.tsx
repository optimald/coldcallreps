'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DevelopersPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  async function load() {
    const [keysRes, meRes] = await Promise.all([fetch('/api/keys'), fetch('/api/me')]);
    if (keysRes.status === 401) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const data = await keysRes.json();
    setKeys(data.keys || []);
    if (meRes.ok) {
      const me = await meRes.json();
      setPlan(me.plan || 'STARTER');
      // Mirror canUseApiKeys from src/lib/plans.ts
      const role = me.platformRole || 'REP';
      setCanCreate(
        role === 'SUPERADMIN' ||
          role === 'RECRUITER' ||
          me.plan === 'RECRUITER' ||
          me.plan === 'PRO' ||
          me.plan === 'TEAM'
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    if (!canCreate) return;
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Default' }),
    });
    const data = await res.json();
    if (res.ok) {
      setSecret(data.secret);
      setMsg(data.notice);
      load();
    } else setMsg(data.error);
  }

  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Developers</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Public API for leaderboards and rep profiles. Authenticate with{' '}
        <code style={{ color: 'var(--accent-2)' }}>Authorization: Bearer ccr_…</code>
      </p>

      <h2 style={{ fontSize: '1.15rem' }}>Endpoints</h2>
      <ul style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        <li>
          <code>GET /api/v1/leaderboard</code> — top reps snapshot
        </li>
        <li>
          <code>GET /api/v1/profiles/:slug</code> — public rep profile
        </li>
        <li>
          <code>GET /api/v1/sessions?slug=</code> — session aggregates (integrity-aware)
        </li>
      </ul>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Webhooks: create endpoints via <code>POST /api/webhooks</code> for{' '}
        <code>session.scored</code>, <code>bounty.cleared</code>,{' '}
        <code>application.submitted</code>. Signed with <code>X-CCR-Signature</code>.
      </p>

      <h2 style={{ fontSize: '1.15rem' }}>API keys</h2>
      {!signedIn ? (
        <p style={{ color: 'var(--muted)' }}>
          <Link href="/sign-in" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>{' '}
          to create keys.
        </p>
      ) : !canCreate ? (
        <p style={{ color: 'var(--muted)' }}>
          API keys require Recruiter role (free desk), Org plan, or Superadmin
          {plan ? ` (you’re on ${plan})` : ''}.{' '}
          <Link href="/billing" style={{ color: 'var(--accent)' }}>
            Upgrade
          </Link>
        </p>
      ) : (
        <>
          <button type="button" onClick={createKey} className="btn">
            Create API key
          </button>
          {secret && (
            <pre
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                overflow: 'auto',
              }}
            >
              {secret}
            </pre>
          )}
          <ul style={{ marginTop: '1rem', color: 'var(--muted)' }}>
            {keys.map((k) => (
              <li key={k.id}>
                {k.name} · {k.keyPrefix}…{' '}
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/keys?id=${k.id}`, { method: 'DELETE' });
                    const data = await res.json();
                    setMsg(res.ok ? 'Key revoked.' : data.error);
                    load();
                  }}
                  style={{
                    marginLeft: '0.35rem',
                    background: 'transparent',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '0.15rem 0.45rem',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {msg && <p style={{ color: 'var(--accent-2)' }}>{msg}</p>}
    </main>
  );
}
