import type { PlatformRole, UserProfile } from '@prisma/client';
import { brandHref } from '@/lib/brand-context';

export type AppRole = PlatformRole;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Optional sidebar pill counter (demo or live). */
  badge?: number | string | null;
};

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
  | 'goals'
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
  adminBrands: { href: '/admin/brands', label: 'All brands', icon: 'brands' as const },
  adminReview: { href: '/admin/review', label: 'Review', icon: 'leads' as const },
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' as const },
  trainer: { href: '/practice', label: 'Practice', icon: 'trainer' as const },
  resume: { href: '/resume', label: 'Resume', icon: 'hiring' as const },
  hiring: { href: '/hiring', label: 'Profile', icon: 'profile' as const },
  gigs: { href: '/gigs', label: 'Brand deals', icon: 'gigs' as const },
  earnings: { href: '/earnings', label: 'Earnings', icon: 'earnings' as const },
  outbound: { href: '/cold_calls', label: 'Cold Call', icon: 'outbound' as const },
  campaigns: { href: '/campaigns', label: 'Campaigns', icon: 'campaigns' as const },
  leads: { href: '/leads', label: 'Leads', icon: 'leads' as const },
  goals: { href: '/goals', label: 'Verified goals', icon: 'goals' as const },
  brands: { href: '/brands', label: 'Brands', icon: 'brands' as const },
  academy: { href: '/academy', label: 'Academy', icon: 'academy' as const },
  playbooks: { href: '/practice', label: 'Playbooks', icon: 'playbooks' as const },
  team: { href: '/team', label: 'Team', icon: 'team' as const },
  billing: { href: '/billing', label: 'Billing', icon: 'billing' as const },
  subscribe: { href: '/subscribe', label: 'Subscribe', icon: 'billing' as const },
  settings: { href: '/settings', label: 'Settings', icon: 'settings' as const },
  integrations: { href: '/integrations', label: 'Integrations', icon: 'integrations' as const },
};

export type BrandNavCounts = {
  leads?: number;
  generateLeads?: number;
  /** Live/in-progress dials only — hidden when 0. */
  liveCalls?: number;
  campaigns?: number;
  playbooks?: number;
  /** Pending campaign applications (APPLIED). */
  recruit?: number;
  /** Active / accepted SDRs on campaigns. */
  team?: number;
  /** Pending payouts awaiting brand action. */
  payouts?: number;
  /** Owned brands (My brands). */
  brands?: number;
  /** Verified / payout-eligible goals. */
  verifiedGoals?: number;
};

export type RepNavCounts = {
  /** Brands that shortlisted you (Brand deals). */
  brandDeals?: number;
  /** Checked-out dial queue size (Cold Call). */
  coldCall?: number;
  /** Verified goals (payout-eligible outcomes). */
  verifiedGoals?: number;
  /** Pending campaign payouts. */
  earnings?: number;
};

function actionBadge(n: number | null | undefined): number | null {
  if (n == null || n <= 0) return null;
  return n;
}

function inventoryBadge(n: number | null | undefined): number | null {
  if (n == null) return null;
  return n;
}

/**
 * Brand / recruiter nav when a brand is selected (campaigns live under the brand).
 * Brand switcher lives in the Brand section header — not a separate Brands workspace item.
 * Without a brand key, brand-context links fall back to /dashboard (create-brand gate).
 */
export function brandNavSections(
  brandKey: string | null,
  counts?: BrandNavCounts
): NavSection[] {
  const desk = brandKey ? brandHref(brandKey) : '/dashboard';
  const scoped = (path: string) => (brandKey ? brandHref(brandKey, path) : '/dashboard');
  return [
    {
      id: 'main',
      label: '',
      items: [{ ...I.dashboard, label: 'Dashboard' }],
    },
    {
      id: 'brand',
      label: 'Brand',
      items: [
        { href: desk, label: 'Overview', icon: 'dashboard' },
        {
          href: scoped('playbooks'),
          label: 'Playbooks',
          icon: 'playbooks',
          badge: inventoryBadge(counts?.playbooks),
        },
        {
          href: scoped('campaigns'),
          label: 'Campaigns',
          icon: 'campaigns',
          badge: inventoryBadge(counts?.campaigns),
        },
        {
          href: scoped('pipeline'),
          label: 'Generate leads',
          icon: 'prospects',
          badge: actionBadge(counts?.generateLeads),
        },
        {
          href: scoped('leads'),
          label: 'Leads',
          icon: 'leads',
          badge: inventoryBadge(counts?.leads),
        },
        {
          href: scoped('goals'),
          label: 'Verified goals',
          icon: 'goals',
          badge: inventoryBadge(counts?.verifiedGoals),
        },
      ],
    },
    {
      id: 'sdrs',
      label: 'SDRs',
      items: [
        {
          href: '/recruit',
          label: 'Recruit',
          icon: 'hiring',
          badge: actionBadge(counts?.recruit),
        },
        {
          href: '/sdrs/team',
          label: 'Team',
          icon: 'team',
          badge: inventoryBadge(counts?.team),
        },
        {
          href: scoped('calls'),
          label: 'Calls',
          icon: 'outbound',
          badge: actionBadge(counts?.liveCalls),
        },
        {
          href: '/sdrs/payouts',
          label: 'Payouts',
          icon: 'earnings',
          badge: actionBadge(counts?.payouts),
        },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        {
          ...I.brands,
          label: 'My brands',
          badge: inventoryBadge(counts?.brands),
        },
        I.integrations,
        I.subscribe,
        I.billing,
        I.settings,
      ],
    },
  ];
}

/** SDR workspace nav with optional pill counters. */
export function repNavSections(counts?: RepNavCounts): NavSection[] {
  return [
    {
      id: 'main',
      label: 'Workspace',
      items: [
        I.dashboard,
        I.trainer,
        I.resume,
        {
          ...I.gigs,
          badge: actionBadge(counts?.brandDeals),
        },
        {
          ...I.outbound,
          badge: actionBadge(counts?.coldCall),
        },
        {
          ...I.goals,
          badge: inventoryBadge(counts?.verifiedGoals),
        },
        {
          ...I.earnings,
          badge: actionBadge(counts?.earnings),
        },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.hiring, I.subscribe, I.billing, I.settings],
    },
  ];
}

/**
 * Flat ~6–7 tab nav per role (PRD Jul 2026).
 * RECRUITER is demoted: same IA as Brand (no first-class desk).
 * Brand/RECRUITER static sections are placeholders — AppShell rewrites via brandNavSections.
 */
export const NAV_SECTIONS_BY_ROLE: Record<AppRole, NavSection[]> = {
  REP: repNavSections(),
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
      items: [I.earnings, I.subscribe, I.billing, I.settings],
    },
  ],
  SUPERADMIN: [
    {
      id: 'ops',
      label: 'Ops',
      items: [I.admin, I.adminBrands, I.adminReview, I.dashboard, I.campaigns, I.brands],
    },
    {
      id: 'account',
      label: 'Account',
      items: [I.earnings, I.integrations, I.subscribe, I.billing, I.settings],
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

/**
 * Brand desk pages: owners always; platform demo-* brands when desk is in Demo mode
 * (BRAND / RECRUITER) so portfolio links to MeridianOps / Harborline / SummitShield work.
 */
export function canAccessBrandDesk(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brand: { ownerId: string | null; slug?: string | null },
  deskMode?: 'live' | 'demo' | null
): boolean {
  if (canManageBrand(profile, brand.ownerId)) return true;
  if (deskMode !== 'demo') return false;
  const slug = brand.slug || '';
  if (!slug.startsWith('demo-')) return false;
  const role = effectiveRole(profile);
  return role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN';
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
