import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { PLAN } from '@/lib/product';

function makeReferralCode(userId: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `REP${suffix}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** Ensure a UserProfile row exists for the signed-in Clerk user. */
export async function requireUser() {
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
        plan: 'STARTER',
        minutesRemaining: PLAN.STARTER.minutes,
        referralCode: makeReferralCode(userId),
      },
    });
  } else if (orgId && profile.orgId !== orgId) {
    profile = await prisma.userProfile.update({
      where: { id: userId },
      data: { orgId },
    });
  }

  return profile;
}

export async function optionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
