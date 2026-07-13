import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveProspectAccess } from '@/lib/prospect-access';

type Ctx = { params: Promise<{ id: string }> };

/** GET — calls + practice sessions for the lead detail Call Log tab.
 * Brand managers / superadmin see all reps; everyone else sees only their own. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const brandWide = access.via === 'brand' || access.via === 'superadmin';
    const callWhere = brandWide
      ? { prospectId: id }
      : { prospectId: id, userId: profile.id };
    const sessionWhere = brandWide
      ? { prospectId: id }
      : { prospectId: id, userId: profile.id };

    const [calls, sessions] = await Promise.all([
      prisma.callLog.findMany({
        where: callWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          direction: true,
          status: true,
          duration: true,
          outcome: true,
          notes: true,
          toNumber: true,
          fromNumber: true,
          createdAt: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
      prisma.trainerSession.findMany({
        where: sessionWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          overallScore: true,
          duration: true,
          focusArea: true,
          difficulty: true,
          scenarioType: true,
          pointsEarned: true,
          outcome: true,
          wrapNotes: true,
          createdAt: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      scope: brandWide ? 'brand' : 'rep',
      calls: calls.map((c) => ({
        id: c.id,
        kind: 'live' as const,
        direction: c.direction,
        status: c.status,
        duration: c.duration,
        outcome: c.outcome,
        notes: c.notes,
        toNumber: c.toNumber,
        fromNumber: c.fromNumber,
        createdAt: c.createdAt.toISOString(),
        repName: c.user?.displayName || c.user?.email || 'Rep',
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        kind: 'practice' as const,
        overallScore: s.overallScore,
        duration: s.duration,
        focusArea: s.focusArea,
        scenarioType: s.scenarioType,
        difficulty: s.difficulty,
        pointsEarned: s.pointsEarned,
        outcome: s.outcome,
        notes: s.wrapNotes,
        createdAt: s.createdAt.toISOString(),
        repName: s.user?.displayName || s.user?.email || 'Rep',
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
