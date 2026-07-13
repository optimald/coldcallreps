import type { PlatformRole, UserProfile } from '@prisma/client';
import { brandHref } from '@/lib/brand-context';

export type AppRole = PlatformRole;

export type NavItem = { href: string; label: string; icon: NavIcon };

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export type NavIcon =
  | 'admin'
  | 'dashboard'
  | 'trainer'
  | 'leaderboard'
  | 'hiring'
  | 'jobs'
  | 'gigs'
  | 'campaigns'
  | 'recruiter'
  | 'brands'
  | 'arena'
  | 'tournaments'
  | 'academy'
  | 'playbooks'
  | 'billing'
  | 'settings'
  | 'integrations'
  | 'profile'
  | 'prospects'
  | 'team'
  | 'outbound'
  | 'leads'
  | 'earnings';

export const ROLE_LABELS: Record<AppRole, string> = {
  REP: 'SDR',
  RECRUITER: 'Brand', // demoted — treat as Brand in UI labels
  BRAND: 'Brand',
  MANAGER: 'SDR Admin',
  SUPERADMIN: 'Super Admin',
};

const I = {
  admin: { href: '/admin', label: 'Admin', icon: 'admin' as const },
  dashboard: { href: '/dashboard', label: 'Home', icon: 'dashboard' as const },
  trainer: { href: '/practice', label: 'Practice', icon: 'trainer' as const },
  hiring: { href: '/hiring', label: 'Profile', icon: 'profile' as const },
  gigs: { href: '/gigs', label: 'Brand deals', icon: 'gigs' as const },
  earnings: { href: '/earnings', label: 'Earnings', icon: 'earnings' as const },
  outbound: { href: '/cold_calls', label: 'Cold Call', icon: 'outbound' as const },
  campaigns: { href: '/campaigns', label: 'Campaigns', icon: 'campaigns' as const },
  leads: { href: '/leads', label: 'Leads', icon: 'leads' as const },
  brands: { href: '/brands', label: 'Brands', icon: 'brands' as const },
  academy: { href: '/academy', label: 'Academy', icon: 'academy' as const },
  playbooks: { href: '/playbooks', label: 'Playbooks', icon: 'playbooks' as const },
  team: { href: '/team', label: 'Team', icon: 'team' as const },
  billing: { href: '/billing', label: 'Billing', icon: 'billing' as const },
  settings: { href: '/settings', label: 'Settings', icon: 'settings' as const },
  integrations: { href: '/integrations', label: 'Integrations', icon: 'integrations' as const },
};

/**
 * Brand / recruiter nav when a brand is selected (campaigns live under the brand).
 * Without a brand key, brand-context links fall back to /brands.
 */
export function brandNavSections(brandKey: string | null): NavSection[] {
  const scoped = (path: string) => (brandKey ? brandHref(brandKey, path) : '/brands');
  return [
    {
      id: 'main',
      label: 'Workspace',
      items: [I.dashboard, I.brands],
    },
    {
      id: 'brand',
      label: 'Brand',
      items: [
        { href: scoped('campaigns'), label: 'Campaigns', icon: 'campaigns' },
        { href: scoped('leads'), label: 'Leads', icon: 'leads' },
        { href: scoped('calls'), label: 'Live calls', icon: 'outbound' },
      ],
    },
    {
      id: 'sdrs',
      label: 'SDRs',
      items: [
        { href: scoped('sdrs/applications'), label: 'Applications', icon: 'hiring' },
        { href: scoped('sdrs/team'), label: 'Team', icon: 'team' },
        { href: scoped('sdrs/stats'), label: 'Stats', icon: 'leaderboard' },
        { href: scoped('sdrs/payouts'), label: 'Payouts', icon: 'earnings' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.integrations, I.billing, I.settings],
    },
  ];
}

/**
 * Flat ~6–7 tab nav per role (PRD Jul 2026).
 * RECRUITER is demoted: same IA as Brand (no first-class desk).
 * Brand/RECRUITER static sections are placeholders — AppShell rewrites via brandNavSections.
 */
export const NAV_SECTIONS_BY_ROLE: Record<AppRole, NavSection[]> = {
  REP: [
    {
      id: 'main',
      label: 'Workspace',
      items: [I.dashboard, I.trainer, I.gigs, I.outbound, I.earnings],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.hiring, I.billing, I.settings],
    },
  ],
  /** Legacy role — Brand IA; /recruiter soft-redirects to brand leads */
  RECRUITER: brandNavSections(null),
  BRAND: brandNavSections(null),
  MANAGER: [
    {
      id: 'main',
      label: 'Desk',
      items: [I.dashboard, I.team, I.trainer, I.academy, I.campaigns, I.playbooks],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.earnings, I.billing, I.settings],
    },
  ],
  SUPERADMIN: [
    {
      id: 'ops',
      label: 'Ops',
      items: [I.admin, I.dashboard, I.campaigns, I.gigs, I.leads, I.brands],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.earnings, I.integrations, I.billing, I.settings],
    },
  ],
};

/** Flat nav (legacy helpers / tests). */
export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  REP: NAV_SECTIONS_BY_ROLE.REP.flatMap((s) => s.items),
  RECRUITER: NAV_SECTIONS_BY_ROLE.RECRUITER.flatMap((s) => s.items),
  BRAND: NAV_SECTIONS_BY_ROLE.BRAND.flatMap((s) => s.items),
  MANAGER: NAV_SECTIONS_BY_ROLE.MANAGER.flatMap((s) => s.items),
  SUPERADMIN: NAV_SECTIONS_BY_ROLE.SUPERADMIN.flatMap((s) => s.items),
};

export function isSuperadmin(profile: Pick<UserProfile, 'platformRole' | 'email'>): boolean {
  if (profile.platformRole === 'SUPERADMIN') return true;
  const allow = (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (profile.email && allow.includes(profile.email.toLowerCase())) return true;
  return false;
}

export function effectiveRole(profile: Pick<UserProfile, 'platformRole' | 'email'>): AppRole {
  if (isSuperadmin(profile)) return 'SUPERADMIN';
  return profile.platformRole || 'REP';
}

export function canManageBrand(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandOwnerId: string | null
): boolean {
  if (isSuperadmin(profile)) return true;
  if (!brandOwnerId) return false;
  return brandOwnerId === profile.id;
}

/** Job posts demoted — Brand / Super Admin only (campaigns are the primary marketplace). */
export function canPostJobs(profile: Pick<UserProfile, 'platformRole' | 'email'>): boolean {
  const role = effectiveRole(profile);
  return role === 'BRAND' || role === 'SUPERADMIN';
}

export function canCreateTournament(profile: Pick<UserProfile, 'platformRole' | 'email'>): boolean {
  const role = effectiveRole(profile);
  return role === 'MANAGER' || role === 'SUPERADMIN' || role === 'BRAND';
}

export function navFor(profile: Pick<UserProfile, 'platformRole' | 'email'>) {
  return NAV_BY_ROLE[effectiveRole(profile)];
}

export function navSectionsFor(profile: Pick<UserProfile, 'platformRole' | 'email'>) {
  return NAV_SECTIONS_BY_ROLE[effectiveRole(profile)];
}
