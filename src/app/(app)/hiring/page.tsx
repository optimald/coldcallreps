'use client';

import { useEffect, useState } from 'react';

interface Profile {
  id: string;
  displayName: string | null;
  hiringHeadline: string | null;
  hiringBio: string | null;
  totalPoints: number;
  currentStreak: number;
  badges: string;
}

export default function HiringPage() {
  const [optIn, setOptIn] = useState(false);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [board, setBoard] = useState<Profile[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const [me, lb] = await Promise.all([
      fetch('/api/referrals').then((r) => r.json()).catch(() => ({})),
      fetch('/api/trainer/leaderboard?period=all&limit=50').then((r) => r.json()),
    ]);
    void me;
    const hiring = (lb.leaderboard || []).filter((r: any) => r.hiringBoard);
    setBoard(
      hiring.map((r: any) => ({
        id: r.userId,
        displayName: r.displayName,
        hiringHeadline: null,
        hiringBio: null,
        totalPoints: r.totalPoints,
        currentStreak: r.streak,
        badges: JSON.stringify(r.badges || []),
      }))
    );
  }

  useEffect(() => {
    load();
    fetch('/api/hiring', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOptIn(Boolean(d.hiringBoardOptIn));
        setHeadline(d.hiringHeadline || '');
        setBio(d.hiringBio || '');
      })
      .catch(() => {});
  }, []);

  async function save() {
    const res = await fetch('/api/hiring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optIn, headline, bio }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Saved.' : data.error || 'Failed');
    load();
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Hiring Board</h1>
      <p style={{ color: 'var(--muted)' }}>
        Top performers can opt in so recruiters and companies can find hungry outbound talent.
      </p>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '1.15rem',
          margin: '1.25rem 0',
        }}
      >
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          Make my profile visible on the hiring board
        </label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline — e.g. SDR crushing gatekeeper calls"
          style={{
            width: '100%',
            marginBottom: '0.5rem',
            padding: '0.6rem',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
          }}
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio for recruiters"
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
          }}
        />
        <button
          type="button"
          onClick={save}
          style={{
            marginTop: '0.75rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.6rem 1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
        {msg && <p style={{ color: 'var(--accent-2)', fontSize: '0.9rem' }}>{msg}</p>}
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Open profiles</h2>
      {board.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No public profiles yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {board.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <strong>{p.displayName || 'Rep'}</strong>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                {p.totalPoints} pts · streak {p.currentStreak}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
