import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Compute curriculum progress from TrainerSession focus areas. */
export async function GET() {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json({ progress: [] });
    }

    const academy = await prisma.academy.findFirst({
      where: { orgId: profile.orgId },
      include: { curricula: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!academy) return NextResponse.json({ progress: [] });

    // Auto-join org members
    await prisma.academyMember.upsert({
      where: { academyId_userId: { academyId: academy.id, userId: profile.id } },
      create: { academyId: academy.id, userId: profile.id, role: 'member' },
      update: {},
    });

    const sessions = await prisma.trainerSession.findMany({
      where: { userId: profile.id },
      select: { focusArea: true, overallScore: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    const progress = academy.curricula.map((c) => {
      let focusAreas: string[] = [];
      try {
        focusAreas = JSON.parse(c.focusAreas || '[]');
      } catch {
        focusAreas = [];
      }
      const matching = sessions.filter((s) => focusAreas.includes(s.focusArea));
      const bestScore = matching.reduce((m, s) => Math.max(m, s.overallScore), 0);
      const complete = focusAreas.length > 0 && focusAreas.every((fa) => {
        const best = sessions
          .filter((s) => s.focusArea === fa)
          .reduce((m, s) => Math.max(m, s.overallScore), 0);
        return best >= 75;
      });

      return {
        curriculumId: c.id,
        title: c.title,
        focusAreas,
        sessions: matching.length,
        bestScore,
        complete,
      };
    });

    const progressMap = Object.fromEntries(
      progress.map((p) => [
        p.curriculumId,
        { sessions: p.sessions, bestScore: p.bestScore, complete: p.complete },
      ])
    );

    await prisma.academyMember.update({
      where: { academyId_userId: { academyId: academy.id, userId: profile.id } },
      data: { progressJSON: JSON.stringify(progressMap) },
    });

    return NextResponse.json({ progress, academyId: academy.id });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
