import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureRepProfile } from '@/lib/profile-slug';
import {
  buildRoleModeState,
  homeForMode,
  serializeUnlockedRoles,
} from '@/lib/role-mode';
import { syncPersonProfile, trackEvent } from '@/lib/posthog/analytics';

/**
 * POST /api/onboarding/rep
 * Unlock SDR desk from the account-type chooser (no profile wizard).
 * Body: { accept: true, displayName?, avatarUrl?, headline?, bio?, hiringBio?, openToWork? }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));

    if (body.accept !== true && !profile.repOnboardedAt) {
      return NextResponse.json(
        {
          error: 'Choose SDR on the account type screen to continue.',
          code: 'ACCEPT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const displayName =
      body.displayName != null
        ? String(body.displayName).trim().slice(0, 80)
        : profile.displayName || 'Rep';
    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    let avatarUrl: string | null | undefined = undefined;
    if (body.avatarUrl !== undefined) {
      const raw = String(body.avatarUrl || '').trim().slice(0, 500);
      if (!raw) avatarUrl = null;
      else if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) avatarUrl = raw;
      else {
        return NextResponse.json(
          { error: 'Avatar must be an https URL or site path' },
          { status: 400 }
        );
      }
    }

    const headline =
      body.headline != null ? String(body.headline).trim().slice(0, 160) || null : undefined;
    const bio = body.bio != null ? String(body.bio).trim().slice(0, 2000) : undefined;
    const hiringBio =
      body.hiringBio != null
        ? String(body.hiringBio).trim().slice(0, 2000) || null
        : body.experience != null
          ? String(body.experience).trim().slice(0, 2000) || null
          : undefined;

    const roleMode = buildRoleModeState(profile);
    const unlocked = new Set(roleMode.unlockedRoles.map(String));
    unlocked.add('REP');

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        displayName,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(headline !== undefined ? { hiringHeadline: headline } : {}),
        ...(hiringBio !== undefined ? { hiringBio } : {}),
        ...(typeof body.openToWork === 'boolean'
          ? { hiringBoardOptIn: body.openToWork }
          : {}),
        platformRole: 'REP',
        unlockedRolesJSON: serializeUnlockedRoles(unlocked),
        repOnboardedAt: profile.repOnboardedAt || new Date(),
      },
    });

    const rep = await ensureRepProfile({
      userId: profile.id,
      displayName: updated.displayName,
    });

    if (bio !== undefined) {
      await prisma.repProfile.update({
        where: { id: rep.id },
        data: { bio },
      });
    }

    if (!profile.repOnboardedAt) {
      const { notifyAsync } = await import('@/lib/notifications');
      notifyAsync({
        event: 'welcome.sdr',
        recipient: {
          userId: profile.id,
          email: profile.email,
          displayName: updated.displayName,
        },
        payload: { ctaUrl: '/gigs', forAudience: 'sdr' },
        idempotencyKey: `welcome.sdr:${profile.id}`,
      });

      trackEvent(profile.id, 'onboarding_completed', {
        role: 'REP',
        redirectTo: homeForMode('REP'),
      });
      syncPersonProfile(updated);
    }

    return NextResponse.json({
      ok: true,
      platformRole: updated.platformRole,
      roleMode: buildRoleModeState(updated),
      redirectTo: homeForMode('REP'),
      connectHint:
        'Connect Stripe on Earnings before campaign payouts can land in your bank.',
      connectPath: '/earnings',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
