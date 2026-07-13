'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';
import CreateBrandModal from '@/components/CreateBrandModal';
import NavIconGlyph from '@/components/NavIcon';
import ThemePicker from '@/components/ThemePicker';
import { ShellProvider } from '@/components/ShellProvider';
import { NAV_SECTIONS_BY_ROLE, brandNavSections, type AppRole, type NavSection } from '@/lib/roles';
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
import { CANONICAL_DEMO_BRANDS, getDemoKpis, getDemoTeam } from '@/lib/demo/brand-demo-data';
import type { ShellBootstrap } from '@/lib/shell-bootstrap';

const FALLBACK = NAV_SECTIONS_BY_ROLE.REP;
const SIDEBAR_COLLAPSED_KEY = 'ccr-sidebar-collapsed';

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
  });
  const [deskMode, setDeskModeState] = useState<BrandDeskMode>(
    () => initial?.deskMode || 'live'
  );
  const setDeskMode = useCallback((mode: BrandDeskMode) => {
    writeBrandDeskMode(mode);
    setDeskModeState(mode);
    const key = selectedBrand ? brandPathKey(selectedBrand) : pathKey;
    if (role === 'BRAND' || role === 'RECRUITER') {
      setSections(
        brandNavSections(
          key,
          mode === 'demo'
            ? { leads: 137, generateLeads: 4, liveCalls: 0, campaigns: 2 }
            : undefined
        )
      );
    }
  }, [selectedBrand, pathKey, role]);
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
      const key = selectedBrand ? brandPathKey(selectedBrand) : '';
      const inDemo = switcherBrands.some((b) => brandPathKey(b) === key);
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
  }, [deskMode, isBrandDesk, selectedBrand, switcherBrands, ownedBrands]);

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
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const r = (d.platformRole || 'REP') as AppRole;
        setRole(r);
        setRoleMode(d.roleMode || null);
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

        if (r === 'BRAND' || r === 'RECRUITER') {
          if (initial?.brands?.length) {
            // SSR already seeded brands; only open create if empty.
            if (initial.brands.length === 0) setCreateBrandOpen(true);
          }
          fetch('/api/brands?mine=1')
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
              const fromPath = pathBrandKey(pathname);
              const resolved = resolveSelectedBrand(list, fromPath || readSelectedBrandKey());
              setSelectedBrand(resolved);
              if (resolved) {
                const key = brandPathKey(resolved);
                writeSelectedBrandKey(key);
                syncBrandCookie(key);
              }
              setSections(brandNavSections(resolved ? brandPathKey(resolved) : null));
              if (list.length === 0) setCreateBrandOpen(true);
            })
            .catch(() => {
              if (!cancelled) {
                setSections(brandNavSections(null));
                setCreateBrandOpen(true);
              }
            });
        } else {
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
    if (!fromPath || ownedBrands.length === 0) return;
    const resolved = resolveSelectedBrand(ownedBrands, fromPath);
    if (!resolved) return;
    const key = brandPathKey(resolved);
    if (selectedBrand && brandPathKey(selectedBrand) === key) {
      setSections(brandNavSections(key));
      return;
    }
    setSelectedBrand(resolved);
    writeSelectedBrandKey(key);
    syncBrandCookie(key);
    setSections(brandNavSections(key));
  }, [pathname, isBrandDesk, ownedBrands, selectedBrand]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!isBrandDesk) {
      setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null });
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
      });
      return;
    }

    const key = selectedBrand ? brandPathKey(selectedBrand) : null;
    if (!key) {
      setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null });
      return;
    }

    let cancelled = false;
    fetch(`/api/brands/${encodeURIComponent(key)}/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.kpis) return;
        setBrandMetrics({
          walletLabel: typeof d.kpis.escrowLabel === 'string' ? d.kpis.escrowLabel : null,
          openCampaigns:
            typeof d.kpis.openCampaigns === 'number' ? d.kpis.openCampaigns : null,
          teamCount: typeof d.kpis.activeSdrs === 'number' ? d.kpis.activeSdrs : null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBrandMetrics({ walletLabel: null, openCampaigns: null, teamCount: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isBrandDesk, deskHydrated, deskMode, selectedBrand]);

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
          : ownedBrands.find((b) => brandPathKey(b) === key)?.name || key;

      if (rest) {
        crumbs.push({ label: brandName, href: `/brands/${key}` });
        const segmentLabels: Record<string, string> = {
          campaigns: 'Campaigns',
          leads: 'Leads',
          calls: 'Calls',
          pipeline: 'Pipeline',
          practice: 'Practice',
          settings: 'Settings',
          'sdrs/applications': 'Applications',
          'sdrs/team': 'Team',
          'sdrs/stats': 'Stats',
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
        } else if (rest.startsWith('leads/')) {
          crumbs.push({ label: 'Leads', href: `/brands/${key}/leads` });
          crumbs.push({ label: 'Lead' });
        } else {
          crumbs.push({ label: rest.split('/').pop() || 'App' });
        }
      } else {
        crumbs.push({ label: brandName });
        crumbs.push({ label: 'Dashboard' });
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
  }, [pathname, sections, isBrandDesk, selectedBrand, ownedBrands]);

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
      if (modeStatus && !modeStatus.onboarded) {
        // Full navigation so AppShell remounts with the post-onboarding role.
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
        <BrandMark href="/dashboard" size="md" className="app-sidebar__brand-link" />
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
                                ? { leads: 45, generateLeads: 2, liveCalls: 0, campaigns: 2 }
                                : undefined
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
        {metrics.profileSlug && role !== 'BRAND' && role !== 'RECRUITER' && (
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

  return (
    <ShellProvider
      role={role}
      roleMode={roleMode}
      brands={ownedBrands}
      selectedBrand={selectedBrand}
      metrics={metrics}
      deskMode={deskMode}
      setDeskMode={setDeskMode}
    >
    <div className={shellClass}>
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
                      className="app-metric"
                      title="Active SDRs on this brand"
                    >
                      <span className="app-metric__label">Team</span>
                      <span className="app-metric__value">{brandMetrics.teamCount}</span>
                    </Link>
                  )}
                  <Link href="/billing" className="app-metric-upgrade">
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
                        href="/billing"
                        className="app-metric app-metric--accent"
                        title="Minutes remaining"
                      >
                        <span className="app-metric__label">Min</span>
                        <span className="app-metric__value">{minutesLeft}</span>
                      </Link>
                      <Link href="/billing" className="app-metric-upgrade">
                        Upgrade →
                      </Link>
                    </>
                  )}
                </>
              )}
              <Link href="/billing" className="app-metric app-metric--plan" title="Current plan">
                <span className="app-metric__label">Plan</span>
                <span className="app-metric__value">{planLabel(metrics.plan)}</span>
              </Link>
            </div>
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
        onCreated={(key) => {
          if (!key) return;
          writeSelectedBrandKey(key);
          syncBrandCookie(key);
          setSections(brandNavSections(key));
        }}
      />
    </div>
    </ShellProvider>
  );
}
