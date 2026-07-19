'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { enrichDemoTeamMetrics, getDemoTeam } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import {
  DeskToolbar,
  DeskToolbarSearch,
  DeskToolbarSelect,
  DeskViewToggle,
} from '@/components/ui/DeskChrome';

export type TeamCampaignRow = {
  id: string;
  title: string;
  status: string;
  brandKey?: string;
  brandName?: string;
  dials?: number;
  verifiedGoals?: number;
  lastCallAt?: string | Date | null;
};

export type TeamMemberRow = {
  userId: string;
  name: string;
  slug: string | null;
  avatarUrl?: string | null;
  brandKey?: string;
  brandName?: string;
  /** All brands this rep is accepted on (multi-brand membership). */
  brands?: { brandKey: string; brandName: string }[];
  campaigns: TeamCampaignRow[];
  dials: number;
  verifiedGoals?: number;
  lastCallAt: string | Date | null;
};

type ViewMode = 'cards' | 'table';

function formatLastCall(at: string | Date | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  return d.toLocaleDateString();
}

function lastCallLabel(at: string | Date | null): string {
  if (!at) return 'No dials yet';
  return `Last ${formatLastCall(at)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(url) && !broken;
  return (
    <div className="sdr-team-avatar" aria-hidden>
      {showImg ? (
        <img src={url!} alt="" onError={() => setBroken(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

function brandLabels(m: TeamMemberRow): string[] {
  if (m.brands && m.brands.length > 0) {
    return m.brands.map((b) => b.brandName).filter(Boolean);
  }
  return m.brandName ? [m.brandName] : [];
}

function primaryBrandKey(m: TeamMemberRow, fallback: string) {
  return (
    m.campaigns.find((c) => c.brandKey)?.brandKey ||
    m.brandKey ||
    m.brands?.[0]?.brandKey ||
    fallback
  );
}

function campaignBrandKey(m: TeamMemberRow, c: TeamCampaignRow, fallback: string) {
  return c.brandKey || m.brandKey || fallback;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  if (!qs) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

function SdrActionLinks({
  userId,
  brandKey,
  campaignId,
  label,
}: {
  userId: string;
  brandKey: string;
  campaignId?: string;
  label: string;
}) {
  return (
    <nav className="sdr-team-card__links" aria-label={label}>
      <Link
        href={withQuery(brandHref(brandKey, 'calls'), {
          rep: userId,
          campaign: campaignId,
        })}
      >
        Calls
      </Link>
      <Link href={withQuery('/sdrs/payouts', { rep: userId })}>Payouts</Link>
      <Link
        href={withQuery(brandHref(brandKey, 'goals'), {
          rep: userId,
          campaign: campaignId,
        })}
      >
        Goals
      </Link>
    </nav>
  );
}

function sumGoals(m: TeamMemberRow): number {
  if (typeof m.verifiedGoals === 'number') return m.verifiedGoals;
  return m.campaigns.reduce((s, c) => s + (c.verifiedGoals || 0), 0);
}

export default function BrandSdrTeamClient({
  brandKey,
  initial,
  showBrandColumn = false,
}: {
  brandKey: string;
  initial: TeamMemberRow[];
  /** When roster spans multiple brands (account Team page). */
  showBrandColumn?: boolean;
}) {
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const team: TeamMemberRow[] = useMemo(() => {
    if (!isDemo || initial.length > 0) return initial;
    return enrichDemoTeamMetrics(brandKey, undefined, getDemoTeam(brandKey));
  }, [isDemo, initial, brandKey]);

  const [view, setView] = useState<ViewMode>('cards');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'ACCEPTED'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return team.filter((m) => {
      if (statusFilter !== 'all' && !m.campaigns.some((c) => c.status === statusFilter)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        m.name,
        ...brandLabels(m),
        ...m.campaigns.map((c) => `${c.title} ${c.status} ${c.brandName || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [team, query, statusFilter]);

  return (
    <Panel
      compact
      className="desk-panel--deck"
      description={`${filtered.length}${filtered.length !== team.length ? ` of ${team.length}` : ''} on roster`}
      actions={
        <DeskViewToggle
          value={view}
          onChange={(next) => setView(next as ViewMode)}
          options={[
            { id: 'cards', label: 'Cards' },
            { id: 'table', label: 'Table' },
          ]}
        />
      }
    >
      {team.length > 0 ? (
        <DeskToolbar>
          <DeskToolbarSearch
            value={query}
            onChange={setQuery}
            placeholder="Filter by name, brand, campaign…"
            label="Filter team"
          />
          <DeskToolbarSelect
            value={statusFilter}
            onChange={(next) => setStatusFilter(next as typeof statusFilter)}
            label="Status"
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ACCEPTED">Accepted</option>
          </DeskToolbarSelect>
        </DeskToolbar>
      ) : null}
      {team.length === 0 ? (
        <EmptyState
          title="No active SDRs yet"
          description="Accept applicants from Recruit, then activate them on a campaign."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try a different name, brand, campaign, or status filter."
        />
      ) : view === 'cards' ? (
        <ul className="sdr-team-card-grid">
          {filtered.map((m) => {
            const labels = brandLabels(m);
            const goals = sumGoals(m);
            const bk = primaryBrandKey(m, brandKey);
            return (
              <li key={m.userId} className="sdr-team-card">
                <div className="sdr-team-card__top">
                  <Avatar name={m.name} url={m.avatarUrl} />
                  <div className="sdr-team-card__identity">
                    {m.slug ? (
                      <Link href={`/r/${m.slug}`} className="sdr-team-card__name">
                        {m.name}
                      </Link>
                    ) : (
                      <span className="sdr-team-card__name">{m.name}</span>
                    )}
                    {showBrandColumn && labels.length > 0 ? (
                      <span className="sdr-team-card__brand">{labels.join(' · ')}</span>
                    ) : null}
                    <p className="sdr-team-card__meta muted">
                      {m.dials} dial{m.dials === 1 ? '' : 's'}
                      {' · '}
                      {goals} goal{goals === 1 ? '' : 's'}
                      {' · '}
                      {lastCallLabel(m.lastCallAt)}
                    </p>
                  </div>
                </div>

                {m.campaigns.length > 0 ? (
                  <ul className="sdr-team-card__campaigns">
                    {m.campaigns.map((c) => (
                      <li key={`${c.brandKey || m.brandKey || brandKey}:${c.id}`}>
                        <span className="sdr-team-card__campaign-title">
                          {showBrandColumn && c.brandName ? `${c.brandName} · ` : ''}
                          {c.title}
                        </span>
                        <span className="sdr-team-card__camp-metrics muted">
                          {c.dials ?? 0} dials · {c.verifiedGoals ?? 0} goals
                        </span>
                        <span className="sdr-team-card__status">{c.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                    No campaigns yet
                  </p>
                )}

                <SdrActionLinks
                  userId={m.userId}
                  brandKey={bk}
                  label={`${m.name} shortcuts`}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="sdr-team-table-wrap">
          <table className="sdr-team-table sdr-team-table--nested">
            <thead>
              <tr>
                <th scope="col">SDR / Brand · Campaign</th>
                <th scope="col">Status</th>
                <th scope="col">Dials</th>
                <th scope="col">Verified goals</th>
                <th scope="col">Last call</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((m) => {
                const goals = sumGoals(m);
                const bk = primaryBrandKey(m, brandKey);
                const repRow = (
                  <tr key={m.userId} className="sdr-team-table__rep-row">
                    <td>
                      <div className="sdr-team-table__sdr">
                        <Avatar name={m.name} url={m.avatarUrl} />
                        <div>
                          {m.slug ? (
                            <Link href={`/r/${m.slug}`} className="sdr-team-table__name">
                              {m.name}
                            </Link>
                          ) : (
                            <span className="sdr-team-table__name">{m.name}</span>
                          )}
                          <div className="muted small">
                            {m.campaigns.length} campaign
                            {m.campaigns.length === 1 ? '' : 's'}
                            {showBrandColumn
                              ? ` · ${brandLabels(m).length || 1} brand${
                                  (brandLabels(m).length || 1) === 1 ? '' : 's'
                                }`
                              : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">—</td>
                    <td>
                      <strong>{m.dials}</strong>
                    </td>
                    <td>
                      <strong>{goals}</strong>
                    </td>
                    <td className="muted">{formatLastCall(m.lastCallAt)}</td>
                    <td className="sdr-team-table__actions">
                      <SdrActionLinks
                        userId={m.userId}
                        brandKey={bk}
                        label={`${m.name} shortcuts`}
                      />
                    </td>
                  </tr>
                );
                const nestRows = m.campaigns.map((c) => {
                  const cBk = campaignBrandKey(m, c, brandKey);
                  return (
                    <tr
                      key={`${m.userId}:${cBk}:${c.id}`}
                      className="sdr-team-table__nest-row"
                    >
                      <td>
                        <div className="sdr-team-table__nest">
                          <span className="sdr-team-table__nest-mark" aria-hidden />
                          <div>
                            {showBrandColumn || c.brandName ? (
                              <div className="sdr-team-table__nest-brand">
                                {c.brandName || brandLabels(m)[0] || 'Brand'}
                              </div>
                            ) : null}
                            <div className="sdr-team-table__nest-campaign">{c.title}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="sdr-team-card__status">{c.status}</span>
                      </td>
                      <td>{c.dials ?? 0}</td>
                      <td>{c.verifiedGoals ?? 0}</td>
                      <td className="muted">{formatLastCall(c.lastCallAt)}</td>
                      <td className="sdr-team-table__actions">
                        <SdrActionLinks
                          userId={m.userId}
                          brandKey={cBk}
                          campaignId={c.id}
                          label={`${m.name} · ${c.title} shortcuts`}
                        />
                      </td>
                    </tr>
                  );
                });
                return [repRow, ...nestRows];
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
