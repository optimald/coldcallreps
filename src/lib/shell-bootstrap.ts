import { cookies, headers } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMinuteBalance } from '@/lib/minutes';
import { ensureRepProfile } from '@/lib/profile-slug';
import {
  NAV_SECTIONS_BY_ROLE,
  brandNavSections,
  effectiveRole,
  type AppRole,
  type NavSection,
} from '@/lib/roles';
import { buildRoleModeState, type RoleModeState } from '@/lib/role-mode';
import {
  SELECTED_BRAND_COOKIE,
  BRAND_DESK_MODE_COOKIE,
  brandPathKey,
  resolveSelectedBrand,
  type BrandDeskMode,
  type BrandRef,
} from '@/lib/brand-context';

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
  /** True when active desk mode still needs onboarding. */
  needsOnboardingPath: string | null;
};

function brandKeyFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/brands\/([^/]+)/);
  return m?.[1] || null;
}

/** Lightweight shell payload for AppShell first paint (no global rank queries). */
export async function loadShellBootstrap(): Promise<ShellBootstrap | null> {
  try {
    const profile = await requireUser();
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
      selectedBrand = resolveSelectedBrand(brands, pathBrand || brandCookie);
      const brandId = selectedBrand?.id;
      let counts:
        | { leads?: number; generateLeads?: number; liveCalls?: number; campaigns?: number }
        | undefined;
      if (deskMode === 'demo') {
        counts = { leads: 137, generateLeads: 4, liveCalls: 0, campaigns: 2 };
      } else if (brandId) {
        const [leadCount, jobCount, callCount, campCount] = await Promise.all([
          prisma.prospect.count({ where: { brandId } }),
          prisma.pipelineJob.count({
            where: { brandId, status: { in: ['queued', 'running'] } },
          }),
          prisma.callLog.count({
            where: {
              brandId,
              createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
            },
          }),
          prisma.campaign.count({
            where: { brandId, status: 'OPEN' },
          }),
        ]);
        counts = {
          leads: leadCount,
          generateLeads: jobCount,
          liveCalls: callCount,
          campaigns: campCount,
        };
      }
      sections = brandNavSections(
        selectedBrand ? brandPathKey(selectedBrand) : null,
        counts
      );
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
      needsOnboardingPath,
    };
  } catch {
    return null;
  }
}
