import { Suspense } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMinuteBalance } from '@/lib/minutes';
import { formatDuration, formatSessionDate, scoreColor } from '@/lib/trainer/session-utils';
import { FOCUS_LABELS } from '@/lib/product';
import CheckoutSuccessBanner from '@/components/CheckoutSuccessBanner';
import LeaderboardPanel from '@/components/LeaderboardPanel';
import ScoreTrendChart from '@/components/ScoreTrendChart';
import { effectiveRole, ROLE_LABELS } from '@/lib/roles';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

export default async function DashboardPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);

  const isSdr = role === 'REP';
  const isBrand = role === 'BRAND' || role === 'RECRUITER';
  const isManager = role === 'MANAGER';
  const isAdmin = role === 'SUPERADMIN';
  const isRepDesk = isSdr || isAdmin;

  const [sessions, rep, minuteBalance, rankAhead] = await Promise.all([
    prisma.trainerSession.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { prospect: { select: { companyName: true } } },
    }),
    prisma.repProfile.findUnique({ where: { userId: profile.id } }),
    getMinuteBalance(profile),
    isRepDesk
      ? prisma.userProfile.count({
          where: { totalPoints: { gt: profile.totalPoints } },
        })
      : Promise.resolve(0),
  ]);

  const rank = isRepDesk ? rankAhead + 1 : null;

  let pendingCents = 0;
  if (isRepDesk) {
    try {
      const pending = await prisma.campaignPayout.aggregate({
        where: { repUserId: profile.id, status: 'PENDING' },
        _sum: { netCents: true },
      });
      pendingCents = pending._sum.netCents ?? 0;
    } catch {
      pendingCents = 0;
    }
  }

  let badges: string[] = [];
  try {
    badges = JSON.parse(profile.badges || '[]');
  } catch {
    badges = [];
  }

  const avgScore =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / sessions.length)
      : null;

  const ownedBrands =
    isBrand || isAdmin
      ? await prisma.brand.findMany({
          where: role === 'SUPERADMIN' ? {} : { ownerId: profile.id },
          take: 20,
          select: { id: true, name: true },
        })
      : [];
  const brandIds = ownedBrands.map((b) => b.id);

  const brandCampaigns =
    brandIds.length > 0
      ? await prisma.campaign.findMany({
          where: { brandId: { in: brandIds } },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          include: {
            _count: { select: { applications: true } },
          },
        })
      : [];

  const recentLeadApps =
    brandIds.length > 0
      ? await prisma.campaignApplication.findMany({
          where: { campaign: { brandId: { in: brandIds } } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            user: { select: { displayName: true } },
            campaign: { select: { id: true, title: true } },
          },
        })
      : [];

  const rosterCount =
    isManager || isAdmin
      ? profile.orgId
        ? await prisma.userProfile.count({ where: { orgId: profile.orgId } })
        : 0
      : 0;

  const openCampaigns = brandCampaigns.filter((c) => c.status === 'OPEN' || c.status === 'PAUSED');
  const budgetRemainingCents = brandCampaigns.reduce((sum, c) => {
    if (c.budgetCents == null) return sum;
    return sum + Math.max(0, c.budgetCents);
  }, 0);

  const greetingName = profile.displayName || ROLE_LABELS[role] || 'there';
  const minutesLabel = minuteBalance.available;

  // ─── REP / SDR telemetry desk (primary) ─────────────────────────────
  if (isSdr) {
    return (
      <main className="app-page app-page--desk dashboard-page">
        <Suspense fallback={null}>
          <CheckoutSuccessBanner />
        </Suspense>

        <PageHeader
          compact
          eyebrow={ROLE_LABELS[role]}
          title={`Hey ${greetingName}`}
          description={
            rep?.slug
              ? `/${rep.slug} · train, take brand deals, deliver outbound.`
              : 'Train with AI, prove your skill, get paid on campaigns.'
          }
          actions={
            <Link href="/practice" className="btn">
              Practice
            </Link>
          }
        />

        <StatGrid>
          <Stat label="Minutes" value={minutesLabel} tone="accent" />
          <Stat label="Points" value={profile.totalPoints} />
          <Stat
            label="Streak"
            value={`${profile.currentStreak}d`}
            tone={profile.currentStreak > 0 ? 'good' : undefined}
          />
          <Stat
            label="Avg score"
            value={avgScore ?? '—'}
            tone={avgScore != null && avgScore >= 70 ? 'good' : avgScore != null ? 'warn' : undefined}
          />
          <Stat label="Rank" value={rank != null ? `#${rank}` : '—'} />
        </StatGrid>

        {(pendingCents > 0 ||
          badges.length > 0 ||
          rep?.slug ||
          profile.hiringBoardOptIn) && (
          <div className="badge-row dashboard-page__chips">
            {pendingCents > 0 && (
              <Link href="/earnings" className="chip chip--warn">
                ${(pendingCents / 100).toFixed(0)} pending
              </Link>
            )}
            {profile.hiringBoardOptIn && <span className="chip">Open to work</span>}
            {badges.slice(0, 3).map((b) => (
              <span key={b} className="chip">
                {b}
              </span>
            ))}
            {rep?.slug && (
              <>
                <SoftLink href={`/${rep.slug}`}>/{rep.slug}</SoftLink>
                <span className="muted">·</span>
                <SoftLink href="/hiring">Edit profile</SoftLink>
              </>
            )}
          </div>
        )}

        <div className="dash-desk">
          <section className="dash-desk__chart panel panel--compact">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Score trend</h2>
                <p className="panel__desc">Last {sessions.length || 12} practice sessions</p>
              </div>
              <div className="panel__actions">
                <Link href="/practice" className="btn-ghost btn--sm">
                  New session
                </Link>
              </div>
            </div>
            <ScoreTrendChart sessions={sessions} />
          </section>

          <aside className="dash-desk__board">
            <LeaderboardPanel compact limit={8} />
          </aside>

          <section className="dash-desk__recent panel panel--compact">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Recent calls</h2>
                <p className="panel__desc">Latest practice runs — open any scorecard</p>
              </div>
              <div className="panel__actions">
                <Link href="/practice" className="btn-ghost btn--sm">
                  Practice
                </Link>
              </div>
            </div>
            {sessions.length === 0 ? (
              <EmptyState
                title="No warm-ups yet"
                description="Run a few AI scenarios before your first campaign dial."
                action={
                  <Link href="/practice" className="btn" style={{ marginTop: '0.75rem' }}>
                    Start practice
                  </Link>
                }
              />
            ) : (
              <div className="dash-desk__scroll">
                <div className="stack dash-recent">
                  {sessions.map((s) => (
                    <Link key={s.id} href={`/sessions/${s.id}`} className="dash-recent__row">
                      <div className="dash-recent__main">
                        <div className="dash-recent__title">
                          {s.prospect?.companyName ||
                            (FOCUS_LABELS as Record<string, string>)[s.focusArea] ||
                            s.focusArea}
                        </div>
                        <div className="dash-recent__meta">
                          {formatSessionDate(s.createdAt.toISOString())} ·{' '}
                          {formatDuration(s.duration)} · +{s.pointsEarned} pts
                        </div>
                        <div className="dash-recent__bar" aria-hidden>
                          <span
                            className="dash-recent__bar-fill"
                            style={{
                              width: `${Math.max(4, Math.min(100, s.overallScore || 0))}%`,
                              background: scoreColor(s.overallScore),
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className="dash-recent__score"
                        style={{ color: scoreColor(s.overallScore) }}
                      >
                        {s.overallScore}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  // ─── Brand / Manager / Admin (non-REP desk) — functional, no link tiles ─
  return (
    <main className="app-page">
      <Suspense fallback={null}>
        <CheckoutSuccessBanner />
      </Suspense>

      <PageHeader
        eyebrow={ROLE_LABELS[role]}
        title={`Hey ${greetingName}`}
        description={
          isBrand
            ? 'Brand home — desk, campaigns, leads, and SDR roster under each brand.'
            : isManager
              ? 'Desk overview — roster, academy, and team campaigns.'
              : 'Ops overview — marketplace + practice signal.'
        }
        actions={
          isBrand ? (
            <Link href="/brands" className="btn">
              Brands
            </Link>
          ) : isManager ? (
            <Link href="/team" className="btn">
              Team roster
            </Link>
          ) : (
            <Link href="/practice" className="btn">
              Practice
            </Link>
          )
        }
      />

      {isBrand && (
        <StatGrid>
          <Stat label="Campaigns" value={brandCampaigns.length} tone="accent" />
          <Stat label="Open" value={openCampaigns.length} />
          <Stat label="Recent apps" value={recentLeadApps.length} />
          <Stat
            label="Budget"
            value={
              budgetRemainingCents > 0 ? `$${(budgetRemainingCents / 100).toFixed(0)}` : '—'
            }
          />
        </StatGrid>
      )}

      {isManager && (
        <StatGrid>
          <Stat label="Roster" value={rosterCount} tone="accent" />
          <Stat label="Minutes" value={minutesLabel} />
          <Stat label="Streak" value={`${profile.currentStreak}d`} />
          <Stat label="Points" value={profile.totalPoints} />
        </StatGrid>
      )}

      {isAdmin && (
        <StatGrid>
          <Stat label="Minutes" value={minutesLabel} tone="accent" />
          <Stat label="Points" value={profile.totalPoints} />
          <Stat label="Streak" value={`${profile.currentStreak}d`} />
          <Stat
            label="Avg score"
            value={avgScore ?? '—'}
            tone={avgScore != null && avgScore >= 70 ? 'good' : avgScore != null ? 'warn' : undefined}
          />
        </StatGrid>
      )}

      <div className="page-grid" style={{ marginBottom: '1.15rem' }}>
        {isBrand && (
          <>
            <Panel
              title="Campaigns"
              description={
                openCampaigns.length > 0
                  ? `${openCampaigns.length} open/paused · ${brandCampaigns.length} total`
                  : 'Post your first outbound campaign'
              }
              actions={
                <Link href="/campaigns" className="btn-ghost">
                  Manage
                </Link>
              }
            >
              {brandCampaigns.length === 0 ? (
                <EmptyState
                  title="No campaigns yet"
                  description="Create a campaign to start hiring SDRs."
                  action={
                    <Link href="/campaigns" className="btn" style={{ marginTop: '0.75rem' }}>
                      Open campaigns
                    </Link>
                  }
                />
              ) : (
                <div className="stack">
                  {brandCampaigns.slice(0, 6).map((c) => (
                    <Link key={c.id} href={`/campaigns/${c.id}`} className="session-row">
                      <div>
                        <div style={{ fontWeight: 650 }}>{c.title}</div>
                        <div className="session-row__meta">
                          {c.status} · {c._count.applications} apps
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Shortcuts" description="Brand desk links.">
              <div className="stack">
                <SoftLink href="/leads">Leads &amp; applications</SoftLink>
                <SoftLink href="/brands">Brand settings</SoftLink>
                <SoftLink href="/playbooks">Playbooks</SoftLink>
              </div>
            </Panel>
          </>
        )}

        {isManager && (
          <>
            <Panel title="Team" description="Org roster and academy.">
              <div className="stack">
                <SoftLink href="/team">
                  {profile.orgId
                    ? `${rosterCount} member${rosterCount === 1 ? '' : 's'} on roster`
                    : 'Create or join a Clerk org to unlock roster'}
                </SoftLink>
                <SoftLink href="/academy">Academy curricula</SoftLink>
                <SoftLink href="/campaigns">Team campaigns</SoftLink>
                <SoftLink href="/playbooks">Playbooks</SoftLink>
              </div>
            </Panel>
          </>
        )}
      </div>

      {isBrand && recentLeadApps.length > 0 && (
        <Panel
          title="Incoming SDR applications"
          description="Latest applicants across your campaigns."
          actions={
            <Link href="/leads" className="btn-ghost">
              All leads
            </Link>
          }
        >
          <div className="stack">
            {recentLeadApps.map((a) => (
              <Link key={a.id} href={`/campaigns/${a.campaign.id}`} className="session-row">
                <div>
                  <div style={{ fontWeight: 650 }}>{a.user.displayName || 'SDR'}</div>
                  <div className="session-row__meta">
                    {a.campaign.title} · {a.status}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {a.createdAt.toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {(isManager || isAdmin) && (
        <Panel
          title="Recent sessions"
          description="Your latest practice runs — open any scorecard to review."
          actions={
            <Link href="/practice" className="btn-ghost">
              New session
            </Link>
          }
        >
          {sessions.length === 0 ? (
            <EmptyState
              title="No warm-ups yet"
              description="Run a few AI scenarios before your first campaign dial."
              action={
                <Link href="/practice" className="btn" style={{ marginTop: '1rem' }}>
                  Start practice
                </Link>
              }
            />
          ) : (
            <div className="stack">
              {sessions.map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`} className="session-row">
                  <div>
                    <div style={{ fontWeight: 650 }}>
                      {s.prospect?.companyName ||
                        (FOCUS_LABELS as Record<string, string>)[s.focusArea] ||
                        s.focusArea}
                    </div>
                    <div className="session-row__meta">
                      {formatSessionDate(s.createdAt.toISOString())} · {formatDuration(s.duration)} · +
                      {s.pointsEarned} pts
                    </div>
                  </div>
                  <span className="session-row__score" style={{ color: scoreColor(s.overallScore) }}>
                    {s.overallScore}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {isAdmin && <LeaderboardPanel embedded limit={12} />}
    </main>
  );
}
