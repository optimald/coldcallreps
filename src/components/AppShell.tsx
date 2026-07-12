'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';
import NavIconGlyph from '@/components/NavIcon';
import ThemePicker from '@/components/ThemePicker';
import { NAV_SECTIONS_BY_ROLE, type AppRole, type NavSection } from '@/lib/roles';
import { PLAN, type PlanKey } from '@/lib/product';
import { repPublicPath } from '@/lib/public-urls';
import type { RoleModeState, SwitchableMode } from '@/lib/role-mode';

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

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sections, setSections] = useState<NavSection[]>(FALLBACK);
  const [role, setRole] = useState<AppRole>('REP');
  const [roleMode, setRoleMode] = useState<RoleModeState | null>(null);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapseHydrated, setCollapseHydrated] = useState(false);
  const [metrics, setMetrics] = useState<MeMetrics>({
    minutesRemaining: null,
    minutesUsed: null,
    totalPoints: null,
    currentStreak: null,
    globalRank: null,
    globalRankPool: null,
    plan: null,
    profileSlug: null,
  });

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

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const r = (d.platformRole || 'REP') as AppRole;
        setRole(r);
        setRoleMode(d.roleMode || null);
        setSections(NAV_SECTIONS_BY_ROLE[r] || FALLBACK);
        setMetrics({
          minutesRemaining: typeof d.minutesRemaining === 'number' ? d.minutesRemaining : null,
          minutesUsed: typeof d.minutesUsed === 'number' ? d.minutesUsed : null,
          totalPoints: typeof d.totalPoints === 'number' ? d.totalPoints : null,
          currentStreak: typeof d.currentStreak === 'number' ? d.currentStreak : null,
          globalRank: typeof d.globalRank === 'number' ? d.globalRank : null,
          globalRankPool: typeof d.globalRankPool === 'number' ? d.globalRankPool : null,
          plan: d.plan || 'FREE',
          profileSlug: d.profileSlug || null,
        });
      })
      .catch(() => {});
  }, [pathname]);

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

  const pageLabel = useMemo(() => {
    for (const section of sections) {
      const hit = section.items.find((item) => isActive(pathname, item.href));
      if (hit) return hit.label;
    }
    if (pathname.startsWith('/onboarding')) return 'Onboarding';
    return 'App';
  }, [pathname, sections]);

  const minutesLeft = metrics.minutesRemaining;
  const linkTitle = (label: string) => (sidebarCollapsed ? label : undefined);
  const switchTarget = roleMode?.switchTarget ?? null;
  const switchLabel =
    switchTarget === 'BRAND'
      ? 'Switch to Brand'
      : switchTarget === 'REP'
        ? 'Switch to SDR'
        : null;

  async function switchMode(target: SwitchableMode) {
    if (switchBusy) return;
    setSwitchBusy(true);
    setMenuOpen(false);
    try {
      const modeStatus = roleMode?.modes?.[target];
      if (modeStatus && !modeStatus.onboarded) {
        router.push(modeStatus.onboardingPath);
        return;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeRole: target }),
      });
      const data = await res.json();
      if (res.status === 409 && data.onboardingPath) {
        router.push(data.onboardingPath);
        return;
      }
      if (!res.ok) {
        console.warn('[switchMode]', data.error || data.notice);
        return;
      }
      window.location.href = data.redirectTo || (target === 'BRAND' ? '/campaigns' : '/dashboard');
    } catch (e) {
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
            <p className="app-nav-section__label">{section.label}</p>
            <ul className="app-nav-section__list">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
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
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="app-sidebar__footer">
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
          <div className="app-topbar__title">
            <span className="app-topbar__crumb">ColdCallReps</span>
            <span className="app-topbar__sep">/</span>
            <span>{pageLabel}</span>
          </div>
          <div className="app-topbar__right">
            <ThemePicker compact />
            <div className="app-metrics" aria-label="Account metrics">
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
                <Link href="/billing" className="app-metric app-metric--accent" title="Minutes remaining">
                  <span className="app-metric__label">Min</span>
                  <span className="app-metric__value">{minutesLeft}</span>
                </Link>
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
    </div>
  );
}
