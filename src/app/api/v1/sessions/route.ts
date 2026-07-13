import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

async function authApiKey(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token.startsWith('ccr_')) return null;
  const hash = createHash('sha256').update(token).digest('hex');
  const key = await prisma.apiKey.findFirst({
    where: { keyHash: hash, revokedAt: null },
  });
  if (!key) return null;
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return key;
}

/** Aggregated session stats for talent API consumers. */
export async function GET(req: Request) {
  try {
    const key = await authApiKey(req);
    if (!key) {
      return NextResponse.json(
        { error: 'API key required', docs: '/developers' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!slug) {
      return NextResponse.json(
        { error: 'slug query param required', docs: '/developers' },
        { status: 400 }
      );
    }
    const rep = await prisma.repProfile.findUnique({ where: { slug } });
    if (!rep) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const userId = rep.userId;

    const sessions = await prisma.trainerSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        overallScore: true,
        focusArea: true,
        difficulty: true,
        duration: true,
        pointsEarned: true,
        integrityFlags: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
            repProfile: { select: { slug: true, verified: true } },
          },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        overallScore: s.overallScore,
        focusArea: s.focusArea,
        difficulty: s.difficulty,
        duration: s.duration,
        pointsEarned: s.pointsEarned,
        blocked: hasBlockingIntegrity(s.integrityFlags),
        createdAt: s.createdAt,
        rep: {
          displayName: s.user.displayName,
          slug: s.user.repProfile?.slug || null,
          verified: s.user.repProfile?.verified || false,
        },
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
