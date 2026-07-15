'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';
import CreateBrandModal from '@/components/CreateBrandModal';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import NavIconGlyph from '@/components/NavIcon';
import ThemePicker from '@/components/ThemePicker';
import { ShellProvider } from '@/components/ShellProvider';
import { NAV_SECTIONS_BY_ROLE, brandNavSections, repNavSections, type AppRole, type BrandNavCounts, type NavSection } from '@/lib/roles';
import { PLAN, type PlanKey } from '@/lib/product';
import { repPublicPath } from '@/lib/public-urls';
import type { RoleModeState, SwitchableMode } from '@/lib/role-mode';
import {
  brandHref,
  brandPathKey,
  readSelectedBrandKey,
  resolveSelectedBrand,
  writeSelectedBrandKey,
  writeBrandDeskMode,
  SELECTED_BRAND_COOKIE,
  type BrandDeskMode,
  type BrandRef,
} from '@/lib/brand-context';
import {
  writeAdminDeskMode,
  type AdminDeskMode,
} from '@/lib/admin-context';
import {
  CANONICAL_DEMO_BRANDS,
  getDemoBrandNavCounts,
  getDemoKpis,
  getDemoTeam,
} from '@/lib/demo/brand-demo-data';
import type { ShellBootstrap } from '@/lib/shell-bootstrap';

const FALLBACK = NAV_SECTIONS_BY_ROLE.REP;
const SIDEBAR_COLLAPSED_KEY = 'ccr-sidebar-collapsed';

function demoNavForBrand(key: string | null | undefined) {
  return getDemoBrandNavCounts(key || 'demo-meridianops');
}

type MeMetrics = {
  minutesRemaining: number | null;
  minutesUsed: number | null;
  totalPoints: number | null;
  currentStreak: number | null;
  globalRank: number | null;
  globalRankPool: number | null;
  plan: string | null;
  profileSlug: string | null;
};

type BrandTopMetrics = {
  walletLabel: string | null;
  openCampaigns: number | null;
  teamCount: number | null;
  /** used/available e.g. "45/100" */
  leadCreditsLabel: string | null;
};

function pathBrandKey(pathname: string): string | null {
  const m = pathname.match(/^\/brands\/([^/]+)/);
  return m?.[1] || null;
}

function syncBrandCookie(key: string) {
  try {
    document.cookie = `${SELECTED_BRAND_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  // Command center is exact /admin — nested ops pages use their own nav items
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
  // /brands list should not highlight for nested brand routes
  if (href === '/brands') return pathname === '/brands' || pathname === '/brands/';
  // Brand dashboard is exact /brands/[id] only — not campaigns/leads/etc.
  if (/^\/brands\/[^/]+$/.test(href)) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function planLabel(plan: string | null) {
  if (!plan) return 'Free';
  const meta = PLAN[plan as PlanKey];
  return meta?.label || plan;
}

function CollapseGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M13 12h5M16 9.5L18.5 12 16 14.5" /> : <path d="M14 12H11M12.5 9.5L10 12l2.5 2.5" />}
    </svg>
  );
}

function SwitchModeGlyph({ mode }: { mode: SwitchableMode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {mode === 'BRAND' ? (
        <>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </>
      ) : (
        <>
          <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </>
      )}
    </svg>
  );
}

export default function AppShell({
  children,
  initial = null,
}: {
  children: React.ReactNode;
  initial?: ShellBootstrap | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pathKey = pathBrandKey(pathname);

  const [sections, setSections] = useState<NavSection[]>(
    () =>
      initial?.sections ||
      (pathKey ? brandNavSections(pathKey) : FALLBACK)
  );
  const [role, setRole] = useState<AppRole>(
    () => initial?.role || (pathKey ? 'BRAND' : 'REP')
  );
  const [roleMode, setRoleMode] = useState<RoleModeState | null>(
    () => initial?.roleMode || null
  );
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapseHydrated, setCollapseHydrated] = useState(false);
  const [metrics, setMetrics] = useState<MeMetrics>(
    () =>
      initial?.metrics || {
        minutesRemaining: null,
        minutesUsed: null,
        totalPoints: null,
        currentStreak: null,
        globalRank: null,
        globalRankPool: null,
        plan: null,
        profileSlug: null,
      }
  );
  const [ownedBrands, setOwnedBrands] = useState<BrandRef[]>(
    () => initial?.brands || []
  );
  const [selectedBrand, setSelectedBrand] = useState<BrandRef | null>(
    () => initial?.selectedBrand || null
  );
  const [createBrandOpen, setCreateBrandOpen] = useState(false);
  const [brandMetrics, setBrandMetrics] = useState<BrandTopMetrics>({
    walletLabel: null,
    openCampaigns: null,
    teamCount: null,
    leadCreditsLabel: null,
  });
  const [deskMode, setDeskModeState] = useState<BrandDeskMode>(
    () => initial?.deskMode || 'live'
  );
  const [adminDeskMode, setAdminDeskModeState] = useState<AdminDeskMode>(
    () => initial?.adminDeskMode || 'live'
  );
  const setDeskMode = useCallback(
    (mode: BrandDeskMode) => {
      writeBrandDeskMode(mode);
      setDeskModeState(mode);
      if (role !== 'BRAND' && role !== 'RECRUITER') return;

      if (mode === 'demo') {
        const demo = CANONICAL_DEMO_BRANDS[0];
        if (demo) {
          const nextKey = brandPathKey(demo);
          const next: BrandRef = {
            id: demo.id,
            slug: demo.slug,
            name: demo.name,
            logoUrl: demo.logoUrl,
          };
          setSelectedBrand(next);
          writeSelectedBrandKey(nextKey);
          syncBrandCookie(nextKey);
          setSections(
            brandNavSections(nextKey, demoNavForBrand(nextKey))
          );
          const m = pathname.match(/^\/brands\/[^/]+(\/.*)?$/);
          if (m) {
            const rest = m[1] && m[1] !== '/' ? m[1].replace(/^\//, '') : '';
            router.push(rest ? `/brands/${nextKey}/${rest}` : `/brands/${nextKey}`);
          } else {
            router.push(`/brands/${nextKey}`);
          }
        }
        return;
      }

      // Live: prefer current owned selection, else first owned brand.
      const fromPath = pathBrandKey(pathname);
      const ownedHit =
        (fromPath && ownedBrands.find((b) => brandPathKey(b) === fromPath)) ||
        (selectedBrand &&
          ownedBrands.find((b) => brandPathKey(b) === brandPathKey(selectedBrand))) ||
        ownedBrands[0] ||
        null;
      const key = ownedHit ? brandPathKey(ownedHit) : pathKey;
      if (ownedHit && key) {
        setSelectedBrand(ownedHit);
        writeSelectedBrandKey(key);
        syncBrandCookie(key);
      }
      setSections(brandNavSections(key));
      if (ownedHit && key && fromPath && !ownedBrands.some((b) => brandPathKey(b) === fromPath)) {
        router.push(`/brands/${key}`);
      }
    },
    [selectedBrand, pathKey, role, pathname, ownedBrands, router]
  );
  const setAdminDeskMode = useCallback((mode: AdminDeskMode) => {
    writeAdminDeskMode(mode);
    setAdminDeskModeState(mode);
  }, []);
  const deskHydrated = true;
  const isBrandDesk = role === 'BRAND' || role === 'RECRUITER';
  const switcherBrands = useMemo(() => {
    if (deskMode !== 'demo' || !isBrandDesk) return ownedBrands;
    return CANONICAL_DEMO_BRANDS.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      logoUrl: b.logoUrl,
    }));
  }, [deskMode, isBrandDesk, ownedBrands]);

  useEffect(() => {
    if (!isBrandDesk) return;
    if (deskMode === 'demo') {
      const fromPath = pathBrandKey(pathname);
      const demoHit = switcherBrands.find((b) => brandPathKey(b) === fromPath);
      // Stay in Demo while browsing demo URLs — never auto-flip to Live just because
      // an owned brand briefly matched selection during a router race.
      if (demoHit) {
        const key = brandPathKey(demoHit);
        if (!selectedBrand || brandPathKey(selectedBrand) !== key) {
          setSelectedBrand(demoHit);
          writeSelectedBrandKey(key);
          syncBrandCookie(key);
        }
        return;
      }
      const selectedKey = selectedBrand ? brandPathKey(selectedBrand) : '';
      const inDemo = switcherBrands.some((b) => brandPathKey(b) === selectedKey);
      if (!inDemo && switcherBrands[0]) {
        setSelectedBrand(switcherBrands[0]);
        writeSelectedBrandKey(brandPathKey(switcherBrands[0]));
      }
      return;
    }
    const key = selectedBrand ? brandPathKey(selectedBrand) : '';
    const inOwned = ownedBrands.some((b) => brandPathKey(b) === key);
    if (!inOwned && ownedBrands[0]) {
      setSelectedBrand(ownedBrands[0]);
      writeSelectedBrandKey(brandPathKey(ownedBrands[0]));
    }
  }, [deskMode, isBrandDesk, selectedBrand, switcherBrands, ownedBrands, pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === '1' || stored === 'true') setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
    setCollapseHydrated(true);
  }, []);

  useEffect(() => {
    if (!collapseHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, collapseHydrated]);

  // One-time soft refresh for rank / minutes; never resets nav to SDR.
  useEffect(() => {
    let cancelled = false;
    // Skip heavy /api/me when SSR already seeded shell metrics.
    const meUrl = initial?.metrics ? '/api/me?fields=metrics' : '/api/me';
    fetch(meUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        // Never invent REP when the soft refresh omits platformRole.
        if (d.platformRole) setRole(d.platformRole as AppRole);
        if (d.roleMode) setRoleMode(d.roleMode);
        setMetrics((prev) => ({
          minutesRemaining:
            typeof d.minutesRemaining === 'number' ? d.minutesRemaining : prev.minutesRemaining,
          minutesUsed: typeof d.minutesUsed === 'number' ? d.minutesUsed : prev.minutesUsed,
          totalPoints: typeof d.totalPoints === 'number' ? d.totalPoints : prev.totalPoints,
          currentStreak:
            typeof d.currentStreak === 'number' ? d.currentStreak : prev.currentStreak,
          globalRank: typeof d.globalRank === 'number' ? d.globalRank : prev.globalRank,
          globalRankPool:
            typeof d.globalRankPool === 'number' ? d.globalRankPool : prev.globalRankPool,
          plan: d.plan || prev.plan || 'FREE',
          profileSlug: d.profileSlug || prev.profileSlug,
        }));

        const r = (d.platformRole || initial?.role || role) as AppRole;
        if (r === 'BRAND' || r === 'RECRUITER') {
          // SSR already seeded brand list — skip the heavy refetch on mobile.
          if (Array.isArray(initial?.brands)) {
            if (initial.brands.length === 0) setCreateBrandOpen(true);
            return;
          }
          fetch('/api/brands?mine=1&minimal=1')
            .then((res) => (res.ok ? res.json() : null))
            .then((bd) => {
              if (cancelled) return;
              const list: BrandRef[] = (bd?.brands || []).map(
                (b: BrandRef & { logoUrl?: string | null }) => ({
                  id: b.id,
                  slug: b.slug,
                  name: b.name,
                  logoUrl: b.logoUrl,
                })
              );
              setOwnedBrands(list);
              // Don't overwrite demo selection with owned brands on soft refresh.
              if (deskMode === 'demo' || (typeof window !== 'undefined' && document.cookie.includes('ccr-brand-desk-mode=demo'))) {
                return;
              }
              const fromPath = pathBrandKey(pathname);
              const resolved = resolveSelectedBrand(list, fromPath || readSelectedBrandKey());
              setSelectedBrand(resolved);
              if (resolved) {
                const key = brandPathKey(resolved);
                writeSelectedBrandKey(key);
                syncBrandCookie(key);
                // KPIs effect will attach nav counts — keep placeholders without wiping later.
                setSections(brandNavSections(key, { brands: list.length }));
              } else {
                setSections(brandNavSections(null, { brands: list.length }));
              }
              if (list.length === 0) setCreateBrandOpen(true);
            })
            .catch(() => {
              if (!cancelled) {
                setSections(brandNavSections(null));
                setCreateBrandOpen(true);
              }
            });
        } else if (r === 'REP') {
          fetch('/api/me/nav-counts')
            .then((res) => (res.ok ? res.json() : null))
            .then((nd) => {
              if (cancelled || !nd?.counts) return;
              setSections(repNavSections(nd.counts));
            })
            .catch(() => {});
          if (!initial?.sections) {
            setSections(NAV_SECTIONS_BY_ROLE[r] || FALLBACK);
          }
        } else if (!initial?.sections) {
          // Only seed SDR nav when SSR did not already provide it.
          setSections(NAV_SECTIONS_BY_ROLE[r] || FALLBACK);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Mount-only: role/nav come from SSR; this only soft-refreshes metrics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep brand-scoped nav in sync when the URL brand changes (no /api/me).
  useEffect(() => {
    if (!isBrandDesk) return;
    const fromPath = pathBrandKey(pathname);
    if (!fromPath) return;

    if (deskMode === 'demo') {
      const demoHit = switcherBrands.find((b) => brandPathKey(b) === fromPath);
      if (!demoHit) return;
      const key = brandPathKey(demoHit);
      if (!selectedBrand || brandPathKey(selectedBrand) !== key) {
        setSelectedBrand(demoHit);
        writeSelectedBrandKey(key);
        syncBrandCookie(key);
      }
      setSections(
        brandNavSections(key, demoNavForBrand(key))
      );
      return;
    }

    if (ownedBrands.length === 0) return;
    const resolved = resolveSelectedBrand(ownedBrands, fromPath);
    if (!resolved) return;
    const key = brandPathKey(resolved);
    if (selectedBrand && brandPathKey(selectedBrand) === key) {
      // Counts refresh via KPIs effect — don't wipe badges here.
      return;
    }
    setSelectedBrand(resolved);
    writeSelectedBrandKey(key);
    syncBrandCookie(key);
    setSections(brandNavSections(key));
  }, [pathname, isBrandDesk, ownedBrands, selectedBrand, deskMode, switcherBrands]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isBrandDesk) {
      setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null, leadCreditsLabel: null });
      return;
    }
    if (!deskHydrated) return;

    if (deskMode === 'demo') {
      const key = selectedBrand ? brandPathKey(selectedBrand) : 'demo-meridianops';
      const kpis = getDemoKpis(key);
      setBrandMetrics({
        walletLabel: kpis.escrowLabel.replace(/\.00$/, ''),
        openCampaigns: kpis.openCampaigns,
        teamCount: getDemoTeam(key).length,
        leadCreditsLabel: `${kpis.leadCreditsUsed ?? 0}/${kpis.leadCreditsAvailable ?? 100}`,
      });
      setSections(brandNavSections(key, demoNavForBrand(key)));
      return;
    }

    const key = selectedBrand ? brandPathKey(selectedBrand) : null;
    if (!key) {
      setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null, leadCreditsLabel: null });
      return;
    }

    let cancelled = false;
    fetch(`/api/brands/${encodeURIComponent(key)}/kpis`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.kpis) return;
        setBrandMetrics({
          walletLabel: typeof d.kpis.escrowLabel === 'string' ? d.kpis.escrowLabel : null,
          openCampaigns:
            typeof d.kpis.openCampaigns === 'number' ? d.kpis.openCampaigns : null,
          teamCount: typeof d.kpis.activeSdrs === 'number' ? d.kpis.activeSdrs : null,
          leadCreditsLabel:
            typeof d.kpis.leadCreditsLabel === 'string'
              ? d.kpis.leadCreditsLabel
              : d.kpis.leadCreditsUsed != null && d.kpis.leadCreditsAvailable != null
                ? `${d.kpis.leadCreditsUsed}/${d.kpis.leadCreditsAvailable}`
                : null,
        });
        if (d.nav) {
          const nav = d.nav as BrandNavCounts;
          setSections(
            brandNavSections(key, {
              ...nav,
              brands: ownedBrands.length || nav.brands,
            })
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null, leadCreditsLabel: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isBrandDesk, deskHydrated, deskMode, selectedBrand, ownedBrands.length]);

  // SDR sidebar pills (Brand deals / Cold Call / Earnings)
  useEffect(() => {
    if (isBrandDesk || role !== 'REP') return;
    let cancelled = false;
    fetch('/api/me/nav-counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.counts) return;
        setSections(repNavSections(d.counts));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isBrandDesk, role]);

  const breadcrumbs = useMemo(() => {
    type Crumb = { label: string; href?: string };
    const crumbs: Crumb[] = [];

    const brandMatch = pathname.match(/^\/brands\/([^/]+)(?:\/(.*))?$/);
    if (brandMatch && isBrandDesk) {
      const key = brandMatch[1];
      const rest = (brandMatch[2] || '').replace(/\/$/, '');
      const brandName =
        selectedBrand && brandPathKey(selectedBrand) === key
          ? selectedBrand.name
          : deskMode === 'demo'
            ? CANONICAL_DEMO_BRANDS.find((b) => b.slug === key || b.id === key)?.name ||
              key
            : ownedBrands.find((b) => brandPathKey(b) === key)?.name || key;

      if (rest) {
        crumbs.push({ label: brandName, href: `/brands/${key}` });
        const segmentLabels: Record<string, string> = {
          campaigns: 'Campaigns',
          playbooks: 'Playbooks',
          leads: 'Leads',
          goals: 'Verified goals',
          calls: 'Calls',
          pipeline: 'Generate leads',
          practice: 'Practice',
          settings: 'Settings',
          'sdrs/applications': 'Recruit',
          'sdrs/team': 'Team',
          'sdrs/payouts': 'Payouts',
        };
        const known =
          segmentLabels[rest] ||
          segmentLabels[rest.split('/').slice(0, 2).join('/')] ||
          null;
        if (known) {
          crumbs.push({ label: known });
        } else if (rest.startsWith('campaigns/')) {
          crumbs.push({ label: 'Campaigns', href: `/brands/${key}/campaigns` });
          crumbs.push({ label: 'Campaign' });
        } else if (rest.startsWith('playbooks/')) {
          crumbs.push({ label: 'Playbooks', href: `/brands/${key}/playbooks` });
          crumbs.push({ label: 'Playbook' });
        } else if (rest.startsWith('leads/')) {
          crumbs.push({ label: 'Leads', href: `/brands/${key}/leads` });
          crumbs.push({ label: 'Lead' });
        } else {
          crumbs.push({ label: rest.split('/').pop() || 'App' });
        }
      } else {
        crumbs.push({ label: brandName });
        crumbs.push({ label: 'Overview' });
      }
      return crumbs;
    }

    if (pathname === '/brands' || pathname === '/brands/') {
      return [{ label: 'My brands' }];
    }

    for (const section of sections) {
      const hit = section.items.find((item) => isActive(pathname, item.href));
      if (hit) {
        return [{ label: hit.label }];
      }
    }
    if (pathname.startsWith('/sessions')) return [{ label: 'Past calls' }];
    if (pathname.startsWith('/onboarding')) return [{ label: 'Onboarding' }];
    return [{ label: 'App' }];
  }, [pathname, sections, isBrandDesk, selectedBrand, ownedBrands, deskMode]);

  const minutesLeft = metrics.minutesRemaining;
  const linkTitle = (label: string) => (sidebarCollapsed ? label : undefined);
  // Prefer roleMode; fall back to active role so the toggle never disappears after a stale shell.
  const switchTarget: SwitchableMode | null =
    roleMode?.switchTarget ??
    (role === 'REP' ? 'BRAND' : role === 'BRAND' || role === 'RECRUITER' ? 'REP' : null);
  const switchLabel =
    switchTarget === 'BRAND'
      ? 'Switch to Brand'
      : switchTarget === 'REP'
        ? 'Switch to SDR'
        : null;

  async function switchMode(target: SwitchableMode) {
    if (switchBusy) return;
    setSwitchBusy(true);
    setSwitchError(null);
    setMenuOpen(false);
    try {
      const modeStatus = roleMode?.modes?.[target];
      // Brand needs creation when not onboarded (unless they already own a brand).
      // SDR unlocks via PATCH — no accept page.
      const brandOwnerBypass =
        target === 'BRAND' && ownedBrands.length > 0;
      if (
        target === 'BRAND' &&
        modeStatus &&
        !modeStatus.onboarded &&
        !brandOwnerBypass
      ) {
        window.location.href = modeStatus.onboardingPath;
        return;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeRole: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.onboardingPath) {
        window.location.href = data.onboardingPath;
        return;
      }
      if (!res.ok) {
        const err =
          data.error || data.notice || `Could not switch to ${target === 'REP' ? 'SDR' : 'Brand'}`;
        setSwitchError(err);
        console.warn('[switchMode]', err);
        return;
      }
      window.location.href = data.redirectTo || '/dashboard';
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Switch failed';
      setSwitchError(err);
      console.warn('[switchMode]', e);
    } finally {
      setSwitchBusy(false);
    }
  }

  const sidebar = (
    <>
      <div className="app-sidebar__brand">
        <BrandMark href={role === 'SUPERADMIN' ? '/admin' : '/dashboard'} size="md" className="app-sidebar__brand-link" />
        <button
          type="button"
          className="app-sidebar__collapse-btn"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed((c) => !c)}
        >
          <CollapseGlyph collapsed={sidebarCollapsed} />
        </button>
      </div>

      <div className="app-sidebar__scroll">
        {sections.map((section) => (
          <div key={section.id} className="app-nav-section">
            {section.label ||
            (section.id === 'brand' && (role === 'BRAND' || role === 'RECRUITER')) ? (
              <div className="app-nav-section__head">
                {section.label ? (
                  <p className="app-nav-section__label">{section.label}</p>
                ) : null}
                {section.id === 'brand' && (role === 'BRAND' || role === 'RECRUITER') ? (
                  <div className="app-brand-controls">
                    <select
                      className="field app-brand-switcher app-brand-switcher--inline"
                      aria-label="Selected brand"
                      value={selectedBrand ? brandPathKey(selectedBrand) : ''}
                      onChange={(e) => {
                        const key = e.target.value;
                        if (key === '__create__') {
                          setCreateBrandOpen(true);
                          return;
                        }
                        const next = switcherBrands.find((b) => brandPathKey(b) === key) || null;
                        setSelectedBrand(next);
                        if (next) {
                          const nextKey = brandPathKey(next);
                          writeSelectedBrandKey(nextKey);
                          syncBrandCookie(nextKey);
                          setSections(
                            brandNavSections(
                              nextKey,
                              deskMode === 'demo'
                                ? demoNavForBrand(nextKey)
                                : { brands: switcherBrands.length }
                            )
                          );
                          const m = pathname.match(/^\/brands\/[^/]+(\/.*)?$/);
                          if (m) {
                            const rest = m[1] && m[1] !== '/' ? m[1].replace(/^\//, '') : '';
                            router.push(rest ? `/brands/${nextKey}/${rest}` : `/brands/${nextKey}`);
                          } else if (pathname === '/dashboard') {
                            router.refresh();
                          } else if (pathname === '/brands' || pathname === '/brands/') {
                            router.push(`/brands/${nextKey}`);
                          } else {
                            router.push(`/brands/${nextKey}`);
                          }
                        }
                      }}
                    >
                      {switcherBrands.length === 0 ? <option value="">No brands yet</option> : null}
                      {switcherBrands.map((b) => (
                        <option key={b.id} value={brandPathKey(b)}>
                          {b.name}
                        </option>
                      ))}
                      {deskMode === 'live' ? (
                        <option value="__create__">+ Create brand…</option>
                      ) : null}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
            <ul className="app-nav-section__list">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={`${section.id}-${item.href}`}>
                    <Link
                      href={item.href}
                      className={`app-nav-link${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      title={linkTitle(item.label)}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="app-nav-link__icon">
                        <NavIconGlyph name={item.icon} />
                      </span>
                      <span className="app-nav-link__label">{item.label}</span>
                      {item.badge != null && item.badge !== '' ? (
                        <span className="app-nav-link__badge" aria-label={`${item.badge} items`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="app-sidebar__footer">
        {(role === 'BRAND' || role === 'RECRUITER') && (
          <div
            className="app-desk-mode app-desk-mode--footer"
            role="group"
            aria-label="Brand desk mode"
          >
            <button
              type="button"
              className={`app-desk-mode__btn${deskMode === 'live' ? ' is-active' : ''}`}
              aria-pressed={deskMode === 'live'}
              title="Live — real campaign leads & dials"
              onClick={() => setDeskMode('live')}
            >
              Live
            </button>
            <button
              type="button"
              className={`app-desk-mode__btn${deskMode === 'demo' ? ' is-active' : ''}`}
              aria-pressed={deskMode === 'demo'}
              title="Demo — sample brand desk data (not written to Live CRM)"
              onClick={() => setDeskMode('demo')}
            >
              Demo
            </button>
          </div>
        )}
        {role === 'SUPERADMIN' && (
          <div
            className="app-desk-mode app-desk-mode--footer"
            role="group"
            aria-label="Ops desk mode"
          >
            <button
              type="button"
              className={`app-desk-mode__btn${adminDeskMode === 'live' ? ' is-active' : ''}`}
              aria-pressed={adminDeskMode === 'live'}
              title="Live — real platform ops data"
              onClick={() => setAdminDeskMode('live')}
            >
              Live
            </button>
            <button
              type="button"
              className={`app-desk-mode__btn${adminDeskMode === 'demo' ? ' is-active' : ''}`}
              aria-pressed={adminDeskMode === 'demo'}
              title="Demo — sample ops data (read-only, not written live)"
              onClick={() => setAdminDeskMode('demo')}
            >
              Demo
            </button>
          </div>
        )}
        {metrics.profileSlug &&
          role !== 'BRAND' &&
          role !== 'RECRUITER' &&
          role !== 'SUPERADMIN' && (
          <Link
            href={repPublicPath(metrics.profileSlug)}
            className="app-nav-link"
            target="_blank"
            rel="noopener noreferrer"
            title={linkTitle('Public profile')}
            onClick={() => setMenuOpen(false)}
            style={{ marginBottom: '0.35rem' }}
          >
            <span className="app-nav-link__icon">
              <NavIconGlyph name="profile" />
            </span>
            <span className="app-nav-link__label">Public profile</span>
          </Link>
        )}
        {switchTarget && switchLabel && (
          <button
            type="button"
            className="app-nav-link app-mode-switch"
            title={linkTitle(switchLabel)}
            disabled={switchBusy}
            onClick={() => switchMode(switchTarget)}
          >
            <span className="app-nav-link__icon">
              <SwitchModeGlyph mode={switchTarget} />
            </span>
            <span className="app-nav-link__label">
              {switchBusy ? 'Switching…' : switchLabel}
            </span>
          </button>
        )}
        {switchError ? (
          <p className="app-mode-switch__error" role="alert">
            {switchError}
          </p>
        ) : null}
        <div className="app-sidebar__clerk">
          {role !== 'SUPERADMIN' ? (
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl="/academy"
              afterSelectOrganizationUrl="/academy"
              appearance={{
                variables: {
                  colorPrimary: 'var(--accent)',
                  colorBackground: 'var(--bg-elevated)',
                  colorInputBackground: 'var(--bg-soft)',
                  colorInputText: 'var(--ink)',
                  colorText: 'var(--ink)',
                  colorTextSecondary: 'var(--muted)',
                  colorNeutral: 'var(--muted)',
                  borderRadius: '0.5rem',
                },
                elements: {
                  rootBox: { width: '100%' },
                  organizationSwitcherTrigger: {
                    width: '100%',
                    justifyContent: 'space-between',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '0.45rem 0.65rem',
                    background: 'var(--bg-soft)',
                    color: 'var(--ink)',
                  },
                },
              }}
            />
          ) : null}
          <UserButton
            appearance={{
              variables: {
                colorPrimary: 'var(--accent)',
                colorBackground: 'var(--bg-elevated)',
                colorText: 'var(--ink)',
                colorTextSecondary: 'var(--muted)',
              },
              elements: {
                avatarBox: { width: 32, height: 32 },
              },
            }}
          />
        </div>
      </div>
    </>
  );

  const shellClass = [
    'app-shell',
    menuOpen ? 'is-menu-open' : '',
    sidebarCollapsed ? 'app-shell--sidebar-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Account-type chooser + brand creation — full viewport, no desk chrome.
  if (pathname.startsWith('/onboarding')) {
    return (
      <ShellProvider
        role={role}
        roleMode={roleMode}
        brands={ownedBrands}
        selectedBrand={selectedBrand}
        metrics={metrics}
        deskMode={deskMode}
        setDeskMode={setDeskMode}
        adminDeskMode={adminDeskMode}
        setAdminDeskMode={setAdminDeskMode}
      >
        <div className="app-shell app-shell--onboarding">
          <ImpersonationBanner />
          {children}
        </div>
      </ShellProvider>
    );
  }

  return (
    <ShellProvider
      role={role}
      roleMode={roleMode}
      brands={ownedBrands}
      selectedBrand={selectedBrand}
      metrics={metrics}
      deskMode={deskMode}
      setDeskMode={setDeskMode}
      adminDeskMode={adminDeskMode}
      setAdminDeskMode={setAdminDeskMode}
    >
    <div className={shellClass}>
      <ImpersonationBanner />
      <aside className="app-sidebar app-sidebar--desktop" aria-label="Primary">
        {sidebar}
      </aside>

      <div className="app-frame">
        <header className="app-topbar">
          <button
            type="button"
            className="app-menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="app-menu-btn__bars" data-open={menuOpen} />
          </button>
          <div className="app-topbar__title" aria-label="Breadcrumb">
            <span className="app-topbar__crumb">ColdCallReps</span>
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="app-topbar__crumb-group">
                <span className="app-topbar__sep">/</span>
                {crumb.href ? (
                  <Link href={crumb.href} className="app-topbar__crumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? undefined : 'app-topbar__crumb'}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="app-topbar__right">
            <ThemePicker compact />
            {role !== 'SUPERADMIN' ? (
            <div className="app-metrics" aria-label="Account metrics">
              {isBrandDesk ? (
                <>
                  {brandMetrics.walletLabel != null && (
                    <Link
                      href="/billing"
                      className="app-metric app-metric--accent"
                      title="Escrow wallet balance"
                    >
                      <span className="app-metric__label">Wallet</span>
                      <span className="app-metric__value">{brandMetrics.walletLabel}</span>
                    </Link>
                  )}
                  {brandMetrics.leadCreditsLabel != null && (
                    <Link
                      href="/billing?tab=credits"
                      className="app-metric"
                      title="Lead credits used / available this period"
                    >
                      <span className="app-metric__label">Lead credits</span>
                      <span className="app-metric__value">{brandMetrics.leadCreditsLabel}</span>
                    </Link>
                  )}
                  {brandMetrics.openCampaigns != null && (
                    <Link
                      href={
                        selectedBrand
                          ? brandHref(selectedBrand, 'campaigns')
                          : '/brands'
                      }
                      className="app-metric"
                      title="Open campaigns"
                    >
                      <span className="app-metric__label">Campaigns</span>
                      <span className="app-metric__value">{brandMetrics.openCampaigns}</span>
                    </Link>
                  )}
                  {brandMetrics.teamCount != null && (
                    <Link
                      href={
                        selectedBrand
                          ? brandHref(selectedBrand, 'sdrs', 'team')
                          : '/brands'
                      }
                      className="app-metric app-metric--secondary"
                      title="Active SDRs on this brand"
                    >
                      <span className="app-metric__label">Team</span>
                      <span className="app-metric__value">{brandMetrics.teamCount}</span>
                    </Link>
                  )}
                  <Link href="/subscribe" className="app-metric-upgrade app-metric--secondary">
                    Upgrade →
                  </Link>
                </>
              ) : (
                <>
                  {metrics.globalRank != null && (
                    <Link
                      href="/dashboard#leaderboard"
                      className="app-metric app-metric--rank"
                      title="Global ranking by all-time points"
                    >
                      <span className="app-metric__label">Rank</span>
                      <span className="app-metric__value">
                        #{metrics.globalRank}
                        {metrics.globalRankPool != null && metrics.globalRankPool > 1 ? (
                          <span className="app-metric__of">/{metrics.globalRankPool}</span>
                        ) : null}
                      </span>
                    </Link>
                  )}
                  {minutesLeft != null && (
                    <>
                      <Link
                        href="/subscribe/sdr"
                        className="app-metric app-metric--accent"
                        title="Minutes remaining"
                      >
                        <span className="app-metric__label">Min</span>
                        <span className="app-metric__value">{minutesLeft}</span>
                      </Link>
                      <Link href="/subscribe" className="app-metric-upgrade">
                        Upgrade →
                      </Link>
                    </>
                  )}
                </>
              )}
              <Link href="/subscribe" className="app-metric app-metric--plan" title="Current plan">
                <span className="app-metric__label">Plan</span>
                <span className="app-metric__value">{planLabel(metrics.plan)}</span>
              </Link>
            </div>
            ) : null}
            <div className="app-topbar__user">
              <UserButton />
            </div>
          </div>
        </header>

        <div className="app-content">{children}</div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="app-sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="app-sidebar app-sidebar--drawer" aria-label="Mobile navigation">
            {sidebar}
          </aside>
        </>
      )}

      <CreateBrandModal
        open={createBrandOpen}
        onClose={() => {
          if (ownedBrands.length === 0 && isBrandDesk) return;
          setCreateBrandOpen(false);
        }}
        redirectTo={undefined}
        onCreated={(key, brand) => {
          if (!key) return;
          writeBrandDeskMode('live');
          setDeskModeState('live');
          if (brand) {
            setOwnedBrands((prev) =>
              prev.some((b) => b.id === brand.id || brandPathKey(b) === key)
                ? prev
                : [brand, ...prev]
            );
            setSelectedBrand(brand);
          }
          writeSelectedBrandKey(key);
          syncBrandCookie(key);
          setSections(brandNavSections(key));
        }}
      />
    </div>
    </ShellProvider>
  );
}
