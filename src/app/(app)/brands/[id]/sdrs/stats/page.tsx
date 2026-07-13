import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { formatPayout } from '@/lib/campaigns';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import BrandSdrStatsClient, {
  BrandSdrStatsEmptyLive,
} from '@/components/BrandSdrStatsClient';
import {
  EmptyState,
  PageHeader,
  Panel,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

function pct(num: number, den: number): string {
  if (den <= 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function BrandSdrStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!brand) notFound();
  if (!canManageBrand(profile, brand.ownerId)) redirect('/dashboard');

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    campaignCount,
    openCount,
    appCount,
    callCount,
    leadCount,
    bookings,
    payoutAgg,
    pendingApps,
    activeApps,
    rejectedApps,
    callsToday,
    callsWeek,
    completedCalls,
    avgDuration,
  ] = await Promise.all([
    prisma.campaign.count({ where: { brandId: brand.id } }),
    prisma.campaign.count({ where: { brandId: brand.id, status: 'OPEN' } }),
    prisma.campaignApplication.count({
      where: { campaign: { brandId: brand.id } },
    }),
    prisma.callLog.count({ where: { brandId: brand.id } }),
    prisma.prospect.count({
      where: { brandId: brand.id, NOT: { source: 'training' } },
    }),
    prisma.calendarBooking.count({ where: { brandId: brand.id } }),
    prisma.campaignPayout.aggregate({
      where: { campaign: { brandId: brand.id } },
      _sum: { grossCents: true, netCents: true },
      _count: true,
    }),
    prisma.campaignApplication.count({
      where: { campaign: { brandId: brand.id }, status: 'APPLIED' },
    }),
    prisma.campaignApplication.count({
      where: {
        campaign: { brandId: brand.id },
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
    }),
    prisma.campaignApplication.count({
      where: { campaign: { brandId: brand.id }, status: 'REJECTED' },
    }),
    prisma.callLog.count({
      where: { brandId: brand.id, createdAt: { gte: startOfDay } },
    }),
    prisma.callLog.findMany({
      where: { brandId: brand.id, createdAt: { gte: weekAgo } },
      select: { createdAt: true, status: true, duration: true, userId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.callLog.count({
      where: { brandId: brand.id, status: 'completed' },
    }),
    prisma.callLog.aggregate({
      where: { brandId: brand.id, duration: { not: null } },
      _avg: { duration: true },
    }),
  ]);

  const apps = await prisma.campaignApplication.findMany({
    where: {
      campaign: { brandId: brand.id },
      status: { in: ['ACCEPTED', 'ACTIVE', 'APPLIED', 'COMPLETED'] },
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          totalPoints: true,
          repProfile: { select: { slug: true, verified: true } },
        },
      },
      campaign: { select: { id: true, title: true } },
    },
    take: 200,
  });

  const userIds = [...new Set(apps.map((a) => a.userId))];
  const [dials, payoutsByRep, meetingsByCreator, lastCalls] = await Promise.all([
    userIds.length
      ? prisma.callLog.groupBy({
          by: ['userId'],
          where: { brandId: brand.id, userId: { in: userIds } },
          _count: { _all: true },
          _avg: { duration: true },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.campaignPayout.groupBy({
          by: ['repUserId'],
          where: {
            campaign: { brandId: brand.id },
            repUserId: { in: userIds },
          },
          _sum: { grossCents: true, netCents: true },
          _count: true,
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.calendarBooking.groupBy({
          by: ['createdByUserId'],
          where: {
            brandId: brand.id,
            createdByUserId: { in: userIds },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.callLog.findMany({
          where: { brandId: brand.id, userId: { in: userIds } },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { userId: true, status: true, outcome: true },
        })
      : Promise.resolve([]),
  ]);

  const dialMap = Object.fromEntries(
    dials.map((d) => [
      d.userId,
      {
        count: d._count._all,
        avgDuration: d._avg.duration,
        lastAt: d._max.createdAt,
      },
    ])
  );
  const payMap = Object.fromEntries(
    payoutsByRep.map((p) => [
      p.repUserId,
      {
        count: p._count,
        gross: p._sum.grossCents || 0,
        net: p._sum.netCents || 0,
      },
    ])
  );
  const meetMap = Object.fromEntries(
    meetingsByCreator.map((m) => [m.createdByUserId, m._count._all])
  );

  const completedByUser: Record<string, number> = {};
  for (const c of lastCalls) {
    if (c.status === 'completed') {
      completedByUser[c.userId] = (completedByUser[c.userId] || 0) + 1;
    }
  }

  type RepRow = {
    userId: string;
    name: string;
    slug: string | null;
    verified: boolean;
    points: number;
    campaigns: number;
    dials: number;
    completed: number;
    meetings: number;
    payouts: number;
    payoutCents: number;
    avgDuration: number | null;
    lastAt: Date | null;
    statuses: string[];
  };

  const byRep = new Map<string, RepRow>();
  for (const a of apps) {
    const cur =
      byRep.get(a.userId) ||
      ({
        userId: a.userId,
        name: a.user.displayName || 'Rep',
        slug: a.user.repProfile?.slug || null,
        verified: Boolean(a.user.repProfile?.verified),
        points: a.user.totalPoints || 0,
        campaigns: 0,
        dials: dialMap[a.userId]?.count || 0,
        completed: completedByUser[a.userId] || 0,
        meetings: meetMap[a.userId] || 0,
        payouts: payMap[a.userId]?.count || 0,
        payoutCents: payMap[a.userId]?.gross || 0,
        avgDuration: dialMap[a.userId]?.avgDuration ?? null,
        lastAt: dialMap[a.userId]?.lastAt ?? null,
        statuses: [],
      } satisfies RepRow);
    cur.campaigns += 1;
    if (!cur.statuses.includes(a.status)) cur.statuses.push(a.status);
    byRep.set(a.userId, cur);
  }

  const perSdr = [...byRep.values()].sort((a, b) => {
    if (b.dials !== a.dials) return b.dials - a.dials;
    if (b.meetings !== a.meetings) return b.meetings - a.meetings;
    return b.payoutCents - a.payoutCents;
  });
  const maxDials = Math.max(1, ...perSdr.map((r) => r.dials));

  // 7-day dial volume
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      count: 0,
    });
  }
  const dayIndex = Object.fromEntries(days.map((d, i) => [d.key, i]));
  for (const c of callsWeek) {
    const k = dayKey(new Date(c.createdAt));
    const idx = dayIndex[k];
    if (idx != null) days[idx].count += 1;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const connectRate = pct(completedCalls, callCount);
  const acceptRate = pct(activeApps, appCount);
  const bookRate = pct(bookings, Math.max(completedCalls, 1));
  const avgSecs = avgDuration._avg.duration
    ? Math.round(avgDuration._avg.duration)
    : null;
  const avgLabel =
    avgSecs != null
      ? avgSecs >= 60
        ? `${Math.floor(avgSecs / 60)}m ${avgSecs % 60}s`
        : `${avgSecs}s`
      : '—';

  const key = brandPathKey(brand);
  const empty = campaignCount === 0 && callCount === 0 && appCount === 0;

  const pipeline = [
    { label: 'Applied', value: pendingApps, href: brandHref(brand, 'sdrs', 'applications') },
    { label: 'Active', value: activeApps, href: brandHref(brand, 'sdrs', 'team') },
    { label: 'Rejected', value: rejectedApps, href: brandHref(brand, 'sdrs', 'applications') },
  ];
  const pipeMax = Math.max(1, ...pipeline.map((p) => p.value));

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="SDR stats"
        description="Pipeline health, dial volume, and per-rep scorecards for this brand."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={brandHref(brand, 'sdrs', 'applications')} className="btn-ghost">
              Applications
            </Link>
            <Link href={brandHref(brand, 'sdrs', 'team')} className="btn">
              Team →
            </Link>
          </div>
        }
      />

      <BrandSdrStatsClient brandKey={key} liveChildren={empty ? (
        <BrandSdrStatsEmptyLive brandKey={key} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Open campaigns" value={openCount} tone="accent" />
            <Stat label="Pending apps" value={pendingApps} tone={pendingApps > 0 ? 'warn' : undefined} />
            <Stat label="Active SDRs" value={activeApps} tone="good" />
            <Stat label="Leads" value={leadCount} />
            <Stat label="Calls today" value={callsToday} tone="accent" />
            <Stat label="Meetings" value={bookings} tone={bookings > 0 ? 'good' : undefined} />
            <Stat
              label="Paid out"
              value={formatPayout(payoutAgg._sum.grossCents || 0)}
            />
            <Stat label="Connect rate" value={connectRate} />
          </StatGrid>

          <div className="sdr-stats__split">
            <Panel
              title="Hiring pipeline"
              description={`${acceptRate} of applicants are active · ${rejectedApps} rejected`}
              actions={
                <Link href={brandHref(brand, 'sdrs', 'applications')} className="soft-link">
                  Review →
                </Link>
              }
            >
              <div className="sdr-stats__pipeline">
                {pipeline.map((p) => (
                  <Link key={p.label} href={p.href} className="sdr-stats__pipe">
                    <span className="sdr-stats__pipe-label">{p.label}</span>
                    <span className="sdr-stats__pipe-value">{p.value}</span>
                    <span className="sdr-stats__pipe-track" aria-hidden>
                      <span
                        className="sdr-stats__pipe-fill"
                        style={{ width: `${Math.max(8, (p.value / pipeMax) * 100)}%` }}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel
              title="Dial volume · 7 days"
              description={`${callsWeek.length} calls · avg talk ${avgLabel} · book rate ${bookRate}`}
              actions={
                <Link href={brandHref(brand, 'calls')} className="soft-link">
                  Live board →
                </Link>
              }
            >
              <div className="sdr-stats__bars" role="img" aria-label="Calls per day last 7 days">
                {days.map((d) => (
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
            description={
              perSdr.length
                ? `${perSdr.length} rep${perSdr.length === 1 ? '' : 's'} · ranked by dials`
                : 'Accept applicants to unlock scorecards'
            }
            actions={
              <Link href={brandHref(brand, 'sdrs', 'payouts')} className="soft-link">
                Payouts →
              </Link>
            }
          >
            {perSdr.length === 0 ? (
              <EmptyState
                title="No active SDRs"
                description="Accept applicants from Applications to see dials, meetings, and payouts per rep."
                action={
                  <Link
                    href={brandHref(brand, 'sdrs', 'applications')}
                    className="btn"
                    style={{ marginTop: '1rem' }}
                  >
                    Applications
                  </Link>
                }
              />
            ) : (
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
                    {perSdr.map((r, i) => (
                      <tr key={r.userId}>
                        <td>
                          <div className="sdr-stats__name-cell">
                            <span className="sdr-stats__rank" data-top={i < 3 ? String(i + 1) : undefined}>
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
                                {r.avgDuration
                                  ? ` · avg ${Math.round(r.avgDuration)}s`
                                  : ''}
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
                          {r.lastAt ? r.lastAt.toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {r.slug ? (
                            <Link href={`/r/${r.slug}`} className="soft-link">
                              Profile
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '-0.25rem' }}>
            Totals: {campaignCount} campaigns · {appCount} applications · {callCount} calls ·{' '}
            <Link href={`/brands/${key}/calls`} className="soft-link">
              open live calls
            </Link>
          </p>
        </>
      )} />
    </main>
  );
}
