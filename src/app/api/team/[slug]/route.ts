import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

/** Public team page — LinkedIn-lite for orgs. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const academy = await prisma.academy.findUnique({
      where: { slug },
      include: {
        members: {
          take: 40,
          include: {
            user: {
              select: {
                displayName: true,
                totalPoints: true,
                currentStreak: true,
                hiringBoardOptIn: true,
                hiringHeadline: true,
                badges: true,
                repProfile: { select: { slug: true, verified: true } },
                sessions: {
                  take: 10,
                  orderBy: { createdAt: 'desc' },
                  select: { overallScore: true, integrityFlags: true },
                },
              },
            },
          },
        },
        curricula: { orderBy: { sortOrder: 'asc' }, take: 10 },
      },
    });
    if (!academy) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const members = academy.members.map((m) => {
      const clean = m.user.sessions.filter((s) => !hasBlockingIntegrity(s.integrityFlags));
      const avg = clean.length
        ? Math.round(clean.reduce((a, s) => a + s.overallScore, 0) / clean.length)
        : 0;
      let badges: string[] = [];
      try {
        badges = JSON.parse(m.user.badges || '[]');
      } catch {
        badges = [];
      }
      return {
        role: m.role,
        displayName: m.user.displayName,
        headline: m.user.hiringHeadline,
        openToWork: m.user.hiringBoardOptIn,
        totalPoints: m.user.totalPoints,
        streak: m.user.currentStreak,
        avgCleanScore: avg,
        verified: m.user.repProfile?.verified || false,
        profileSlug: m.user.repProfile?.slug || null,
        badges: badges.slice(0, 4),
      };
    });

    const teamPoints = members.reduce((a, m) => a + m.totalPoints, 0);
    const openCount = members.filter((m) => m.openToWork).length;
    const pool = await prisma.orgMinutePool.findUnique({
      where: { orgId: academy.orgId },
      select: { minutesRemaining: true },
    });

    return NextResponse.json({
      slug: academy.slug,
      name: academy.name,
      description: academy.description,
      publicBio: academy.publicBio,
      openToHire: academy.openToHire,
      websiteUrl: academy.websiteUrl,
      stats: {
        members: members.length,
        teamPoints,
        openToWork: openCount,
        poolMinutes: pool?.minutesRemaining ?? null,
      },
      curricula: academy.curricula.map((c) => ({
        title: c.title,
        focusAreas: JSON.parse(c.focusAreas || '[]'),
      })),
      members: members.sort((a, b) => b.totalPoints - a.totalPoints),
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
