'use client';

import { useEffect, useState } from 'react';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';

interface Row {
  rank: number;
  displayName: string;
  totalPoints: number;
  totalSessions: number;
  avgScore: number;
  streak: number;
  badges: string[];
  hiringBoard: boolean;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [focus, setFocus] = useState<string>('');
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period, limit: '25' });
    if (focus) params.set('focus', focus);
    fetch(`/api/trainer/leaderboard?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard || []))
      .finally(() => setLoading(false));
  }, [focus, period]);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Top Reps</h1>
      <p style={{ color: 'var(--muted)' }}>Weekly grind board. Climb it. Get noticed.</p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0 1.5rem' }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ background: 'var(--bg-elevated)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '0.5rem' }}
        >
          <option value="week">This week</option>
          <option value="all">All time</option>
        </select>
        <select
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          style={{ background: 'var(--bg-elevated)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '0.5rem' }}
        >
          <option value="">All scenarios</option>
          {(Object.entries(FOCUS_LABELS) as [FocusArea, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No sessions yet this period.</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.displayName}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.5rem 1fr auto',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: r.rank <= 3 ? 'var(--accent)' : 'var(--muted)' }}>
                #{r.rank}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {r.displayName}
                  {r.hiringBoard ? ' · hiring' : ''}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {r.totalSessions} sessions · avg {r.avgScore} · streak {r.streak}
                </div>
              </div>
              <strong>{r.totalPoints} pts</strong>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
