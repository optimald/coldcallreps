import { auth, currentUser } from '@clerk/nextjs/server';
import { PlanTier, type UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TRIAL_MINUTES } from '@/lib/product';
import { effectiveRole, isSuperadmin, type AppRole } from '@/lib/roles';
import { ensureRepProfile } from '@/lib/profile-slug';

function makeReferralCode(userId: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `REP${suffix}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** Ensure a UserProfile row exists for the signed-in Clerk user. */
export async function requireUser(): Promise<UserProfile> {
  const { userId, orgId } = await auth();
  if (!userId) {
    throw new Error('UNAUTHORIZED');
  }

  let profile = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!profile) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || null;
    const displayName =
      user?.fullName || user?.username || email?.split('@')[0] || 'Rep';
    profile = await prisma.userProfile.create({
      data: {
        id: userId,
        email,
        displayName,
        orgId: orgId || null,
        plan: PlanTier.FREE,
        platformRole: 'REP',
        unlockedRolesJSON: '["REP"]',
        repOnboardedAt: new Date(),
        minutesRemaining: TRIAL_MINUTES,
        referralCode: makeReferralCode(userId),
      },
    });
  } else {
    const updates: {
      orgId?: string | null;
      platformRole?: 'SUPERADMIN';
      email?: string;
      displayName?: string;
      plan?: PlanTier;
    } = {};
    // Unpaid legacy STARTER accounts are Free
    if (profile.plan === PlanTier.STARTER && !profile.stripeSubscriptionId) {
      updates.plan = PlanTier.FREE;
    }
    if (orgId !== undefined && (orgId || null) !== profile.orgId) {
      updates.orgId = orgId || null;
    }
    // Promote from SUPERADMIN_EMAILS env without requiring manual DB edit
    if (isSuperadmin(profile) && profile.platformRole !== 'SUPERADMIN') {
      updates.platformRole = 'SUPERADMIN';
    }
    // Keep email/name in sync with Clerk
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || null;
    if (email && email !== profile.email) updates.email = email;
    const displayName =
      user?.fullName || user?.username || email?.split('@')[0] || null;
    if (displayName && displayName !== profile.displayName) updates.displayName = displayName;

    if (Object.keys(updates).length) {
      try {
        profile = await prisma.userProfile.update({
          where: { id: userId },
          data: updates,
        });
      } catch (err: any) {
        // Stale Prisma client / enum race — skip plan migration, apply other fields
        if (updates.plan && Object.keys(updates).length > 1) {
          const { plan: _plan, ...rest } = updates;
          if (Object.keys(rest).length) {
            profile = await prisma.userProfile.update({
              where: { id: userId },
              data: rest,
            });
          }
        } else if (!updates.plan) {
          throw err;
        }
        console.warn('[auth] profile update skipped plan migration:', err?.message || err);
      }
    }
  }

  // Every rep/manager gets a unique public slug (LinkedIn-lite)
  await ensureRepProfile({ userId: profile.id, displayName: profile.displayName });

  return profile;
}

export async function requireRole(...roles: AppRole[]): Promise<UserProfile> {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  if (!roles.includes(role) && role !== 'SUPERADMIN') {
    throw new Error('FORBIDDEN');
  }
  return profile;
}

export async function requireSuperadmin(): Promise<UserProfile> {
  const profile = await requireUser();
  if (!isSuperadmin(profile)) {
    throw new Error('FORBIDDEN');
  }
  return profile;
}

export async function optionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
