import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { canManageBrand } from '@/lib/roles';

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const brandId = searchParams.get('brandId')?.trim() || '';
    const repId = searchParams.get('repId')?.trim() || '';

    let where: Record<string, unknown> = { userId: profile.id };

    if (brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: brandId },
        select: { id: true, ownerId: true },
      });
      if (!brand || !canManageBrand(profile, brand.ownerId)) {
        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      }
      where = { brandId: brand.id };
      if (repId) where = { ...where, userId: repId };
    }

    const sessions = await prisma.trainerSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        prospectId: true,
        brandId: true,
        packId: true,
        scenarioType: true,
        focusArea: true,
        difficulty: true,
        overallScore: true,
        pointsEarned: true,
        duration: true,
        createdAt: true,
        prospect: { select: { companyName: true } },
        user: { select: { displayName: true, email: true } },
        clips: {
          where: { status: 'ready' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    const brandIds = [
      ...new Set(sessions.map((s) => s.brandId).filter((id): id is string => Boolean(id))),
    ];
    const brands = brandIds.length
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

    const packIds = [
      ...new Set(sessions.map((s) => s.packId).filter((id): id is string => Boolean(id))),
    ];
    const playbooks = packIds.length
      ? await prisma.playbook.findMany({
          where: { id: { in: packIds } },
          select: { id: true, title: true },
        })
      : [];
    const packNameById = new Map(playbooks.map((p) => [p.id, p.title]));

    let featuredClipIds: string[] = [];
    if (!brandId) {
      const rep = await prisma.repProfile.findUnique({
        where: { userId: profile.id },
        select: { featuredClipIdsJSON: true },
      });
      try {
        featuredClipIds = JSON.parse(rep?.featuredClipIdsJSON || '[]');
      } catch {
        featuredClipIds = [];
      }
    }
    const featuredSet = new Set(Array.isArray(featuredClipIds) ? featuredClipIds : []);

    return NextResponse.json({
      sessions: sessions.map((s) => {
        const clipId = s.clips[0]?.id || null;
        return {
          id: s.id,
          userId: s.userId,
          prospectId: s.prospectId,
          brandId: s.brandId,
          packId: s.packId,
          scenarioType: s.scenarioType,
          focusArea: s.focusArea,
          difficulty: s.difficulty,
          overallScore: s.overallScore,
          pointsEarned: s.pointsEarned,
          duration: s.duration,
          createdAt: s.createdAt.toISOString(),
          leadCompany: s.prospect?.companyName || null,
          brandName: s.brandId ? brandNameById.get(s.brandId) || null : null,
          packName: s.packId ? packNameById.get(s.packId) || null : null,
          repName: s.user?.displayName || s.user?.email || 'Rep',
          hasRecording: Boolean(clipId),
          clipId,
          isFeatured: clipId ? featuredSet.has(clipId) : false,
        };
      }),
      minutesRemaining: profile.minutesRemaining,
      totalPoints: profile.totalPoints,
      streak: profile.currentStreak,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
