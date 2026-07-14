import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';
import {
  canStoreRecordingsForProfile,
  isOrgAdminForProfile,
  roleAllowedForPlan,
} from '@/lib/plans';
import {
  assertSwitchableMode,
  buildRoleModeState,
  homeForMode,
  isModeOnboarded,
  modeFromRole,
  onboardingPathFor,
  serializeUnlockedRoles,
} from '@/lib/role-mode';

export async function GET(req: Request) {
  try {
    const profile = await requireUser({ allowSuspended: true });
    if (profile.accountStatus === 'SUSPENDED' || profile.accountStatus === 'BANNED') {
      return NextResponse.json(
        {
          id: profile.id,
          accountStatus: profile.accountStatus,
          statusReason: profile.statusReason,
          restricted: true,
          platformRole: effectiveRole(profile),
        },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const fields = searchParams.get('fields');
    const metricsOnly = fields === 'metrics' || fields === 'shell';

    const platformRole = effectiveRole(profile);
    const roleMode = buildRoleModeState(profile);
    const { getMinuteBalance } = await import('@/lib/minutes');
    const balance = await getMinuteBalance(profile);

    if (metricsOnly) {
      return NextResponse.json(
        {
          id: profile.id,
          platformRole,
          roleMode,
          plan: profile.plan,
          minutesRemaining: balance.available,
          minutesUsed: profile.minutesUsed,
          totalPoints: profile.totalPoints,
          currentStreak: profile.currentStreak,
          profileSlug: null,
          globalRank: null,
          globalRankPool: null,
        },
        { headers: { 'Cache-Control': 'private, max-age=30' } }
      );
    }

    let badges: string[] = [];
    try {
      badges = JSON.parse(profile.badges || '[]');
    } catch {
      badges = [];
    }
    const { ensureRepProfile } = await import('@/lib/profile-slug');
    const { currentUser } = await import('@clerk/nextjs/server');
    const clerkUser = await currentUser();
    const clerkImageUrl = clerkUser?.imageUrl || null;
    const rep = await ensureRepProfile({
      userId: profile.id,
      displayName: profile.displayName,
    });
    const [canStoreRecordings, isOrgAdmin] = await Promise.all([
      canStoreRecordingsForProfile(profile),
      isOrgAdminForProfile(profile),
    ]);
    const { prisma } = await import('@/lib/prisma');
    const [ahead, rankedPool] = await Promise.all([
      prisma.userProfile.count({
        where: { totalPoints: { gt: profile.totalPoints } },
      }),
      prisma.userProfile.count({
        where: { totalPoints: { gt: 0 } },
      }),
    ]);
    // Unranked (0 pts) still get a position after everyone with points
    const globalRank =
      profile.totalPoints > 0
        ? ahead + 1
        : rankedPool + 1;
    const globalRankPool = Math.max(rankedPool, globalRank);

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl || clerkImageUrl,
      orgId: profile.orgId,
      platformRole,
      roleMode,
      plan: profile.plan,
      minutesRemaining: balance.available,
      personalMinutes: balance.personal,
      orgPoolMinutes: balance.orgPool,
      minuteSource: balance.source,
      minutesUsed: profile.minutesUsed,
      bountyCredits: profile.bountyCredits,
      totalPoints: profile.totalPoints,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      globalRank,
      globalRankPool,
      badges,
      referralCode: profile.referralCode,
      referredByCode: profile.referredByCode,
      hiringBoardOptIn: profile.hiringBoardOptIn,
      openToWork: profile.hiringBoardOptIn,
      hiringHeadline: profile.hiringHeadline,
      hiringBio: profile.hiringBio,
      profileSlug: rep.slug,
      publicUrl: `/${rep.slug}`,
      hasSubscription: Boolean(profile.stripeSubscriptionId),
      connect: {
        hasAccount: Boolean(profile.stripeConnectAccountId),
        detailsSubmitted: profile.stripeConnectDetailsSubmitted,
        payoutsEnabled: profile.stripeConnectPayoutsEnabled,
        ready: Boolean(
          profile.stripeConnectAccountId && profile.stripeConnectPayoutsEnabled
        ),
      },
      canStoreRecordings,
      isOrgAdmin,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Switch active platform role / desk mode.
 * Brand without a company → 409 + /onboarding/brand. SDR unlocks immediately.
 */
export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    // Self-serve desk switch is REP ↔ BRAND only. MANAGER/SUPERADMIN are
    // assigned by billing webhook or admin — never via this endpoint.
    const rawRole = body.activeRole ?? body.platformRole;
    const requested =
      assertSwitchableMode(rawRole) ||
      (rawRole === 'RECRUITER' ? 'BRAND' : null);

    if (!requested) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (effectiveRole(profile) === 'SUPERADMIN') {
      return NextResponse.json({
        platformRole: 'SUPERADMIN',
        notice: 'Superadmin role is sticky — use /admin to manage others.',
      });
    }

    const gate = roleAllowedForPlan(requested, profile.plan);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.error,
          requiredPlan: gate.requiredPlan,
          code: 'PLAN_REQUIRED',
        },
        { status: 402 }
      );
    }

    const switchMode = modeFromRole(requested);
    const { prisma } = await import('@/lib/prisma');
    if (switchMode) {
      let onboarded = isModeOnboarded(switchMode, profile);
      // Owning a brand counts as Brand onboarded (legacy accounts / skipped flag).
      if (!onboarded && switchMode === 'BRAND') {
        const owned = await prisma.brand.count({
          where: { ownerId: profile.id },
        });
        if (owned > 0) onboarded = true;
      }
      // SDR has no setup page — unlock immediately on desk switch.
      if (!onboarded && switchMode === 'REP') {
        onboarded = true;
      }
      if (!onboarded) {
        return NextResponse.json(
          {
            error: 'Create your brand to unlock Brand mode.',
            code: 'ONBOARDING_REQUIRED',
            onboardingPath: onboardingPathFor('BRAND'),
            mode: 'BRAND',
          },
          { status: 409 }
        );
      }
    }

    const roleMode = buildRoleModeState(profile);
    const nextUnlocked = new Set(roleMode.unlockedRoles.map(String));
    if (requested === 'BRAND') nextUnlocked.add('BRAND');
    if (requested === 'REP') nextUnlocked.add('REP');

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        platformRole: requested,
        unlockedRolesJSON: serializeUnlockedRoles(nextUnlocked),
        // Heal legacy brand owners who never got brandOnboardedAt stamped.
        ...(requested === 'BRAND'
          ? { brandOnboardedAt: profile.brandOnboardedAt || new Date() }
          : {}),
        // Stamp SDR onboarded when switching into the desk (no accept page).
        ...(requested === 'REP'
          ? { repOnboardedAt: profile.repOnboardedAt || new Date() }
          : {}),
      },
    });

    if (requested === 'REP') {
      const { ensureRepProfile } = await import('@/lib/profile-slug');
      await ensureRepProfile({
        userId: profile.id,
        displayName: updated.displayName,
      });
    }

    const nextMode = modeFromRole(updated.platformRole);
    return NextResponse.json({
      platformRole: updated.platformRole,
      roleMode: buildRoleModeState(updated),
      redirectTo: nextMode ? homeForMode(nextMode) : '/dashboard',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
