'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatDuration,
  formatSessionDate,
  scoreColor,
} from '@/lib/trainer/session-utils';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';

export type PracticeCallRow = {
  id: string;
  userId: string;
  scenarioType: string;
  focusArea: string;
  difficulty?: string | null;
  overallScore: number;
  duration: number;
  createdAt: string;
  pointsEarned?: number;
  leadCompany?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  packId?: string | null;
  packName?: string | null;
  repName?: string | null;
  hasRecording?: boolean;
  clipId?: string | null;
  isFeatured?: boolean;
};

type FilterOption = { id: string; label: string };

type Props = {
  /** When set, lists practice sessions for this brand (manager view). */
  brandId?: string;
  /** Base path for session detail links. */
  detailBase?: string;
  /** Query string appended to detail links (e.g. from=brand&brand=slug). */
  detailQuery?: string;
  title?: string;
  description?: string;
  showRepFilter?: boolean;
  emptyHref?: string;
  emptyLabel?: string;
};

export default function PracticeCallsList({
  brandId,
  detailBase = '/sessions',
  detailQuery,
  title = 'Past calls',
  description = 'Scored practice sessions with stats, lead, scenario, and score.',
  showRepFilter = Boolean(brandId),
  emptyHref = '/practice',
  emptyLabel = 'Start practice →',
}: Props) {
  const [sessions, setSessions] = useState<PracticeCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repId, setRepId] = useState('');
  const [campaignKey, setCampaignKey] = useState('');
  const [reps, setReps] = useState<FilterOption[]>([]);
  const [campaigns, setCampaigns] = useState<FilterOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (brandId) params.set('brandId', brandId);
      const res = await fetch(`/api/trainer/sessions?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load past calls');
      const rows: PracticeCallRow[] = data.sessions || [];
      setSessions(rows);

      if (showRepFilter) {
        const byRep = new Map<string, string>();
        for (const row of rows) {
          if (row.userId && row.repName) byRep.set(row.userId, row.repName);
        }
        setReps(
          [...byRep.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      }

      const byCampaign = new Map<string, string>();
      for (const row of rows) {
        const key = row.brandId
          ? `brand:${row.brandId}`
          : row.focusArea
            ? `focus:${row.focusArea}`
            : '';
        if (!key) continue;
        const label =
          row.brandName ||
          (FOCUS_LABELS as Record<string, string>)[row.focusArea] ||
          row.focusArea ||
          'Practice';
        byCampaign.set(key, label);
      }
      setCampaigns(
        [...byCampaign.entries()]
          .map(([id, label]) => ({ id, label }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load past calls');
    } finally {
      setLoading(false);
    }
  }, [brandId, showRepFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return sessions.filter((row) => {
      if (repId && row.userId !== repId) return false;
      if (campaignKey) {
        const key = row.brandId
          ? `brand:${row.brandId}`
          : row.focusArea
            ? `focus:${row.focusArea}`
            : '';
        if (key !== campaignKey) return false;
      }
      return true;
    });
  }, [sessions, repId, campaignKey]);

  function detailHref(id: string) {
    const base = `${detailBase}/${id}`;
    return detailQuery ? `${base}?${detailQuery}` : base;
  }

  return (
    <div className="practice-calls">
      <div className="practice-calls__toolbar">
        <div>
          <h2 className="practice-calls__title">{title}</h2>
          {description ? <p className="practice-calls__desc muted">{description}</p> : null}
        </div>
        <div className="practice-calls__filters">
          {showRepFilter ? (
            <label className="practice-calls__filter">
              <span>Rep</span>
              <select value={repId} onChange={(e) => setRepId(e.target.value)}>
                <option value="">All reps</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="practice-calls__filter">
            <span>Campaign / scenario</span>
            <select value={campaignKey} onChange={(e) => setCampaignKey(e.target.value)}>
              <option value="">All</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="practice-calls__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Loading past calls…</p>
      ) : filtered.length === 0 ? (
        <div className="practice-calls__empty">
          <p className="muted">No scored practice calls yet.</p>
          {emptyHref ? (
            <Link href={emptyHref} className="btn">
              {emptyLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="practice-calls__list">
          {filtered.map((session) => {
            const focusLabel =
              (FOCUS_LABELS as Record<string, string>)[session.focusArea as FocusArea] ||
              session.focusArea;
            const campaignLabel = session.brandName || focusLabel;
            return (
              <li key={session.id}>
                <Link href={detailHref(session.id)} className="practice-calls__row">
                  <div className="practice-calls__main">
                    <div className="practice-calls__lead">
                      {session.leadCompany || 'General practice'}
                      {session.isFeatured ? (
                        <span className="practice-calls__badge">Resume</span>
                      ) : null}
                      {session.hasRecording ? (
                        <span className="practice-calls__badge practice-calls__badge--audio">
                          Audio
                        </span>
                      ) : null}
                    </div>
                    <div className="practice-calls__meta">
                      {formatSessionDate(session.createdAt)}
                      {' · '}
                      {formatDuration(session.duration)}
                      {session.difficulty ? ` · ${session.difficulty}` : ''}
                      {showRepFilter && session.repName ? ` · ${session.repName}` : ''}
                    </div>
                    <div className="practice-calls__campaign">{campaignLabel}</div>
                  </div>
                  <div className="practice-calls__stats">
                    <span
                      className="practice-calls__score"
                      style={{ color: scoreColor(session.overallScore) }}
                    >
                      {session.overallScore}/100
                    </span>
                    {typeof session.pointsEarned === 'number' ? (
                      <span className="muted">+{session.pointsEarned} pts</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
