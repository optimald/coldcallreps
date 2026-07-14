import { cookies, headers } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMinuteBalance } from '@/lib/minutes';
import { ensureRepProfile } from '@/lib/profile-slug';
import {
  NAV_SECTIONS_BY_ROLE,
  brandNavSections,
  repNavSections,
  effectiveRole,
  type AppRole,
  type NavSection,
} from '@/lib/roles';
import { loadBrandNavCounts, loadRepNavCounts } from '@/lib/nav-counts';
import { buildRoleModeState, type RoleModeState } from '@/lib/role-mode';
import {
  SELECTED_BRAND_COOKIE,
  BRAND_DESK_MODE_COOKIE,
  brandPathKey,
  resolveSelectedBrand,
  type BrandDeskMode,
  type BrandRef,
} from '@/lib/brand-context';
import {
  ADMIN_DESK_MODE_COOKIE,
  type AdminDeskMode,
} from '@/lib/admin-context';
import { canonicalDemoBrandBySlug, CANONICAL_DEMO_BRANDS } from '@/lib/demo/canonical-brands';
import { getDemoBrandNavCounts } from '@/lib/demo/brand-demo-data';

export type ShellMetrics = {
  minutesRemaining: number | null;
  minutesUsed: number | null;
  totalPoints: number | null;
  currentStreak: number | null;
  globalRank: number | null;
  globalRankPool: number | null;
  plan: string | null;
  profileSlug: string | null;
};

export type ShellBootstrap = {
  role: AppRole;
  roleMode: RoleModeState;
  metrics: ShellMetrics;
  brands: BrandRef[];
  selectedBrand: BrandRef | null;
  sections: NavSection[];
  deskMode: BrandDeskMode;
  adminDeskMode: AdminDeskMode;
  /** True when active desk mode still needs onboarding. */
  needsOnboardingPath: string | null;
  /** Suspended/banned — layout redirects to /restricted. */
  accountRestricted?: boolean;
};

function brandKeyFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/brands\/([^/]+)/);
  return m?.[1] || null;
}

/** Lightweight shell payload for AppShell first paint (no global rank queries). */
export async function loadShellBootstrap(): Promise<ShellBootstrap | null> {
  try {
    const profile = await requireUser({ allowSuspended: true });
    if (profile.accountStatus === 'SUSPENDED' || profile.accountStatus === 'BANNED') {
      return {
        role: effectiveRole(profile),
        roleMode: buildRoleModeState(profile),
        metrics: {
          minutesRemaining: null,
          minutesUsed: null,
          totalPoints: null,
          currentStreak: null,
          globalRank: null,
          globalRankPool: null,
          plan: profile.plan,
          profileSlug: null,
        },
        brands: [],
        selectedBrand: null,
        sections: [],
        deskMode: 'live',
        adminDeskMode: 'live',
        needsOnboardingPath: null,
        accountRestricted: true,
      };
    }
    const role = effectiveRole(profile);
    const roleMode = buildRoleModeState(profile);

    const headerStore = await headers();
    const pathname = headerStore.get('x-ccr-pathname');
    const cookieStore = await cookies();
    const brandCookie = cookieStore.get(SELECTED_BRAND_COOKIE)?.value
      ? decodeURIComponent(cookieStore.get(SELECTED_BRAND_COOKIE)!.value)
      : null;
    const deskMode: BrandDeskMode =
      cookieStore.get(BRAND_DESK_MODE_COOKIE)?.value === 'demo' ? 'demo' : 'live';
    const adminDeskMode: AdminDeskMode =
      cookieStore.get(ADMIN_DESK_MODE_COOKIE)?.value === 'demo' ? 'demo' : 'live';

    const pathBrand = brandKeyFromPathname(pathname);

    const [balance, rep] = await Promise.all([
      getMinuteBalance(profile),
      ensureRepProfile({
        userId: profile.id,
        displayName: profile.displayName,
      }),
    ]);

    const metrics: ShellMetrics = {
      minutesRemaining: balance.available,
      minutesUsed: profile.minutesUsed,
      totalPoints: profile.totalPoints,
      currentStreak: profile.currentStreak,
      globalRank: null,
      globalRankPool: null,
      plan: profile.plan || 'FREE',
      profileSlug: rep.slug,
    };

    let brands: BrandRef[] = [];
    let selectedBrand: BrandRef | null = null;
    let sections: NavSection[] =
      NAV_SECTIONS_BY_ROLE[role] || NAV_SECTIONS_BY_ROLE.REP;

    if (role === 'BRAND' || role === 'RECRUITER') {
      const rows = await prisma.brand.findMany({
        where: { ownerId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, slug: true, name: true, logoUrl: true },
      });
      brands = rows.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        logoUrl: b.logoUrl,
      }));
      if (deskMode === 'demo') {
        const demo =
          canonicalDemoBrandBySlug(pathBrand) ||
          canonicalDemoBrandBySlug(brandCookie) ||
          CANONICAL_DEMO_BRANDS[0];
        selectedBrand = {
          id: demo.id,
          slug: demo.slug,
          name: demo.name,
          logoUrl: demo.logoUrl,
        };
      } else {
        selectedBrand = resolveSelectedBrand(brands, pathBrand || brandCookie);
      }
      const brandId = selectedBrand?.id;
      let counts:
        | ReturnType<typeof getDemoBrandNavCounts>
        | Awaited<ReturnType<typeof loadBrandNavCounts>>
        | undefined;
      if (deskMode === 'demo') {
        counts = getDemoBrandNavCounts(
          selectedBrand ? brandPathKey(selectedBrand) : 'demo-meridianops',
          CANONICAL_DEMO_BRANDS.length
        );
      } else if (brandId) {
        counts = {
          ...(await loadBrandNavCounts(brandId)),
          brands: brands.length,
        };
      } else if (brands.length > 0) {
        counts = { brands: brands.length };
      }
      sections = brandNavSections(
        selectedBrand ? brandPathKey(selectedBrand) : null,
        counts
      );
    } else if (role === 'REP' || role === 'MANAGER') {
      const repCounts = await loadRepNavCounts(profile);
      sections =
        role === 'REP'
          ? repNavSections(repCounts)
          : NAV_SECTIONS_BY_ROLE.MANAGER;
    } else if (pathBrand) {
      // Path hint: never flash SDR nav on /brands/[id] while role resolves client-side.
      sections = brandNavSections(pathBrand);
    }

    const activeMode = roleMode.activeMode;
    const needsOnboardingPath =
      activeMode && roleMode.modes[activeMode] && !roleMode.modes[activeMode].onboarded
        ? roleMode.modes[activeMode].onboardingPath
        : null;

    return {
      role,
      roleMode,
      metrics,
      brands,
      selectedBrand,
      sections,
      deskMode,
      adminDeskMode,
      needsOnboardingPath,
    };
  } catch {
    return null;
  }
}
