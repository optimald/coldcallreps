import type { PlatformRole, UserProfile } from '@prisma/client';
import type { AppRole } from '@/lib/roles';
import { effectiveRole } from '@/lib/roles';

/** Switchable desk modes (focus: SDR ↔ Brand). */
export type SwitchableMode = 'REP' | 'BRAND';

export type ModeStatus = {
  unlocked: boolean;
  onboarded: boolean;
  home: string;
  onboardingPath: string;
};

export type RoleModeState = {
  activeRole: AppRole;
  /** Active desk for switch UI (maps RECRUITER → Brand). */
  activeMode: SwitchableMode | null;
  unlockedRoles: PlatformRole[];
  modes: {
    REP: ModeStatus;
    BRAND: ModeStatus;
  };
  /** Opposite mode to switch into from the sidebar (null for admin-only desks). */
  switchTarget: SwitchableMode | null;
};

const SWITCHABLE: SwitchableMode[] = ['REP', 'BRAND'];

export function parseUnlockedRoles(
  raw: string | null | undefined,
  fallbackRole?: PlatformRole | null
): PlatformRole[] {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw || '[]');
  } catch {
    parsed = [];
  }
  const list = Array.isArray(parsed)
    ? parsed.map(String).filter(Boolean)
    : [];
  const roles = new Set<PlatformRole>();
  for (const r of list) {
    if (r === 'REP' || r === 'BRAND' || r === 'RECRUITER' || r === 'MANAGER' || r === 'SUPERADMIN') {
      roles.add(r as PlatformRole);
    }
  }
  // Legacy recruiter counts as Brand unlocked
  if (roles.has('RECRUITER')) roles.add('BRAND');
  if (fallbackRole) {
    if (fallbackRole === 'RECRUITER') roles.add('BRAND');
    else roles.add(fallbackRole);
  }
  if (roles.size === 0) roles.add('REP');
  return [...roles];
}

export function serializeUnlockedRoles(roles: Iterable<string>): string {
  const set = new Set<PlatformRole>();
  for (const r of roles) {
    if (r === 'REP' || r === 'BRAND' || r === 'RECRUITER' || r === 'MANAGER' || r === 'SUPERADMIN') {
      if (r === 'RECRUITER') set.add('BRAND');
      else set.add(r as PlatformRole);
    }
  }
  if (set.size === 0) set.add('REP');
  return JSON.stringify([...set]);
}

export function modeFromRole(role: AppRole | string | null | undefined): SwitchableMode | null {
  if (!role) return null;
  if (role === 'REP') return 'REP';
  if (role === 'BRAND' || role === 'RECRUITER') return 'BRAND';
  return null;
}

export function onboardingPathFor(mode: SwitchableMode): string {
  return mode === 'REP' ? '/onboarding/rep' : '/onboarding/brand';
}

export function homeForMode(mode: SwitchableMode): string {
  return mode === 'REP' ? '/dashboard' : '/campaigns';
}

export function isRepOnboarded(
  profile: Pick<UserProfile, 'repOnboardedAt'>
): boolean {
  return Boolean(profile.repOnboardedAt);
}

export function isBrandOnboarded(
  profile: Pick<UserProfile, 'brandOnboardedAt'>
): boolean {
  return Boolean(profile.brandOnboardedAt);
}

export function isModeOnboarded(
  mode: SwitchableMode,
  profile: Pick<UserProfile, 'repOnboardedAt' | 'brandOnboardedAt'>
): boolean {
  return mode === 'REP' ? isRepOnboarded(profile) : isBrandOnboarded(profile);
}

export function isModeUnlocked(
  mode: SwitchableMode,
  unlockedRoles: PlatformRole[]
): boolean {
  return unlockedRoles.includes(mode);
}

/**
 * Build mode-switch payload for /api/me and AppShell.
 * SUPERADMIN / MANAGER keep their desks — no sidebar toggle.
 */
export function buildRoleModeState(
  profile: Pick<
    UserProfile,
    | 'platformRole'
    | 'email'
    | 'unlockedRolesJSON'
    | 'repOnboardedAt'
    | 'brandOnboardedAt'
  >
): RoleModeState {
  const activeRole = effectiveRole(profile);
  const unlockedRoles = parseUnlockedRoles(profile.unlockedRolesJSON, profile.platformRole);
  const activeMode = modeFromRole(activeRole);

  const modes = {
    REP: {
      unlocked: isModeUnlocked('REP', unlockedRoles) || isRepOnboarded(profile),
      onboarded: isRepOnboarded(profile),
      home: homeForMode('REP'),
      onboardingPath: onboardingPathFor('REP'),
    },
    BRAND: {
      unlocked: isModeUnlocked('BRAND', unlockedRoles) || isBrandOnboarded(profile),
      onboarded: isBrandOnboarded(profile),
      home: homeForMode('BRAND'),
      onboardingPath: onboardingPathFor('BRAND'),
    },
  } satisfies RoleModeState['modes'];

  let switchTarget: SwitchableMode | null = null;
  if (activeMode === 'REP') switchTarget = 'BRAND';
  else if (activeMode === 'BRAND') switchTarget = 'REP';

  return {
    activeRole,
    activeMode,
    unlockedRoles,
    modes,
    switchTarget,
  };
}

/** True when active switchable mode still needs onboarding. */
export function needsOnboardingRedirect(
  profile: Pick<
    UserProfile,
    | 'platformRole'
    | 'email'
    | 'unlockedRolesJSON'
    | 'repOnboardedAt'
    | 'brandOnboardedAt'
  >,
  pathname: string
): string | null {
  if (pathname.startsWith('/onboarding')) return null;
  const state = buildRoleModeState(profile);
  if (!state.activeMode) return null;
  const mode = state.modes[state.activeMode];
  if (!mode.onboarded) return mode.onboardingPath;
  return null;
}

export function assertSwitchableMode(value: unknown): SwitchableMode | null {
  if (value === 'REP' || value === 'BRAND') return value;
  return null;
}

export { SWITCHABLE };
