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

export async function GET() {
  try {
    const profile = await requireUser();
    let badges: string[] = [];
    try {
      badges = JSON.parse(profile.badges || '[]');
    } catch {
      badges = [];
    }
    const platformRole = effectiveRole(profile);
    const roleMode = buildRoleModeState(profile);
    const { ensureRepProfile } = await import('@/lib/profile-slug');
    const { getMinuteBalance } = await import('@/lib/minutes');
    const { currentUser } = await import('@clerk/nextjs/server');
    const clerkUser = await currentUser();
    const clerkImageUrl = clerkUser?.imageUrl || null;
    const rep = await ensureRepProfile({
      userId: profile.id,
      displayName: profile.displayName,
    });
    const [balance, canStoreRecordings, isOrgAdmin] = await Promise.all([
      getMinuteBalance(profile),
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Switch active platform role / desk mode.
 * First-time switches that lack onboarding return 409 ONBOARDING_REQUIRED.
 */
export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const requested =
      assertSwitchableMode(body.activeRole) ||
      assertSwitchableMode(body.platformRole) ||
      (typeof body.platformRole === 'string' ? body.platformRole : null);

    if (!requested) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const allowed = ['REP', 'RECRUITER', 'BRAND', 'MANAGER'] as const;
    if (!allowed.includes(requested as (typeof allowed)[number])) {
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
    if (switchMode) {
      let onboarded = isModeOnboarded(switchMode, profile);
      // Owning a brand counts as Brand onboarded (legacy accounts / skipped flag).
      if (!onboarded && switchMode === 'BRAND') {
        const { prisma } = await import('@/lib/prisma');
        const owned = await prisma.brand.count({
          where: { ownerId: profile.id },
        });
        if (owned > 0) onboarded = true;
      }
      if (!onboarded) {
        return NextResponse.json(
          {
            error: `Complete ${switchMode === 'REP' ? 'SDR' : 'Brand'} onboarding to unlock this mode.`,
            code: 'ONBOARDING_REQUIRED',
            onboardingPath: onboardingPathFor(switchMode),
            mode: switchMode,
          },
          { status: 409 }
        );
      }
    }

    const { prisma } = await import('@/lib/prisma');
    const roleMode = buildRoleModeState(profile);
    const nextUnlocked = new Set(roleMode.unlockedRoles.map(String));
    if (requested === 'BRAND' || requested === 'RECRUITER') nextUnlocked.add('BRAND');
    if (requested === 'REP') nextUnlocked.add('REP');

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        platformRole: requested as 'REP' | 'RECRUITER' | 'BRAND' | 'MANAGER',
        unlockedRolesJSON: serializeUnlockedRoles(nextUnlocked),
        // Heal legacy brand owners who never got brandOnboardedAt stamped.
        ...(requested === 'BRAND' || requested === 'RECRUITER'
          ? { brandOnboardedAt: profile.brandOnboardedAt || new Date() }
          : {}),
      },
    });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
