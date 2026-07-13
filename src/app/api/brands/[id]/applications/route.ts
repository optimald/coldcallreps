import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';
import {
  defaultAcceptMessage,
  defaultRejectMessage,
  parseBrandDefaults,
} from '@/lib/notifications';

function parseFeaturedIds(raw?: string | null) {
  try {
    const ids = JSON.parse(raw || '[]');
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').slice(0, 3) : [];
  } catch {
    return [] as string[];
  }
}

async function loadFeaturedCalls(userId: string, featuredIds: string[]) {
  if (!featuredIds.length) return [];
  const clips = await prisma.clip.findMany({
    where: { userId, id: { in: featuredIds }, status: 'ready' },
    select: {
      id: true,
      title: true,
      r2Key: true,
      durationSec: true,
      session: { select: { overallScore: true, focusArea: true } },
    },
  });
  const byId = new Map(clips.map((c) => [c.id, c]));
  return featuredIds
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      title: c.title,
      href: `/h/${c.id}`,
      mediaSrc: c.r2Key ? `/api/clips/media?clipId=${c.id}` : null,
      durationSec: c.durationSec,
      overallScore: c.session?.overallScore ?? null,
      focusArea: c.session?.focusArea ?? null,
    }));
}

async function applicantVitals(userId: string) {
  const sessions = await prisma.trainerSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { overallScore: true, integrityFlags: true },
  });
  const clean = sessions.filter((s) => !hasBlockingIntegrity(s.integrityFlags));
  const bestScore = clean.reduce((m, s) => Math.max(m, s.overallScore), 0);
  const avgScore = clean.length
    ? Math.round(clean.reduce((a, s) => a + s.overallScore, 0) / clean.length)
    : 0;
  return { bestScore, avgScore, sessionCount: clean.length };
}

/** GET — brand-wide SDR applications with vitals + resume clips. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: {
        id: true,
        slug: true,
        name: true,
        ownerId: true,
        notificationDefaultsJSON: true,
      },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { brandId: brand.id },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);
    const applications = campaignIds.length
      ? await prisma.campaignApplication.findMany({
          where: { campaignId: { in: campaignIds } },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            campaign: { select: { id: true, title: true, status: true } },
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                totalPoints: true,
                currentStreak: true,
                hiringHeadline: true,
                hiringBio: true,
                stripeConnectAccountId: true,
                stripeConnectPayoutsEnabled: true,
                repProfile: {
                  select: {
                    slug: true,
                    verified: true,
                    bio: true,
                    skillsJSON: true,
                    featuredClipIdsJSON: true,
                  },
                },
                certifications: {
                  where: { brandId: brand.id },
                  take: 3,
                  orderBy: { score: 'desc' },
                  select: { label: true, score: true },
                },
              },
            },
          },
        })
      : [];

    const rows = await Promise.all(
      applications.map(async (a) => {
        const featuredIds = parseFeaturedIds(a.user.repProfile?.featuredClipIdsJSON);
        const [vitals, featuredCalls] = await Promise.all([
          applicantVitals(a.user.id),
          loadFeaturedCalls(a.user.id, featuredIds),
        ]);
        let skills: string[] = [];
        try {
          skills = JSON.parse(a.user.repProfile?.skillsJSON || '[]');
        } catch {
          skills = [];
        }
        return {
          id: a.id,
          status: a.status,
          message: a.message,
          brandDecisionMessage: a.brandDecisionMessage,
          campaignId: a.campaign.id,
          campaignTitle: a.campaign.title,
          createdAt: a.createdAt.toISOString(),
          applicant: {
            id: a.user.id,
            displayName: a.user.displayName || 'Rep',
            email: a.user.email,
            profileSlug: a.user.repProfile?.slug || null,
            verified: Boolean(a.user.repProfile?.verified),
            headline: a.user.hiringHeadline || null,
            bio: a.user.hiringBio || a.user.repProfile?.bio || null,
            skills: skills.slice(0, 8),
            totalPoints: a.user.totalPoints,
            streak: a.user.currentStreak,
            bestScore: vitals.bestScore,
            avgScore: vitals.avgScore,
            sessionCount: vitals.sessionCount,
            connectReady: Boolean(
              a.user.stripeConnectAccountId && a.user.stripeConnectPayoutsEnabled
            ),
            certifications: a.user.certifications,
            featuredCalls,
          },
        };
      })
    );

    const defaults = parseBrandDefaults(brand.notificationDefaultsJSON);

    return NextResponse.json({
      brand: { id: brand.id, slug: brand.slug, name: brand.name },
      defaults: {
        acceptMessage:
          defaults.acceptMessage ||
          defaultAcceptMessage({ brandName: brand.name, campaignTitle: '{{campaign}}' }),
        rejectMessage:
          defaults.rejectMessage ||
          defaultRejectMessage({ brandName: brand.name, campaignTitle: '{{campaign}}' }),
      },
      applications: rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
