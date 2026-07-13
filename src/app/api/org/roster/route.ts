import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isOrgAdminForProfile } from '@/lib/plans';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

/** Org-admin roster: members in the caller's Clerk org only. */
export async function GET() {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json(
        {
          error: 'Join or create a Clerk organization to view the team roster.',
          code: 'ORG_REQUIRED',
        },
        { status: 400 }
      );
    }
    if (!(await isOrgAdminForProfile(profile))) {
      return NextResponse.json(
        { error: 'Org admin access required.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const orgId = profile.orgId;
    const members = await prisma.userProfile.findMany({
      where: { orgId },
      orderBy: [{ totalPoints: 'desc' }, { displayName: 'asc' }],
      select: {
        id: true,
        email: true,
        displayName: true,
        platformRole: true,
        plan: true,
        minutesRemaining: true,
        minutesUsed: true,
        totalPoints: true,
        currentStreak: true,
        lastSessionDate: true,
        repProfile: { select: { slug: true, verified: true } },
        academyMemberships: {
          where: { academy: { orgId } },
          select: { role: true, academy: { select: { name: true, slug: true } } },
          take: 1,
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            overallScore: true,
            focusArea: true,
            duration: true,
            createdAt: true,
            integrityFlags: true,
          },
        },
        clips: {
          where: { status: 'ready' },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            title: true,
            mediaUrl: true,
            durationSec: true,
            sessionId: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            clips: { where: { status: 'ready' } },
          },
        },
      },
    });

    const pool = await prisma.orgMinutePool.findUnique({
      where: { orgId },
      select: { minutesRemaining: true, minutesUsed: true },
    });

    const roster = members.map((m) => {
      const clean = m.sessions.filter((s) => !hasBlockingIntegrity(s.integrityFlags));
      const avgScore = clean.length
        ? Math.round(clean.reduce((a, s) => a + s.overallScore, 0) / clean.length)
        : null;
      const academy = m.academyMemberships[0];
      return {
        id: m.id,
        email: m.email,
        displayName: m.displayName || m.email || 'Rep',
        platformRole: m.platformRole,
        plan: m.plan,
        minutesRemaining: m.minutesRemaining,
        minutesUsed: m.minutesUsed,
        totalPoints: m.totalPoints,
        currentStreak: m.currentStreak,
        lastSessionDate: m.lastSessionDate,
        profileSlug: m.repProfile?.slug || null,
        verified: m.repProfile?.verified || false,
        academyRole: academy?.role || null,
        academySlug: academy?.academy.slug || null,
        sessionCount: m._count.sessions,
        clipCount: m._count.clips,
        avgScore,
        recentSessions: clean.slice(0, 5).map((s) => ({
          id: s.id,
          overallScore: s.overallScore,
          focusArea: s.focusArea,
          duration: s.duration,
          createdAt: s.createdAt,
        })),
        clips: m.clips.map((c) => ({
          id: c.id,
          title: c.title,
          mediaUrl: c.mediaUrl,
          durationSec: c.durationSec,
          sessionId: c.sessionId,
          highlightUrl: `/h/${c.id}`,
          createdAt: c.createdAt,
        })),
      };
    });

    return NextResponse.json({
      orgId,
      poolMinutesRemaining: pool?.minutesRemaining ?? null,
      poolMinutesUsed: pool?.minutesUsed ?? null,
      memberCount: roster.length,
      members: roster,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
