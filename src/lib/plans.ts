import type { UserProfile } from '@prisma/client';
import { isPaidPlan, type PlanKey } from '@/lib/product';
import { prisma } from '@/lib/prisma';

/** Plans that unlock Talent API keys. Recruiter role is free for now. */
export function canUseApiKeys(profile: Pick<UserProfile, 'plan' | 'platformRole'>): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  if (profile.platformRole === 'RECRUITER') return true;
  return profile.plan === 'RECRUITER' || profile.plan === 'PRO' || profile.plan === 'TEAM';
}

/** Recruiter desk access — free while recruiter accounts are complimentary. */
export function hasPaidRecruiterAccess(
  profile: Pick<UserProfile, 'plan' | 'platformRole'>,
  seat?: { paid?: boolean; active?: boolean } | null
): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  if (profile.platformRole === 'RECRUITER') return true;
  if (profile.plan === 'RECRUITER') return true;
  return Boolean(seat?.paid && seat?.active);
}

/** Manager / team features require TEAM plan or org manager with subscription. */
export function canManageTeam(profile: Pick<UserProfile, 'plan' | 'platformRole' | 'orgId'>): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  if (profile.plan === 'TEAM') return true;
  return (
    profile.platformRole === 'MANAGER' &&
    Boolean(profile.orgId) &&
    isPaidPlan(profile.plan) &&
    profile.plan !== 'STARTER'
  );
}

/**
 * Sync gate for call recording storage (R2 upload + complete).
 * PRO and TEAM plans store audio; FREE/STARTER get scorecards only.
 */
export function canStoreRecordings(
  profile: Pick<UserProfile, 'plan' | 'platformRole'>
): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  return profile.plan === 'PRO' || profile.plan === 'TEAM';
}

/**
 * Recording storage including Org seats: anyone in a Clerk org that has an
 * active TEAM subscriber qualifies, even if their personal plan is FREE/STARTER.
 */
export async function canStoreRecordingsForProfile(
  profile: Pick<UserProfile, 'id' | 'plan' | 'platformRole' | 'orgId'>
): Promise<boolean> {
  if (canStoreRecordings(profile)) return true;
  if (!profile.orgId) return false;
  const teamSubscriber = await prisma.userProfile.findFirst({
    where: { orgId: profile.orgId, plan: 'TEAM' },
    select: { id: true },
  });
  return Boolean(teamSubscriber);
}

/**
 * Org admin = TEAM manager patterns already in product (MANAGER role / canManageTeam).
 * Requires an orgId so roster stays scoped to that Clerk organization.
 */
export function isOrgAdmin(
  profile: Pick<UserProfile, 'plan' | 'platformRole' | 'orgId'>
): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  if (!profile.orgId) return false;
  if (profile.platformRole === 'MANAGER') return true;
  return canManageTeam(profile);
}

/** Async org-admin check including academy "manager" seat role. */
export async function isOrgAdminForProfile(
  profile: Pick<UserProfile, 'id' | 'plan' | 'platformRole' | 'orgId'>
): Promise<boolean> {
  if (isOrgAdmin(profile)) return true;
  if (!profile.orgId) return false;
  const academyManager = await prisma.academyMember.findFirst({
    where: {
      userId: profile.id,
      role: 'manager',
      academy: { orgId: profile.orgId },
    },
    select: { id: true },
  });
  return Boolean(academyManager);
}

/** Self-serve role switches that don't require a paid plan. */
export const FREE_ROLES = ['REP', 'BRAND', 'RECRUITER'] as const;

/** Roles that require a matching paid plan. Recruiter is free for now. */
export function roleAllowedForPlan(
  role: string,
  plan: PlanKey | string
): { ok: boolean; error?: string; requiredPlan?: PlanKey } {
  if (role === 'REP' || role === 'BRAND' || role === 'RECRUITER') return { ok: true };
  if (role === 'MANAGER') {
    if (plan === 'TEAM') return { ok: true };
    return {
      ok: false,
      error: 'Manager role requires the Org plan ($60/user/mo).',
      requiredPlan: 'TEAM',
    };
  }
  return { ok: false, error: 'Invalid role' };
}
