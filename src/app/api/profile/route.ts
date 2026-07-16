import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureRepProfile, checkRepHandleAvailable } from '@/lib/profile-slug';
import { trackEvent } from '@/lib/posthog/analytics';

const MAX_FEATURED_CLIPS = 3;

/** Normalize + validate featured clip IDs: owned, ready, max 3, order preserved. */
async function resolveFeaturedClipIds(userId: string, raw: unknown): Promise<string[] | { error: string }> {
  if (!Array.isArray(raw)) {
    return { error: 'featuredClipIds must be an array' };
  }
  const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))].slice(
    0,
    MAX_FEATURED_CLIPS
  );
  if (ids.length === 0) return [];

  const owned = await prisma.clip.findMany({
    where: { userId, id: { in: ids }, status: 'ready' },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((c) => c.id));
  const missing = ids.filter((id) => !ownedSet.has(id));
  if (missing.length) {
    return {
      error: 'You can only feature your own ready recorded calls',
    };
  }
  // Preserve requested order
  return ids.filter((id) => ownedSet.has(id));
}

export async function GET() {
  try {
    const profile = await requireUser();
    const rep = await ensureRepProfile({
      userId: profile.id,
      displayName: profile.displayName,
    });
    return NextResponse.json({
      profile: rep,
      displayName: profile.displayName,
      openToWork: profile.hiringBoardOptIn,
      hiringHeadline: profile.hiringHeadline,
      hiringBio: profile.hiringBio,
      publicUrl: `/${rep.slug}`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const bio = body.bio != null ? String(body.bio).slice(0, 2000) : undefined;
    const skills = Array.isArray(body.skills) ? body.skills.map(String).slice(0, 20) : undefined;
    const clipUrls = Array.isArray(body.clipUrls)
      ? body.clipUrls.map(String).slice(0, 10)
      : undefined;

    let featuredClipIdsJSON: string | undefined;
    if (body.featuredClipIds !== undefined) {
      const resolved = await resolveFeaturedClipIds(profile.id, body.featuredClipIds);
      if ('error' in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      featuredClipIdsJSON = JSON.stringify(resolved);
    }

    let slug: string | undefined;
    if (body.slug != null && String(body.slug).trim()) {
      const check = await checkRepHandleAvailable(String(body.slug), profile.id);
      if (!check.available || !check.handle) {
        return NextResponse.json(
          {
            error: check.error || 'Handle unavailable',
            handle: check.handle,
            suggestions: check.suggestions || [],
          },
          { status: 409 }
        );
      }
      slug = check.handle;
    }

    const existing = await ensureRepProfile({
      userId: profile.id,
      displayName: profile.displayName,
    });

    const rep = await prisma.repProfile.update({
      where: { id: existing.id },
      data: {
        ...(slug ? { slug } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(skills ? { skillsJSON: JSON.stringify(skills) } : {}),
        ...(clipUrls ? { clipUrlsJSON: JSON.stringify(clipUrls) } : {}),
        ...(featuredClipIdsJSON !== undefined ? { featuredClipIdsJSON } : {}),
      },
    });

    // Open to work = hiring board opt-in (same signal)
    const userUpdates: {
      hiringBoardOptIn?: boolean;
      hiringHeadline?: string | null;
      hiringBio?: string | null;
    } = {};
    if (typeof body.openToWork === 'boolean') {
      userUpdates.hiringBoardOptIn = body.openToWork;
    }
    if (body.headline != null) {
      userUpdates.hiringHeadline = String(body.headline).slice(0, 160) || null;
    }
    if (body.hiringBio != null) {
      userUpdates.hiringBio = String(body.hiringBio).slice(0, 2000) || null;
    } else if (body.experience != null) {
      userUpdates.hiringBio = String(body.experience).slice(0, 2000) || null;
    }
    if (Object.keys(userUpdates).length) {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: userUpdates,
      });
    }

    const refreshed = await prisma.userProfile.findUnique({ where: { id: profile.id } });

    trackEvent(profile.id, 'resume_updated', {
      role: 'REP',
      hasHeadline: Boolean(refreshed?.hiringHeadline),
      openToWork: refreshed?.hiringBoardOptIn ?? false,
      featuredClips:
        featuredClipIdsJSON != null ? JSON.parse(featuredClipIdsJSON).length : undefined,
      slugChanged: Boolean(slug),
    });

    return NextResponse.json({
      profile: rep,
      openToWork: refreshed?.hiringBoardOptIn ?? false,
      publicUrl: `/${rep.slug}`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
