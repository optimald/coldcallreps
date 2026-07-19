'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import type { TrainerLeaderboardRow as Row } from '@/lib/trainer-leaderboard';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';

type LeaderboardPanelProps = {
  /** denser embed for dashboard */
  embedded?: boolean;
  /** ultra-compact for above-the-fold desk (top N, minimal chrome) */
  compact?: boolean;
  limit?: number;
  initialRows?: Row[];
  initialOrgId?: string | null;
};

export default function LeaderboardPanel({
  embedded = false,
  compact = false,
  limit,
  initialRows,
  initialOrgId,
}: LeaderboardPanelProps) {
  const resolvedLimit = limit ?? (compact ? 8 : embedded ? 12 : 25);
  const [rows, setRows] = useState<Row[]>(() => initialRows ?? []);
  const [focus, setFocus] = useState('');
  const [period, setPeriod] = useState('week');
  const [scope, setScope] = useState<'global' | 'org'>('global');
  const [orgId, setOrgId] = useState<string | null>(initialOrgId ?? null);
  const [loading, setLoading] = useState(initialRows === undefined);
  const skipInitialFetch = useRef(initialRows !== undefined);

  useEffect(() => {
    if (initialOrgId !== undefined) return;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.orgId) setOrgId(d.orgId);
      })
      .catch(() => {});
  }, [initialOrgId]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ period, limit: String(resolvedLimit) });
    if (focus) params.set('focus', focus);
    if (scope === 'org' && orgId) {
      params.set('scope', 'org');
      params.set('orgId', orgId);
    }
    fetch(`/api/trainer/leaderboard?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard || []))
      .finally(() => setLoading(false));
  }, [focus, period, scope, orgId, resolvedLimit]);

  const filters = !compact ? (
    <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: '0.85rem' }}>
      <select
        className="field"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        style={{ width: 'auto' }}
      >
        <option value="week">This week</option>
        <option value="all">All time</option>
      </select>
      <select
        className="field"
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        style={{ width: 'auto' }}
      >
        <option value="">All scenarios</option>
        {(Object.entries(FOCUS_LABELS) as [FocusArea, string][]).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {orgId && (
        <select
          className="field"
          value={scope}
          onChange={(e) => setScope(e.target.value as 'global' | 'org')}
          style={{ width: 'auto' }}
        >
          <option value="global">Global</option>
          <option value="org">My org</option>
        </select>
      )}
    </div>
  ) : (
    <div className="dash-board__filters">
      <select
        className="field field--sm"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        aria-label="Leaderboard period"
      >
        <option value="week">Week</option>
        <option value="all">All time</option>
      </select>
      {orgId && (
        <select
          className="field field--sm"
          value={scope}
          onChange={(e) => setScope(e.target.value as 'global' | 'org')}
          aria-label="Leaderboard scope"
        >
          <option value="global">Global</option>
          <option value="org">Org</option>
        </select>
      )}
    </div>
  );

  const list = loading ? (
    <p className="muted">Loading…</p>
  ) : rows.length === 0 ? (
    <EmptyState title="No sessions yet" description="No scores for this period." />
  ) : (
    <ol className={`stack${compact ? ' dash-board__list' : ''}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((r) => (
        <li
          key={r.userId}
          className={compact ? 'dash-board__row' : 'session-row'}
          style={compact ? undefined : { gridTemplateColumns: '2.5rem 1fr auto' }}
        >
          <span
            className={compact ? 'dash-board__rank' : undefined}
            style={
              compact
                ? undefined
                : {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    color: r.rank <= 3 ? 'var(--accent)' : 'var(--muted)',
                  }
            }
            data-top={r.rank <= 3 ? '1' : undefined}
          >
            #{r.rank}
          </span>
          <div className={compact ? 'dash-board__name-wrap' : undefined}>
            <div style={{ fontWeight: compact ? 600 : 650 }} className={compact ? 'dash-board__name' : undefined}>
              {r.displayName}
              {!compact && r.hiringBoard ? ' · hiring' : ''}
            </div>
            {!compact && (
              <div className="session-row__meta">
                {r.totalSessions} sessions · avg {r.avgScore} · streak {r.streak}
              </div>
            )}
          </div>
          <strong className={compact ? 'dash-board__pts' : undefined} style={{ fontFamily: 'var(--font-display)' }}>
            {compact ? r.totalPoints : `${r.totalPoints} pts`}
          </strong>
        </li>
      ))}
    </ol>
  );

  return (
    <div id="leaderboard" className={compact ? 'dash-board' : undefined}>
      <Panel
        compact={compact || embedded}
        title={compact ? 'Leaderboard' : embedded ? 'Leaderboard' : 'Top Reps'}
        description={
          compact ? (
            <span className="dash-board__desc">Weekly grind · top {resolvedLimit}</span>
          ) : (
            'Weekly grind board. Climb it. Get noticed.'
          )
        }
        actions={
          compact ? (
            <Link href="/leaderboard" className="btn-ghost btn--sm">
              Full board
            </Link>
          ) : undefined
        }
        className={compact ? 'dash-board__panel' : undefined}
      >
        {filters}
        {compact ? <div className="dash-board__scroll">{list}</div> : list}
      </Panel>
    </div>
  );
}
