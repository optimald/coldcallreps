import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

async function authApiKey(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const key = await prisma.apiKey.findFirst({
    where: { keyHash: hashKey(token), revokedAt: null },
  });
  if (!key) return null;
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return key;
}

/** Public API — leaderboard snapshot for ATS / outbound tools. */
export async function GET(req: Request) {
  const key = await authApiKey(req);
  if (!key) {
    return NextResponse.json(
      { error: 'API key required', docs: '/developers' },
      { status: 401 }
    );
  }

  const profiles = await prisma.userProfile.findMany({
    orderBy: { totalPoints: 'desc' },
    take: 25,
    select: {
      id: true,
      displayName: true,
      totalPoints: true,
      currentStreak: true,
      badges: true,
      repProfile: { select: { slug: true, verified: true } },
    },
  });

  return NextResponse.json({
    version: 'v1',
    leaderboard: profiles.map((p) => ({
      displayName: p.displayName,
      totalPoints: p.totalPoints,
      streak: p.currentStreak,
      badges: JSON.parse(p.badges || '[]'),
      profileSlug: p.repProfile?.slug || null,
      verified: p.repProfile?.verified || false,
    })),
  });
}
