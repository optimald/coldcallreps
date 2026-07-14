import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { loadBrandPortfolio } from '@/lib/brand-portfolio';
import { prisma } from '@/lib/prisma';
import { getMinuteBalance } from '@/lib/minutes';
import { loadTrainerLeaderboard } from '@/lib/trainer-leaderboard';
import { formatDuration, formatSessionDate, scoreColor } from '@/lib/trainer/session-utils';
import { FOCUS_LABELS } from '@/lib/product';
import PortfolioHomeClient from '@/components/PortfolioHomeClient';
import CheckoutSuccessBanner from '@/components/CheckoutSuccessBanner';
import LeaderboardPanel from '@/components/LeaderboardPanel';
import {
  SdrEarningsVelocityChart,
  SdrObjectionDonut,
  SdrRankTrackChart,
  SdrVitalsStrip,
} from '@/components/SdrVitalsDesk';
import { loadSdrVitals } from '@/lib/sdr-vitals';
import { buildDemoPortfolio } from '@/lib/demo/brand-demo-data';
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

  // Superadmin home is the platform command center, not the personal practice desk.
  if (role === 'SUPERADMIN') {
    redirect('/admin');
  }

  const isSdr = role === 'REP';
  const isBrand = role === 'BRAND' || role === 'RECRUITER';
  const isManager = role === 'MANAGER';

  const greetingName = profile.displayName || ROLE_LABELS[role] || 'there';

  if (isBrand) {
    const { cookies } = await import('next/headers');
    const { BRAND_DESK_MODE_COOKIE } = await import('@/lib/brand-context');
    const deskCookie = (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value;
    const initialDeskMode = deskCookie === 'demo' ? 'demo' : 'live';
    const [brands, initialPortfolio] = await Promise.all([
      prisma.brand.findMany({
        where: { ownerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, slug: true, name: true, logoUrl: true },
      }),
      initialDeskMode === 'live'
        ? loadBrandPortfolio(profile)
        : Promise.resolve(buildDemoPortfolio()),
    ]);
    return (
      <>
        <Suspense fallback={null}>
          <CheckoutSuccessBanner />
        </Suspense>
        <PortfolioHomeClient
          greetingName={greetingName}
          initialBrands={brands}
          initialDeskMode={initialDeskMode}
          initialPortfolio={initialPortfolio}
        />
      </>
    );
  }

  const [sessions, rep, minuteBalance, leaderboardData, sdrVitals] =
    await Promise.all([
      prisma.trainerSession.findMany({
        where: { userId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { prospect: { select: { companyName: true } } },
      }),
      prisma.repProfile.findUnique({ where: { userId: profile.id } }),
      getMinuteBalance(profile),
      isSdr
        ? loadTrainerLeaderboard({
            limit: 8,
            period: 'week',
            scope: 'global',
            orgId: profile.orgId,
          })
        : Promise.resolve({ leaderboard: [] }),
      isSdr ? loadSdrVitals(profile) : Promise.resolve(null),
    ]);

  let pendingCents = 0;
  if (isSdr) {
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

  const rosterCount = isManager
    ? profile.orgId
      ? await prisma.userProfile.count({ where: { orgId: profile.orgId } })
      : 0
    : 0;

  const minutesLabel = minuteBalance.available;

  // ─── REP / SDR athlete desk (vital KPIs · above the fold) ───────────
  if (isSdr && sdrVitals) {
    return (
      <main className="app-page app-page--desk dashboard-page sdr-home">
        <Suspense fallback={null}>
          <CheckoutSuccessBanner />
        </Suspense>

        <PageHeader
          compact
          eyebrow={ROLE_LABELS[role]}
          title={`Hey ${greetingName}`}
          description={
            rep?.slug
              ? `/${rep.slug} · dial, convert, get paid`
              : 'Dial, convert, get paid'
          }
          actions={
            <div className="sdr-home__actions">
              {(pendingCents > 0 || profile.hiringBoardOptIn || badges.length > 0) && (
                <div className="badge-row sdr-home__chips">
                  {pendingCents > 0 && (
                    <Link href="/earnings" className="chip chip--warn">
                      ${(pendingCents / 100).toFixed(0)} pending
                    </Link>
                  )}
                  {profile.hiringBoardOptIn && <span className="chip">Open to work</span>}
                  {badges.slice(0, 2).map((b) => (
                    <span key={b} className="chip">
                      {b}
                    </span>
                  ))}
                </div>
              )}
              <Link href="/cold_calls" className="btn">
                Dial
              </Link>
              <Link href="/practice" className="btn-ghost">
                Practice
              </Link>
            </div>
          }
        />

        <SdrVitalsStrip vitals={sdrVitals} />

        <div className="sdr-desk">
          <Panel
            compact
            className="sdr-desk__cell"
            title="Earnings velocity"
            description="Cumulative · dashed = run-rate"
          >
            <SdrEarningsVelocityChart vitals={sdrVitals} height={108} />
          </Panel>
          <Panel
            compact
            className="sdr-desk__cell"
            title="Objections"
            description="Why dials die"
            actions={
              <Link href="/practice" className="soft-link">
                Practice →
              </Link>
            }
          >
            <SdrObjectionDonut vitals={sdrVitals} size={96} compact />
          </Panel>
          <Panel
            compact
            className="sdr-desk__cell"
            title="Rank track"
            description="Trailing 14 days"
            actions={
              <Link href="/practice" className="btn-ghost btn--sm">
                Climb
              </Link>
            }
          >
            <SdrRankTrackChart vitals={sdrVitals} height={100} />
          </Panel>
          <aside className="sdr-desk__cell sdr-desk__board">
            <LeaderboardPanel
              compact
              limit={5}
              initialRows={leaderboardData.leaderboard}
              initialOrgId={profile.orgId}
            />
          </aside>
        </div>
      </main>
    );
  }

  // ─── Manager desk ───────────────────────────────────────────────────
  return (
    <main className="app-page">
      <Suspense fallback={null}>
        <CheckoutSuccessBanner />
      </Suspense>

      <PageHeader
        eyebrow={ROLE_LABELS[role]}
        title={`Hey ${greetingName}`}
        description="Desk overview — roster, academy, and team campaigns."
        actions={
          <Link href="/team" className="btn">
            Team roster
          </Link>
        }
      />

      <StatGrid>
        <Stat label="Roster" value={rosterCount} tone="accent" />
        <Stat label="Minutes" value={minutesLabel} />
        <Stat label="Streak" value={`${profile.currentStreak}d`} />
        <Stat label="Points" value={profile.totalPoints} />
      </StatGrid>

      <div className="page-grid" style={{ marginBottom: '1.15rem' }}>
        <Panel title="Team" description="Org roster and academy.">
          <div className="stack">
            <SoftLink href="/team">
              {profile.orgId
                ? `${rosterCount} member${rosterCount === 1 ? '' : 's'} on roster`
                : 'Create or join a Clerk org to unlock roster'}
            </SoftLink>
            <SoftLink href="/academy">Academy curricula</SoftLink>
            <SoftLink href="/campaigns">Team campaigns</SoftLink>
            <SoftLink href="/practice">Playbooks</SoftLink>
          </div>
        </Panel>
      </div>

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
                    {formatSessionDate(s.createdAt.toISOString())} ·{' '}
                    {formatDuration(s.duration)} · +{s.pointsEarned} pts
                  </div>
                </div>
                <span
                  className="session-row__score"
                  style={{ color: scoreColor(s.overallScore) }}
                >
                  {s.overallScore}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </main>
  );
}
