'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { formatPayout } from '@/lib/campaigns';
import { getDemoStats } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import {
  EmptyState,
  Panel,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

function pct(num: number, den: number): string {
  if (den <= 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

function DemoStatsBody({ brandKey }: { brandKey: string }) {
  const s = getDemoStats(brandKey);
  const pipeMax = Math.max(1, ...s.pipeline.map((p) => p.value));
  const maxDay = Math.max(1, ...s.days.map((d) => d.count));
  const maxDials = Math.max(1, ...s.perSdr.map((r) => r.dials));

  return (
    <>
      <StatGrid>
        <Stat label="Open campaigns" value={s.openCount} tone="accent" />
        <Stat label="Pending apps" value={s.pendingApps} tone="warn" />
        <Stat label="Active SDRs" value={s.activeApps} tone="good" />
        <Stat label="Leads" value={s.leadCount} />
        <Stat label="Calls today" value={s.callsToday} tone="accent" />
        <Stat label="Meetings" value={s.bookings} tone="good" />
        <Stat label="Paid out" value={formatPayout(s.paidOutCents)} />
        <Stat label="Connect rate" value={s.connectRate} />
      </StatGrid>

      <div className="sdr-stats__split">
        <Panel
          title="Hiring pipeline"
          description={`${s.acceptRate} of applicants are active · ${s.rejectedApps} rejected`}
          actions={
            <Link href={brandHref(brandKey, 'sdrs', 'applications')} className="soft-link">
              Review →
            </Link>
          }
        >
          <div className="sdr-stats__pipeline">
            {s.pipeline.map((p) => {
              const href =
                p.label === 'Active'
                  ? brandHref(brandKey, 'sdrs', 'team')
                  : brandHref(brandKey, 'sdrs', 'applications');
              return (
                <Link key={p.label} href={href} className="sdr-stats__pipe">
                  <span className="sdr-stats__pipe-label">{p.label}</span>
                  <span className="sdr-stats__pipe-value">{p.value}</span>
                  <span className="sdr-stats__pipe-track" aria-hidden>
                    <span
                      className="sdr-stats__pipe-fill"
                      style={{ width: `${Math.max(8, (p.value / pipeMax) * 100)}%` }}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Dial volume · 7 days"
          description={`${s.callCount} calls · avg talk ${s.avgLabel} · book rate ${s.bookRate}`}
          actions={
            <Link href={brandHref(brandKey, 'calls')} className="soft-link">
              Live board →
            </Link>
          }
        >
          <div className="sdr-stats__bars" role="img" aria-label="Calls per day last 7 days">
            {s.days.map((d) => (
              <div key={d.key} className="sdr-stats__bar-col">
                <div className="sdr-stats__bar-track">
                  <div
                    className="sdr-stats__bar-fill"
                    style={{
                      height: `${Math.max(d.count > 0 ? 12 : 0, (d.count / maxDay) * 100)}%`,
                    }}
                    title={`${d.count} call${d.count === 1 ? '' : 's'}`}
                  />
                </div>
                <span className="sdr-stats__bar-label">{d.label}</span>
                <span className="sdr-stats__bar-count">{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Per-SDR scorecards"
        description={`${s.perSdr.length} reps · ranked by dials`}
        actions={
          <Link href={brandHref(brandKey, 'sdrs', 'payouts')} className="soft-link">
            Payouts →
          </Link>
        }
      >
        <ul className="sdr-stats__cards" aria-label="Per-SDR scorecards">
          {s.perSdr.map((r, i) => (
            <li key={r.userId} className="sdr-stats__card">
              <div className="sdr-stats__card-top">
                <span className="sdr-stats__rank" data-top={i < 3 ? String(i + 1) : undefined}>
                  {i + 1}
                </span>
                <div className="sdr-stats__card-meta">
                  <strong>
                    {r.name}
                    {r.verified ? (
                      <span className="sdr-stats__verified" title="Verified">
                        ✓
                      </span>
                    ) : null}
                  </strong>
                  <span className="muted small">
                    {r.campaigns} campaign{r.campaigns === 1 ? '' : 's'}
                    {r.statuses.includes('ACTIVE') ? ' · active' : ''}
                  </span>
                </div>
              </div>
              <div className="sdr-stats__card-stats">
                <span>
                  Dials <strong>{r.dials}</strong>
                </span>
                <span>
                  Connect <strong>{pct(r.completed, r.dials)}</strong>
                </span>
                <span>
                  Meetings <strong>{r.meetings}</strong>
                </span>
                <span>
                  Payouts{' '}
                  <strong>
                    {r.payouts > 0 ? `${r.payouts} · ${formatPayout(r.payoutCents)}` : '—'}
                  </strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="sdr-stats__table-wrap">
          <table className="sdr-stats__table">
            <thead>
              <tr>
                <th scope="col">SDR</th>
                <th scope="col">Dials</th>
                <th scope="col">Connect</th>
                <th scope="col">Meetings</th>
                <th scope="col">Payouts</th>
                <th scope="col">Last dial</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {s.perSdr.map((r, i) => (
                <tr key={r.userId}>
                  <td>
                    <div className="sdr-stats__name-cell">
                      <span
                        className="sdr-stats__rank"
                        data-top={i < 3 ? String(i + 1) : undefined}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <strong>
                          {r.name}
                          {r.verified ? (
                            <span className="sdr-stats__verified" title="Verified">
                              ✓
                            </span>
                          ) : null}
                        </strong>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          {r.campaigns} campaign{r.campaigns === 1 ? '' : 's'}
                          {r.statuses.includes('ACTIVE') ? ' · active' : ''}
                          {r.avgDuration ? ` · avg ${Math.round(r.avgDuration)}s` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="sdr-stats__dial-cell">
                      <strong>{r.dials}</strong>
                      <span className="sdr-stats__mini-track" aria-hidden>
                        <span
                          className="sdr-stats__mini-fill"
                          style={{ width: `${(r.dials / maxDials) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td>{pct(r.completed, r.dials)}</td>
                  <td>{r.meetings}</td>
                  <td>
                    {r.payouts > 0 ? (
                      <>
                        {r.payouts} · {formatPayout(r.payoutCents)}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {r.lastAt ? new Date(r.lastAt).toLocaleDateString() : '—'}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="muted" style={{ fontSize: '0.8rem', marginTop: '-0.25rem' }}>
        Totals: {s.campaignCount} campaigns · {s.appCount} applications · {s.callCount} calls ·{' '}
        <Link href={brandHref(brandKey, 'calls')} className="soft-link">
          open calls
        </Link>
      </p>
    </>
  );
}

/** Swaps live SSR stats for fixture stats when desk mode is Demo. */
export default function BrandSdrStatsClient({
  brandKey,
  liveChildren,
}: {
  brandKey: string;
  liveChildren: ReactNode;
}) {
  const { mode } = useBrandDeskMode();
  if (mode === 'demo') {
    return <DemoStatsBody brandKey={brandKey} />;
  }
  return <>{liveChildren}</>;
}

export function BrandSdrStatsEmptyLive({ brandKey }: { brandKey: string }) {
  return (
    <Panel>
      <EmptyState
        title="No activity yet"
        description="Post an OPEN campaign, accept SDRs, and dials will show up here."
        action={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link href={brandHref(brandKey, 'campaigns')} className="btn">
              New campaign
            </Link>
            <Link href={brandHref(brandKey, 'sdrs', 'applications')} className="btn-ghost">
              Applications
            </Link>
          </div>
        }
      />
    </Panel>
  );
}
