'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { getDemoCallsBoard } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';

type UpcomingRow = {
  id: string;
  kind: 'booking' | 'callback';
  title: string;
  startsAt: string;
  endsAt: string | null;
  meetLink: string | null;
  htmlLink: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string | null;
  companyName: string | null;
  prospectId: string | null;
};

type CallRow = {
  id: string;
  status: string;
  direction: string;
  outcome: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string;
  companyName: string | null;
  contactName: string | null;
  prospectId: string | null;
  toNumber: string | null;
  fromNumber: string | null;
};

type BoardData = {
  brand: { id: string; slug: string; name: string };
  upcoming: UpcomingRow[];
  active: CallRow[];
  past: CallRow[];
  polledAt: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(secs: number | null) {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CallCard({
  row,
  brandKey,
  live,
}: {
  row: CallRow;
  brandKey: string;
  live?: boolean;
}) {
  return (
    <article className={`calls-board__card${live ? ' is-live' : ''}`}>
      <div className="calls-board__card-top">
        <strong>{row.companyName || row.toNumber || 'Call'}</strong>
        {live ? <span className="calls-board__live-pill">{row.status}</span> : null}
      </div>
      <p className="calls-board__meta">
        {row.sdrName || 'SDR'}
        {row.contactName ? ` · ${row.contactName}` : ''}
        {row.campaignTitle ? ` · ${row.campaignTitle}` : ''}
      </p>
      <p className="calls-board__meta">
        {live ? formatWhen(row.updatedAt) : formatWhen(row.createdAt)}
        {row.duration != null ? ` · ${formatDuration(row.duration)}` : ''}
        {row.outcome ? ` · ${row.outcome}` : !live ? ` · ${row.status}` : ''}
      </p>
      {row.campaignId ? (
        <Link
          href={brandHref(brandKey, 'campaigns', row.campaignId)}
          className="calls-board__link"
        >
          Campaign →
        </Link>
      ) : null}
    </article>
  );
}

export default function BrandCallsBoard({
  brandKey,
  brandName,
}: {
  brandKey: string;
  brandName: string;
}) {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [data, setData] = useState<BoardData | null>(() =>
    mode === 'demo' ? (getDemoCallsBoard(brandKey, brandName) as BoardData) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => mode !== 'demo');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');

  const loadLive = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/calls/board`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (signal?.cancelled) return;
      if (!res.ok) throw new Error(json.error || 'Failed to load board');
      setData(json);
      setError(null);
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [brandKey]);

  useEffect(() => {
    if (!hydrated) return;

    if (mode === 'demo') {
      setData(getDemoCallsBoard(brandKey, brandName) as BoardData);
      setError(null);
      setLoading(false);
      return;
    }

    const signal = { cancelled: false };
    setLoading(true);
    void loadLive(signal);

    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadLive(signal);
    }, 5000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadLive(signal);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      signal.cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [hydrated, mode, brandKey, brandName, loadLive]);

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of [...(data?.active || []), ...(data?.past || []), ...(data?.upcoming || [])]) {
      if (row.campaignId && row.campaignTitle) map.set(row.campaignId, row.campaignTitle);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const reps = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of [...(data?.active || []), ...(data?.past || []), ...(data?.upcoming || [])]) {
      if (row.sdrId && row.sdrName) map.set(row.sdrId, row.sdrName);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  function matchCall(row: CallRow | UpcomingRow) {
    if (campaignFilter && row.campaignId !== campaignFilter) return false;
    if (repFilter && row.sdrId !== repFilter) return false;
    return true;
  }

  const upcoming = (data?.upcoming || []).filter(matchCall);
  const active = (data?.active || []).filter(matchCall);
  const past = (data?.past || []).filter(matchCall);

  return (
    <div className="calls-board">
      <div className="calls-board__toolbar">
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {loading && !data
            ? 'Loading…'
            : isDemo
              ? 'Demo sample'
              : data
                ? `Updated ${formatWhen(data.polledAt)} · polls every 5s`
                : null}
        </p>
        <div className="calls-board__filters">
          <label className="calls-board__filter">
            <span>Campaign</span>
            <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="calls-board__filter">
            <span>Rep</span>
            <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
              <option value="">All reps</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {!isDemo && hydrated ? (
            <button type="button" className="btn-ghost" onClick={() => void loadLive()}>
              Refresh
            </button>
          ) : null}
          <Link href={brandHref(brandKey, 'practice')} className="btn-ghost">
            Practice history →
          </Link>
        </div>
      </div>

      {error ? <p className="msg-err">{error}</p> : null}

      <div className="calls-board__cols">
        <section className="calls-board__col" aria-label="Upcoming">
          <header className="calls-board__col-head">
            <strong>Upcoming</strong>
            <span className="calls-board__count">{upcoming.length}</span>
          </header>
          <div className="calls-board__col-body">
            {!upcoming.length ? (
              <p className="calls-board__empty">No upcoming meetings or callbacks.</p>
            ) : (
              upcoming.map((row) => (
                <article key={row.id} className="calls-board__card">
                  <div className="calls-board__card-top">
                    <strong>{row.title}</strong>
                    <span className="calls-board__kind">{row.kind}</span>
                  </div>
                  <p className="calls-board__meta">
                    {formatWhen(row.startsAt)}
                    {row.sdrName ? ` · ${row.sdrName}` : ''}
                    {row.campaignTitle ? ` · ${row.campaignTitle}` : ''}
                  </p>
                  <div className="calls-board__actions">
                    {row.meetLink || row.htmlLink ? (
                      <a
                        href={row.meetLink || row.htmlLink || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="calls-board__link"
                      >
                        Open calendar →
                      </a>
                    ) : null}
                    {row.campaignId ? (
                      <Link
                        href={brandHref(brandKey, 'campaigns', row.campaignId)}
                        className="calls-board__link"
                      >
                        Campaign →
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="calls-board__col calls-board__col--active" aria-label="Active">
          <header className="calls-board__col-head">
            <strong>Active</strong>
            <span className="calls-board__count">{active.length}</span>
          </header>
          <div className="calls-board__col-body">
            {!active.length ? (
              <p className="calls-board__empty">No live dials right now.</p>
            ) : (
              active.map((row) => (
                <CallCard key={row.id} row={row} brandKey={brandKey} live />
              ))
            )}
          </div>
        </section>

        <section className="calls-board__col" aria-label="Past">
          <header className="calls-board__col-head">
            <strong>Past</strong>
            <span className="calls-board__count">{past.length}</span>
          </header>
          <div className="calls-board__col-body">
            {!past.length ? (
              <p className="calls-board__empty">No recent completed calls.</p>
            ) : (
              past.map((row) => <CallCard key={row.id} row={row} brandKey={brandKey} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
