/**
 * Ops desk permissions — Super / Finance / Trust / Support (admin spec §2).
 * Marketplace SUPERADMIN + SUPERADMIN_EMAILS map to ops role SUPER.
 */
import type { OpsRole, UserProfile } from '@prisma/client';
import { isSuperadmin } from '@/lib/roles';

export type OpsCapability =
  | 'admin.access'
  | 'users.read'
  | 'users.write'
  | 'users.ban'
  | 'users.impersonate'
  | 'users.credits'
  | 'users.assign_ops'
  | 'finance.ledger'
  | 'finance.payouts'
  | 'finance.refunds'
  | 'trust.review'
  | 'trust.appeals'
  | 'audit.read'
  | 'brands.override'
  | 'campaigns.ops'
  | 'dialer.ops'
  | 'pipeline.ops'
  | 'voice.ops'
  | 'content.ops'
  | 'analytics.read'
  | 'health.read'
  | 'orgs.ops';

const ALL: OpsCapability[] = [
  'admin.access',
  'users.read',
  'users.write',
  'users.ban',
  'users.impersonate',
  'users.credits',
  'users.assign_ops',
  'finance.ledger',
  'finance.payouts',
  'finance.refunds',
  'trust.review',
  'trust.appeals',
  'audit.read',
  'brands.override',
  'campaigns.ops',
  'dialer.ops',
  'pipeline.ops',
  'voice.ops',
  'content.ops',
  'analytics.read',
  'health.read',
  'orgs.ops',
];

const BY_ROLE: Record<OpsRole, OpsCapability[]> = {
  SUPER: ALL,
  FINANCE: [
    'admin.access',
    'users.read',
    'users.credits',
    'finance.ledger',
    'finance.payouts',
    'finance.refunds',
    'analytics.read',
    'audit.read',
  ],
  TRUST: [
    'admin.access',
    'users.read',
    'users.ban',
    'trust.review',
    'trust.appeals',
    'dialer.ops',
    'campaigns.ops',
    'audit.read',
  ],
  SUPPORT: [
    'admin.access',
    'users.read',
    'users.impersonate',
    'users.credits',
    'health.read',
    'audit.read',
  ],
};

export function resolveOpsRole(
  profile: Pick<UserProfile, 'platformRole' | 'email' | 'opsRole'>
): OpsRole | null {
  if (profile.opsRole) return profile.opsRole;
  if (isSuperadmin(profile)) return 'SUPER';
  return null;
}

export function isOpsStaff(
  profile: Pick<UserProfile, 'platformRole' | 'email' | 'opsRole'>
): boolean {
  return resolveOpsRole(profile) != null;
}

export function opsCapabilities(
  profile: Pick<UserProfile, 'platformRole' | 'email' | 'opsRole'>
): OpsCapability[] {
  const role = resolveOpsRole(profile);
  if (!role) return [];
  return BY_ROLE[role];
}

export function canOps(
  profile: Pick<UserProfile, 'platformRole' | 'email' | 'opsRole'>,
  capability: OpsCapability
): boolean {
  return opsCapabilities(profile).includes(capability);
}

export function assertOps(
  profile: Pick<UserProfile, 'platformRole' | 'email' | 'opsRole'>,
  capability: OpsCapability
): void {
  if (!canOps(profile, capability)) {
    throw new Error('FORBIDDEN');
  }
}

export const OPS_ROLE_LABELS: Record<OpsRole, string> = {
  SUPER: 'Super Admin',
  FINANCE: 'Finance / Ops',
  TRUST: 'Trust & Safety',
  SUPPORT: 'Support',
};
