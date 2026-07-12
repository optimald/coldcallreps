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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const key = await authApiKey(req);
  if (!key) {
    return NextResponse.json(
      { error: 'API key required', docs: '/developers' },
      { status: 401 }
    );
  }

  const { slug } = await params;
  const rep = await prisma.repProfile.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          displayName: true,
          totalPoints: true,
          currentStreak: true,
          badges: true,
          hiringHeadline: true,
          hiringBoardOptIn: true,
          certifications: {
            include: { brand: { select: { name: true, slug: true } } },
            take: 10,
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

  let featuredClipIds: string[] = [];
  try {
    featuredClipIds = JSON.parse(rep.featuredClipIdsJSON || '[]');
  } catch {
    featuredClipIds = [];
  }
  featuredClipIds = featuredClipIds.filter((id) => typeof id === 'string' && id).slice(0, 3);

  return NextResponse.json({
    version: 'v1',
    profile: {
      slug: rep.slug,
      displayName: rep.user.displayName,
      bio: rep.bio,
      skills: JSON.parse(rep.skillsJSON || '[]'),
      clipUrls: JSON.parse(rep.clipUrlsJSON || '[]'),
      featuredClipIds,
      verified: rep.verified,
      openToWork: Boolean((rep.user as any).hiringBoardOptIn),
      totalPoints: rep.user.totalPoints,
      streak: rep.user.currentStreak,
      badges,
      hiringHeadline: rep.user.hiringHeadline,
      certifications: rep.user.certifications.map((c) => ({
        label: c.label,
        score: c.score,
        brand: c.brand.name,
        brandSlug: c.brand.slug,
      })),
    },
  });
}
