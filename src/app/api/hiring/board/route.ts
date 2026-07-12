import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

/** Public hiring board — opted-in profiles ranked by clean practice signal. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const verifiedOnly = searchParams.get('verified') === '1';

    const profiles = await prisma.userProfile.findMany({
      where: {
        hiringBoardOptIn: true,
        ...(verifiedOnly ? { repProfile: { verified: true } } : {}),
      },
      orderBy: { totalPoints: 'desc' },
      take: limit * 2,
      select: {
        displayName: true,
        hiringHeadline: true,
        hiringBio: true,
        totalPoints: true,
        currentStreak: true,
        badges: true,
        repProfile: { select: { slug: true, verified: true } },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { overallScore: true, integrityFlags: true, focusArea: true },
        },
      },
    });

    const mapped = profiles
      .map((p) => {
        let badges: string[] = [];
        try {
          badges = JSON.parse(p.badges || '[]');
        } catch {
          badges = [];
        }
        const clean = p.sessions.filter((s) => !hasBlockingIntegrity(s.integrityFlags));
        const avgClean = clean.length
          ? Math.round(clean.reduce((a, s) => a + s.overallScore, 0) / clean.length)
          : 0;
        const signalScore = Math.round(p.totalPoints * 0.4 + avgClean * 8 + clean.length * 15);
        return {
          displayName: p.displayName,
          hiringHeadline: p.hiringHeadline,
          hiringBio: p.hiringBio,
          totalPoints: p.totalPoints,
          currentStreak: p.currentStreak,
          badges,
          profileSlug: p.repProfile?.slug || null,
          verified: p.repProfile?.verified || false,
          openToWork: true,
          avgCleanScore: avgClean,
          cleanSessions: clean.length,
          signalScore,
          topFocus: clean[0]?.focusArea || null,
        };
      })
      .sort((a, b) => b.signalScore - a.signalScore)
      .slice(0, limit);

    return NextResponse.json({ profiles: mapped });
  } catch (error: any) {
    console.error('Hiring board error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
