import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const viewer = await requireUser();
    const { slug } = await params;
    const rep = await prisma.repProfile.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            totalPoints: true,
            currentStreak: true,
            longestStreak: true,
            badges: true,
            hiringBoardOptIn: true,
            hiringHeadline: true,
            hiringBio: true,
            plan: true,
            platformRole: true,
            certifications: {
              include: { brand: { select: { name: true, slug: true } } },
              take: 12,
              orderBy: { score: 'desc' },
            },
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 40,
              select: {
                id: true,
                overallScore: true,
                focusArea: true,
                duration: true,
                pointsEarned: true,
                integrityFlags: true,
                createdAt: true,
              },
            },
            tournamentEntries: {
              orderBy: { score: 'desc' },
              take: 5,
              include: { tournament: { select: { name: true, active: true } } },
            },
          },
        },
      },
    });
    if (!rep) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let badges: string[] = [];
    try {
      badges = JSON.parse(rep.user.badges || '[]');
    } catch {
      badges = [];
    }

    const cleanSessions = rep.user.sessions.filter(
      (s) => !hasBlockingIntegrity(s.integrityFlags)
    );
    const avgClean = cleanSessions.length
      ? Math.round(
          cleanSessions.reduce((a, s) => a + s.overallScore, 0) / cleanSessions.length
        )
      : 0;
    const bestScore = cleanSessions.reduce((m, s) => Math.max(m, s.overallScore), 0);
    const focusCounts = new Map<string, number>();
    for (const s of cleanSessions) {
      focusCounts.set(s.focusArea, (focusCounts.get(s.focusArea) || 0) + 1);
    }
    const topFocus = [...focusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

    const achievements: { label: string; detail: string }[] = [];
    if (rep.verified) achievements.push({ label: 'Verified Rep', detail: 'Clean high-score practice verified' });
    if (bestScore >= 90) achievements.push({ label: '90+ Closer', detail: `Best clean score ${bestScore}` });
    if (rep.user.currentStreak >= 7)
      achievements.push({ label: 'Week Streak', detail: `${rep.user.currentStreak}-day streak` });
    if (rep.user.totalPoints >= 1000)
      achievements.push({ label: 'Point Grinder', detail: `${rep.user.totalPoints} career points` });
    for (const c of rep.user.certifications.slice(0, 5)) {
      achievements.push({
        label: c.label,
        detail: `${c.brand.name} · score ${c.score}`,
      });
    }
    for (const b of badges.slice(0, 6)) {
      achievements.push({ label: b, detail: 'Badge earned in practice' });
    }

    let featuredIds: string[] = [];
    try {
      featuredIds = JSON.parse(rep.featuredClipIdsJSON || '[]');
    } catch {
      featuredIds = [];
    }
    featuredIds = featuredIds.filter((id) => typeof id === 'string' && id).slice(0, 3);

    let featuredCalls: {
      id: string;
      title: string | null;
      mediaSrc: string | null;
      durationSec: number | null;
      overallScore: number | null;
      focusArea: string | null;
      strengths: string[];
    }[] = [];

    // Prefer curated featured clips; fall back to /h/{id} URLs in clipUrls.
    if (!featuredIds.length) {
      try {
        const urls: string[] = JSON.parse(rep.clipUrlsJSON || '[]');
        for (const url of urls) {
          const m = String(url).match(/\/h\/([a-z0-9]+)/i);
          if (m?.[1] && !featuredIds.includes(m[1])) featuredIds.push(m[1]);
          if (featuredIds.length >= 3) break;
        }
      } catch {
        /* ignore */
      }
    }

    if (featuredIds.length) {
      const clips = await prisma.clip.findMany({
        where: {
          userId: rep.userId,
          id: { in: featuredIds },
          status: 'ready',
        },
        select: {
          id: true,
          title: true,
          mediaUrl: true,
          r2Key: true,
          durationSec: true,
          session: {
            select: {
              overallScore: true,
              focusArea: true,
              scorecardJSON: true,
            },
          },
        },
      });
      const byId = new Map(clips.map((c) => [c.id, c]));
      featuredCalls = featuredIds
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => {
          let strengths: string[] = [];
          try {
            const card = JSON.parse(c.session?.scorecardJSON || '{}');
            const raw = card?.feedback?.strengths;
            if (Array.isArray(raw)) {
              strengths = raw.map(String).filter(Boolean).slice(0, 3);
            }
          } catch {
            strengths = [];
          }
          if (strengths.length === 0) {
            const score = c.session?.overallScore;
            strengths = [
              score != null ? `Scored ${score}/100 on this practice call` : 'Completed a scored practice call',
              c.session?.focusArea
                ? `Strong work in ${c.session.focusArea.replace(/_/g, ' ')}`
                : 'Kept the conversation moving',
              'Worth a listen before you hire',
            ].slice(0, 3);
          }
          return {
            id: c.id,
            title: c.title,
            mediaSrc: c.r2Key ? `/api/clips/media?clipId=${c.id}` : null,
            durationSec: c.durationSec,
            overallScore: c.session?.overallScore ?? null,
            focusArea: c.session?.focusArea ?? null,
            strengths,
          };
        });
    }

    const viewerRole = (await import('@/lib/roles')).effectiveRole(viewer);
    const canSwipe =
      viewerRole === 'BRAND' || viewerRole === 'RECRUITER' || viewerRole === 'SUPERADMIN';
    let myInterest: 'interested' | 'passed' | null = null;
    if (canSwipe) {
      const mine = await prisma.talentInterest.findUnique({
        where: {
          fromUserId_toUserId: { fromUserId: viewer.id, toUserId: rep.userId },
        },
        select: { status: true },
      });
      myInterest =
        mine?.status === 'interested' || mine?.status === 'passed'
          ? (mine.status as 'interested' | 'passed')
          : null;
    }
    const interestCount = await prisma.talentInterest.count({
      where: { toUserId: rep.userId, status: 'interested' },
    });

    let avatarUrl = rep.user.avatarUrl || null;
    if (!avatarUrl) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(rep.userId);
        avatarUrl = clerkUser.imageUrl || null;
      } catch {
        /* keep null — initials fallback */
      }
    }

    const scoreSeries = [...cleanSessions]
      .slice(0, 14)
      .reverse()
      .map((s) => ({
        id: s.id,
        score: s.overallScore,
        focus: s.focusArea,
        at: s.createdAt.toISOString(),
      }));

    return NextResponse.json({
      slug: rep.slug,
      bio: rep.bio || null,
      experience: rep.user.hiringBio || null,
      skills: JSON.parse(rep.skillsJSON || '[]'),
      featuredCalls,
      verified: rep.verified,
      displayName: rep.user.displayName,
      avatarUrl,
      headline: rep.user.hiringHeadline,
      openToWork: Boolean(rep.user.hiringBoardOptIn),
      plan: rep.user.plan,
      role: rep.user.platformRole,
      userId: rep.userId,
      totalPoints: rep.user.totalPoints,
      currentStreak: rep.user.currentStreak,
      longestStreak: rep.user.longestStreak,
      badges,
      viewer: {
        canSwipe,
        myInterest,
        interestCount,
        isSelf: viewer.id === rep.userId,
      },
      stats: {
        cleanSessions: cleanSessions.length,
        avgCleanScore: avgClean,
        bestScore,
        topFocus: topFocus.map(([focus, count]) => ({ focus, count })),
        scoreSeries,
      },
      achievements,
      recentSessions: cleanSessions.slice(0, 8).map((s) => ({
        id: s.id,
        overallScore: s.overallScore,
        focusArea: s.focusArea,
        duration: s.duration,
        createdAt: s.createdAt,
      })),
      tournaments: rep.user.tournamentEntries.map((e) => ({
        name: e.tournament.name,
        score: e.score,
        active: e.tournament.active,
      })),
      certifications: rep.user.certifications.map((c) => ({
        label: c.label,
        score: c.score,
        brand: c.brand.name,
        brandSlug: c.brand.slug,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
