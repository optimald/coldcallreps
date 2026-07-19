'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { brandHref } from '@/lib/brand-context';
import { getDemoCallsBoard } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import {
  DeskToolbar,
  DeskToolbarSearch,
  DeskToolbarSelect,
  DeskViewToggle,
} from '@/components/ui/DeskChrome';

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

type ViewMode = 'board' | 'table';
type TableSort = 'newest' | 'oldest' | 'company' | 'sdr' | 'duration' | 'status';
type TableBucket = 'all' | 'upcoming' | 'active' | 'past';

type FlatCallRow = {
  id: string;
  bucket: 'upcoming' | 'active' | 'past';
  when: string;
  title: string;
  company: string;
  sdrName: string;
  sdrId: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  status: string;
  outcome: string | null;
  duration: number | null;
  meetLink: string | null;
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

function isSameLocalDay(iso: string, day = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function todayLabel(day = new Date()) {
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<BoardData | null>(() =>
    mode === 'demo' ? (getDemoCallsBoard(brandKey, brandName) as BoardData) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => mode !== 'demo');
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get('campaign') || '');
  const [repFilter, setRepFilter] = useState(() => searchParams.get('rep') || '');
  const [view, setView] = useState<ViewMode>(
    () => (searchParams.get('view') === 'table' ? 'table' : 'board')
  );
  const [mobileCol, setMobileCol] = useState<'upcoming' | 'active' | 'past'>('active');
  const [tableQuery, setTableQuery] = useState('');
  const [tableBucket, setTableBucket] = useState<TableBucket>('all');
  const [tableSort, setTableSort] = useState<TableSort>('newest');

  useEffect(() => {
    setRepFilter(searchParams.get('rep') || '');
    setCampaignFilter(searchParams.get('campaign') || '');
    setView(searchParams.get('view') === 'table' ? 'table' : 'board');
  }, [searchParams]);

  function patchUrl(next: {
    rep?: string;
    campaign?: string;
    view?: ViewMode;
  }) {
    if (next.rep !== undefined) setRepFilter(next.rep);
    if (next.campaign !== undefined) setCampaignFilter(next.campaign);
    if (next.view !== undefined) setView(next.view);
    const params = new URLSearchParams(searchParams.toString());
    if (next.rep !== undefined) {
      if (next.rep) params.set('rep', next.rep);
      else params.delete('rep');
    }
    if (next.campaign !== undefined) {
      if (next.campaign) params.set('campaign', next.campaign);
      else params.delete('campaign');
    }
    if (next.view !== undefined) {
      if (next.view === 'table') params.set('view', 'table');
      else params.delete('view');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

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
    if (campaignFilter && !map.has(campaignFilter)) {
      map.set(campaignFilter, 'Selected campaign');
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, campaignFilter]);

  const reps = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of [...(data?.active || []), ...(data?.past || []), ...(data?.upcoming || [])]) {
      if (row.sdrId && row.sdrName) map.set(row.sdrId, row.sdrName);
    }
    if (repFilter && !map.has(repFilter)) {
      map.set(repFilter, 'Selected SDR');
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, repFilter]);

  function matchFilters(row: { campaignId: string | null; sdrId: string | null }) {
    if (campaignFilter && row.campaignId !== campaignFilter) return false;
    if (repFilter && row.sdrId !== repFilter) return false;
    return true;
  }

  /** Kanban is scoped to the current local day. */
  const upcoming = (data?.upcoming || []).filter(
    (row) => matchFilters(row) && isSameLocalDay(row.startsAt)
  );
  const active = (data?.active || []).filter(matchFilters);
  const past = (data?.past || []).filter(
    (row) => matchFilters(row) && isSameLocalDay(row.createdAt)
  );

  const flatRows = useMemo((): FlatCallRow[] => {
    const rows: FlatCallRow[] = [];
    for (const row of data?.upcoming || []) {
      if (!matchFilters(row)) continue;
      rows.push({
        id: `up-${row.id}`,
        bucket: 'upcoming',
        when: row.startsAt,
        title: row.title,
        company: row.companyName || row.title,
        sdrName: row.sdrName || '—',
        sdrId: row.sdrId,
        campaignId: row.campaignId,
        campaignTitle: row.campaignTitle,
        status: row.kind,
        outcome: null,
        duration: null,
        meetLink: row.meetLink || row.htmlLink,
      });
    }
    for (const row of data?.active || []) {
      if (!matchFilters(row)) continue;
      rows.push({
        id: `act-${row.id}`,
        bucket: 'active',
        when: row.updatedAt || row.createdAt,
        title: row.companyName || row.toNumber || 'Call',
        company: row.companyName || row.toNumber || 'Call',
        sdrName: row.sdrName || '—',
        sdrId: row.sdrId,
        campaignId: row.campaignId,
        campaignTitle: row.campaignTitle,
        status: row.status,
        outcome: row.outcome,
        duration: row.duration,
        meetLink: null,
      });
    }
    for (const row of data?.past || []) {
      if (!matchFilters(row)) continue;
      rows.push({
        id: `past-${row.id}`,
        bucket: 'past',
        when: row.createdAt,
        title: row.companyName || row.toNumber || 'Call',
        company: row.companyName || row.toNumber || 'Call',
        sdrName: row.sdrName || '—',
        sdrId: row.sdrId,
        campaignId: row.campaignId,
        campaignTitle: row.campaignTitle,
        status: row.status,
        outcome: row.outcome,
        duration: row.duration,
        meetLink: null,
      });
    }
    return rows;
    // matchFilters closes over campaign/rep filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, campaignFilter, repFilter]);

  const tableRows = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    let rows = flatRows.filter((r) => {
      if (tableBucket !== 'all' && r.bucket !== tableBucket) return false;
      if (!q) return true;
      const hay = `${r.company} ${r.title} ${r.sdrName} ${r.campaignTitle || ''} ${r.status} ${r.outcome || ''}`.toLowerCase();
      return hay.includes(q);
    });
    rows = [...rows].sort((a, b) => {
      if (tableSort === 'company') return a.company.localeCompare(b.company);
      if (tableSort === 'sdr') return a.sdrName.localeCompare(b.sdrName);
      if (tableSort === 'status') return a.status.localeCompare(b.status);
      if (tableSort === 'duration') return (b.duration || 0) - (a.duration || 0);
      const ta = new Date(a.when).getTime();
      const tb = new Date(b.when).getTime();
      return tableSort === 'oldest' ? ta - tb : tb - ta;
    });
    return rows;
  }, [flatRows, tableQuery, tableBucket, tableSort]);

  return (
    <Panel
      compact
      className="calls-board-panel"
      description={
        loading && !data
          ? 'Loading…'
          : view === 'board'
            ? `Today · ${todayLabel()}${isDemo ? ' · demo' : data ? ` · updated ${formatWhen(data.polledAt)}` : ''}`
            : isDemo
              ? 'Demo · all history'
              : data
                ? `All history · updated ${formatWhen(data.polledAt)}`
                : undefined
      }
      actions={
        <div className="calls-board__panel-actions">
          <DeskViewToggle
            value={view}
            onChange={(next) => patchUrl({ view: next as ViewMode })}
            options={[
              { id: 'board', label: 'Board' },
              { id: 'table', label: 'Table' },
            ]}
          />
          {!isDemo && hydrated ? (
            <button type="button" className="btn-ghost" onClick={() => void loadLive()}>
              Refresh
            </button>
          ) : null}
        </div>
      }
    >
      <div className="calls-board">
        <DeskToolbar>
          <DeskToolbarSelect
            value={campaignFilter}
            onChange={(next) => patchUrl({ campaign: next })}
            label="Campaign"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </DeskToolbarSelect>
          <DeskToolbarSelect
            value={repFilter}
            onChange={(next) => patchUrl({ rep: next })}
            label="Rep"
          >
            <option value="">All reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </DeskToolbarSelect>
          {view === 'table' ? (
            <>
              <DeskToolbarSearch
                value={tableQuery}
                onChange={setTableQuery}
                placeholder="Filter by company, SDR, campaign, status…"
                label="Search calls"
              />
              <DeskToolbarSelect
                value={tableBucket}
                onChange={(next) => setTableBucket(next as TableBucket)}
                label="Type"
              >
                <option value="all">All types</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="past">Past</option>
              </DeskToolbarSelect>
              <DeskToolbarSelect
                value={tableSort}
                onChange={(next) => setTableSort(next as TableSort)}
                label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="company">Company</option>
                <option value="sdr">SDR</option>
                <option value="duration">Longest duration</option>
                <option value="status">Status</option>
              </DeskToolbarSelect>
            </>
          ) : null}
        </DeskToolbar>

        {error ? <p className="msg-err">{error}</p> : null}

        {view === 'table' ? (
          tableRows.length === 0 ? (
            <EmptyState title="No matches" description="No calls match your filters." />
          ) : (
            <div className="sdr-team-table-wrap">
              <table className="sdr-team-table calls-board__table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Type</th>
                    <th scope="col">Company</th>
                    <th scope="col">SDR</th>
                    <th scope="col">Campaign</th>
                    <th scope="col">Status</th>
                    <th scope="col">Duration</th>
                    <th scope="col">
                      <span className="sr-only">Link</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatWhen(r.when)}
                      </td>
                      <td>
                        <span className="sdr-team-card__status">{r.bucket}</span>
                      </td>
                      <td>
                        <strong style={{ fontWeight: 650 }}>{r.company}</strong>
                        {r.outcome ? (
                          <div className="muted small">{r.outcome}</div>
                        ) : null}
                      </td>
                      <td className="muted">{r.sdrName}</td>
                      <td className="muted">{r.campaignTitle || '—'}</td>
                      <td>{r.status}</td>
                      <td className="muted">{formatDuration(r.duration) || '—'}</td>
                      <td>
                        {r.meetLink ? (
                          <a
                            href={r.meetLink}
                            className="soft-link"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Calendar
                          </a>
                        ) : r.campaignId ? (
                          <Link
                            href={brandHref(brandKey, 'campaigns', r.campaignId)}
                            className="soft-link"
                          >
                            Campaign
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
            <div className="calls-board__mobile-tabs" role="tablist" aria-label="Call columns">
              <button
                type="button"
                role="tab"
                aria-selected={mobileCol === 'upcoming'}
                className={`calls-board__mobile-tab${mobileCol === 'upcoming' ? ' is-active' : ''}`}
                onClick={() => setMobileCol('upcoming')}
              >
                Upcoming
                <span className="calls-board__mobile-tab-count">{upcoming.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileCol === 'active'}
                className={`calls-board__mobile-tab${mobileCol === 'active' ? ' is-active' : ''}`}
                onClick={() => setMobileCol('active')}
              >
                Active
                <span className="calls-board__mobile-tab-count">{active.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileCol === 'past'}
                className={`calls-board__mobile-tab${mobileCol === 'past' ? ' is-active' : ''}`}
                onClick={() => setMobileCol('past')}
              >
                Past
                <span className="calls-board__mobile-tab-count">{past.length}</span>
              </button>
            </div>

            <div className="calls-board__cols" data-mobile-col={mobileCol}>
              <section className="calls-board__col" data-col="upcoming" aria-label="Upcoming today">
                <header className="calls-board__col-head">
                  <strong>Upcoming today</strong>
                  <span className="calls-board__count">{upcoming.length}</span>
                </header>
                <div className="calls-board__col-body">
                  {!upcoming.length ? (
                    <p className="calls-board__empty">No meetings or callbacks today.</p>
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

              <section
                className="calls-board__col calls-board__col--active"
                data-col="active"
                aria-label="Active"
              >
                <header className="calls-board__col-head">
                  <strong>Active now</strong>
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

              <section className="calls-board__col" data-col="past" aria-label="Past today">
                <header className="calls-board__col-head">
                  <strong>Past today</strong>
                  <span className="calls-board__count">{past.length}</span>
                </header>
                <div className="calls-board__col-body">
                  {!past.length ? (
                    <p className="calls-board__empty">No completed calls today.</p>
                  ) : (
                    past.map((row) => <CallCard key={row.id} row={row} brandKey={brandKey} />)
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
