'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  billablePracticeMinutes,
  formatDisposition,
  formatDuration,
  formatSessionDate,
  formatUsdCents,
  scoreColor,
} from '@/lib/trainer/session-utils';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';

export type PracticeCallRow = {
  id: string;
  kind?: 'training' | 'campaign';
  userId: string;
  scenarioType: string;
  focusArea: string;
  difficulty?: string | null;
  overallScore: number | null;
  duration: number;
  minutesCharged?: number | null;
  createdAt: string;
  pointsEarned?: number;
  leadCompany?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  packId?: string | null;
  packName?: string | null;
  campaignTitle?: string | null;
  repName?: string | null;
  hasRecording?: boolean;
  clipId?: string | null;
  isFeatured?: boolean;
  disposition?: string | null;
  outcome?: string | null;
  goalMet?: boolean;
  valueCents?: number | null;
  href?: string;
};

type FilterOption = { id: string; label: string };

type MinuteSummary = {
  remaining: number;
  usedLifetime: number;
  consumedInWindow: number;
  plan: string;
  planLabel: string;
  planMinutes: number | null;
  renewsAt: string | null;
  renewNote: string;
};

type TimeRange = '' | '7d' | '30d' | '90d';
type KindFilter = '' | 'training' | 'campaign';

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
  description = 'Training and brand dials — minutes charged, disposition, and outcomes.',
  showRepFilter = Boolean(brandId),
  emptyHref = '/practice',
  emptyLabel = 'Start practice →',
}: Props) {
  const [calls, setCalls] = useState<PracticeCallRow[]>([]);
  const [minuteSummary, setMinuteSummary] = useState<MinuteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repId, setRepId] = useState('');
  const [campaignKey, setCampaignKey] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [kindFilter, setKindFilter] = useState<KindFilter>('');
  const [reps, setReps] = useState<FilterOption[]>([]);
  const [campaigns, setCampaigns] = useState<FilterOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (brandId) params.set('brandId', brandId);
      if (timeRange) params.set('since', timeRange);
      if (!brandId) params.set('includeCampaign', '1');
      const res = await fetch(`/api/trainer/sessions?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load past calls');
      const rows: PracticeCallRow[] = (data.calls || data.sessions || []).map(
        (row: PracticeCallRow) => ({
          ...row,
          kind: row.kind || 'training',
          minutesCharged:
            row.minutesCharged != null
              ? row.minutesCharged
              : row.kind === 'campaign'
                ? 0
                : billablePracticeMinutes(row.duration),
        })
      );
      setCalls(rows);
      setMinuteSummary(data.minuteSummary || null);

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
          : row.campaignTitle
            ? `campaign:${row.campaignTitle}`
            : row.focusArea
              ? `focus:${row.focusArea}`
              : '';
        if (!key) continue;
        const label =
          row.brandName ||
          row.campaignTitle ||
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
  }, [brandId, showRepFilter, timeRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return calls.filter((row) => {
      if (repId && row.userId !== repId) return false;
      if (kindFilter && (row.kind || 'training') !== kindFilter) return false;
      if (campaignKey) {
        const key = row.brandId
          ? `brand:${row.brandId}`
          : row.campaignTitle
            ? `campaign:${row.campaignTitle}`
            : row.focusArea
              ? `focus:${row.focusArea}`
              : '';
        if (key !== campaignKey) return false;
      }
      return true;
    });
  }, [calls, repId, campaignKey, kindFilter]);

  const filteredMinutes = useMemo(
    () =>
      filtered
        .filter((r) => (r.kind || 'training') === 'training')
        .reduce((sum, r) => sum + (r.minutesCharged || 0), 0),
    [filtered]
  );

  function detailHref(row: PracticeCallRow) {
    if (row.href && !brandId) return row.href;
    const base = `${detailBase}/${row.id}`;
    return detailQuery ? `${base}?${detailQuery}` : base;
  }

  const renewLabel = minuteSummary?.renewsAt
    ? new Date(minuteSummary.renewsAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="practice-calls">
      {minuteSummary && !brandId ? (
        <div className="practice-calls__minutes" aria-label="Practice minute balance">
          <div className="practice-calls__minutes-grid">
            <div>
              <span className="practice-calls__minutes-label">Minutes left</span>
              <strong>{Math.max(0, Math.floor(minuteSummary.remaining))}</strong>
            </div>
            <div>
              <span className="practice-calls__minutes-label">Used in view</span>
              <strong>{filteredMinutes}</strong>
            </div>
            <div>
              <span className="practice-calls__minutes-label">Lifetime used</span>
              <strong>{minuteSummary.usedLifetime}</strong>
            </div>
            <div>
              <span className="practice-calls__minutes-label">
                {renewLabel ? 'Renews' : 'Plan'}
              </span>
              <strong>
                {renewLabel || minuteSummary.planLabel}
                {minuteSummary.planMinutes != null ? ` · ${minuteSummary.planMinutes}/mo` : ''}
              </strong>
            </div>
          </div>
          <p className="practice-calls__minutes-note muted">{minuteSummary.renewNote}</p>
          <p className="practice-calls__minutes-note muted">
            Training calls bill practice minutes (rounded up per call). Brand / campaign dials do
            not use your practice balance.
            {minuteSummary.plan === 'FREE' ? (
              <>
                {' '}
                <Link href="/subscribe/sdr" className="soft-link">
                  Get more minutes →
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="practice-calls__toolbar">
        <div>
          <h2 className="practice-calls__title">{title}</h2>
          {description ? <p className="practice-calls__desc muted">{description}</p> : null}
        </div>
        <div className="practice-calls__filters">
          <label className="practice-calls__filter">
            <span>Time</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="">All time</option>
            </select>
          </label>
          {!brandId ? (
            <label className="practice-calls__filter">
              <span>Type</span>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as KindFilter)}
              >
                <option value="">All calls</option>
                <option value="training">Training</option>
                <option value="campaign">Brand / campaign</option>
              </select>
            </label>
          ) : null}
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
          <p className="muted">No calls in this range yet.</p>
          {emptyHref ? (
            <Link href={emptyHref} className="btn">
              {emptyLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="practice-calls__list">
          {filtered.map((session) => {
            const kind = session.kind || 'training';
            const focusLabel =
              (FOCUS_LABELS as Record<string, string>)[session.focusArea as FocusArea] ||
              session.focusArea;
            const campaignLabel =
              session.campaignTitle || session.brandName || focusLabel;
            const disposition = formatDisposition(session.disposition || session.outcome);
            const valueLabel = session.goalMet ? formatUsdCents(session.valueCents) : null;
            const minutes =
              kind === 'training'
                ? session.minutesCharged ?? billablePracticeMinutes(session.duration)
                : 0;

            return (
              <li key={`${kind}-${session.id}`}>
                <Link href={detailHref(session)} className="practice-calls__row">
                  <div className="practice-calls__main">
                    <div className="practice-calls__lead">
                      <span
                        className={`practice-calls__kind practice-calls__kind--${kind}`}
                      >
                        {kind === 'training' ? 'Training' : 'Brand'}
                      </span>
                      {session.leadCompany ||
                        (kind === 'training' ? 'General practice' : 'Brand dial')}
                      {session.isFeatured ? (
                        <span className="practice-calls__badge">Resume</span>
                      ) : null}
                      {session.goalMet ? (
                        <span className="practice-calls__badge practice-calls__badge--goal">
                          Goal met
                        </span>
                      ) : null}
                    </div>
                    <div className="practice-calls__meta">
                      {formatSessionDate(session.createdAt)}
                      {' · '}
                      {formatDuration(session.duration)}
                      {kind === 'training' ? (
                        <>
                          {' · '}
                          <span className="practice-calls__min-charge">
                            −{minutes} min
                          </span>
                        </>
                      ) : (
                        <> · no practice min</>
                      )}
                      {session.difficulty ? ` · ${session.difficulty}` : ''}
                      {showRepFilter && session.repName ? ` · ${session.repName}` : ''}
                    </div>
                    <div className="practice-calls__campaign">{campaignLabel}</div>
                    {disposition || valueLabel ? (
                      <div className="practice-calls__outcome">
                        {disposition ? <span>{disposition}</span> : null}
                        {valueLabel ? (
                          <span className="practice-calls__value">{valueLabel}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="practice-calls__stats">
                    {kind === 'training' && session.overallScore != null ? (
                      <>
                        <span
                          className="practice-calls__score"
                          style={{ color: scoreColor(session.overallScore) }}
                        >
                          {session.overallScore}/100
                        </span>
                        {typeof session.pointsEarned === 'number' ? (
                          <span className="muted">+{session.pointsEarned} pts</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="practice-calls__score practice-calls__score--min">
                          {valueLabel || (session.goalMet ? 'Goal' : '—')}
                        </span>
                        {disposition ? (
                          <span className="muted">{disposition}</span>
                        ) : (
                          <span className="muted">Brand dial</span>
                        )}
                      </>
                    )}
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
