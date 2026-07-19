'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import {
  BrandCompareBars,
  BudgetDonut,
  DeskTrendLines,
  RunwayMeter,
} from '@/components/DeskCharts';
import {
  brandHref,
  brandPathKey,
  writeSelectedBrandKey,
  type BrandRef,
} from '@/lib/brand-context';
import type { BrandEconomics, DeskSignal, DeskTone } from '@/lib/desk-economics';
import { formatDays, formatUsd } from '@/lib/desk-economics';
import { buildDemoPortfolio } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { useShell } from '@/components/ShellProvider';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';

type PortfolioBrand = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  openCampaigns: number;
  walletLabel: string;
  balanceCents: number;
  economics: BrandEconomics;
  risk: number;
};

type PortfolioException = {
  brandId: string;
  brandKey: string;
  brandName: string;
  logoUrl?: string | null;
  signal: DeskSignal;
};

type PortfolioPayload = {
  brandCount: number;
  kpis: {
    openCampaigns: number;
    pendingApplications: number;
    activeSdrs: number;
    leads: number;
    callsToday: number;
    bookings: number;
    escrowLabel: string;
    goalsPerWeek: number;
    costPerGoalLabel: string;
    brandsAtRisk: number;
  };
  dialVolume: { key: string; label: string; count: number }[];
  brands: PortfolioBrand[];
  exceptions: PortfolioException[];
  activity: {
    applications: {
      id: string;
      status: string;
      createdAt: string;
      repName: string;
      campaignTitle: string;
      brandName: string;
      brandKey: string;
    }[];
    calls: {
      id: string;
      status: string;
      createdAt: string;
      durationSec: number | null;
      companyName: string;
      repName: string;
      brandName: string;
      brandKey: string;
    }[];
  };
};

function toneClass(tone: DeskTone) {
  return `portfolio-action portfolio-action--${tone}`;
}

export default function PortfolioHomeClient({
  greetingName,
  initialBrands,
  initialDeskMode,
  initialPortfolio,
}: {
  greetingName: string;
  initialBrands?: BrandRef[];
  initialDeskMode?: 'live' | 'demo';
  initialPortfolio?: PortfolioPayload | null;
}) {
  const shell = useShell();
  const { mode, hydrated } = useBrandDeskMode(initialDeskMode || shell?.deskMode);
  const [owned, setOwned] = useState<BrandRef[]>(
    () => initialBrands || shell?.brands || []
  );
  const [data, setData] = useState<PortfolioPayload | null>(() => {
    if (initialPortfolio) return initialPortfolio;
    const desk = initialDeskMode || shell?.deskMode || 'live';
    if (desk === 'demo') return buildDemoPortfolio() as PortfolioPayload;
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (initialPortfolio) return false;
    const desk = initialDeskMode || shell?.deskMode || 'live';
    if (desk === 'demo') return false;
    return true;
  });

  useEffect(() => {
    if (initialBrands?.length || shell?.brands?.length) {
      setOwned(initialBrands || shell?.brands || []);
      return;
    }
    let cancelled = false;
    fetch('/api/brands?mine=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setOwned(
          (d?.brands || []).map((b: BrandRef) => ({
            id: b.id,
            slug: b.slug,
            name: b.name,
            logoUrl: b.logoUrl,
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialBrands, shell?.brands]);

  useEffect(() => {
    if (!hydrated) return;
    if (mode === 'demo') {
      // Keep SSR demo snapshot — re-rolling Date-based series causes hydration churn.
      if (initialDeskMode === 'demo' && initialPortfolio) {
        setData(initialPortfolio);
        setLoading(false);
        return;
      }
      setData(buildDemoPortfolio() as PortfolioPayload);
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (!initialPortfolio || initialDeskMode === 'demo') setLoading(true);
    fetch('/api/brands/portfolio')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.kpis) setData(d as PortfolioPayload);
      })
      .catch(() => {
        if (!cancelled && !data) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, mode]);

  const series = useMemo(() => {
    if (!data?.brands.length) return [];
    const base = (data.brands[0].economics.series || []).map((p) => ({ ...p }));
    for (let i = 1; i < data.brands.length; i++) {
      const next = data.brands[i].economics.series || [];
      for (let d = 0; d < base.length; d++) {
        const point = next[d];
        if (!point) continue;
        base[d].leads += point.leads;
        base[d].goals += point.goals;
        base[d].dials += point.dials;
        base[d].spendCents += point.spendCents;
      }
    }
    return base;
  }, [data]);

  const portfolioBudget = useMemo(() => {
    if (!data?.brands.length) return { budgetCents: null as number | null, spentCents: 0 };
    let budget = 0;
    let spent = 0;
    let anyCapped = false;
    for (const b of data.brands) {
      spent += b.economics.budget.spentCents;
      if (b.economics.budget.budgetCents != null) {
        budget += b.economics.budget.budgetCents;
        anyCapped = true;
      }
    }
    return { budgetCents: anyCapped ? budget : null, spentCents: spent };
  }, [data]);

  const portfolioRunway = useMemo(() => {
    if (!data?.brands.length) {
      return { days: null as number | null, dialReady: 0, avgCallsPerDay: 0 };
    }
    const dialReady = data.brands.reduce((s, b) => s + b.economics.dialReadyLeads, 0);
    const avgCallsPerDay = data.brands.reduce((s, b) => s + b.economics.avgCallsPerDay, 0);
    const days = avgCallsPerDay > 0 ? dialReady / avgCallsPerDay : null;
    return { days, dialReady, avgCallsPerDay };
  }, [data]);

  if (!hydrated || loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading portfolio…</p>
      </main>
    );
  }

  if (!data || (data.brandCount === 0 && mode !== 'demo')) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Portfolio"
          title={`Hey ${greetingName}`}
          description="Cross-brand command center — compare velocity, runway, and budget across every brand you own."
        />
        <EmptyState
          title="No brands yet"
          description="Create a brand to unlock campaigns, escrow, and SDR hiring."
          action={
            <Link href="/brands?create=1" className="btn" style={{ marginTop: '1rem' }}>
              Create brand
            </Link>
          }
        />
      </main>
    );
  }

  const kpis = data.kpis;
  const worst = data.brands[0];

  return (
    <main className="app-page app-page--desk dashboard-page portfolio-home-page">
      <PageHeader
        compact
        eyebrow="Portfolio"
        title={`Hey ${greetingName}`}
        description={
          mode === 'demo'
            ? `Demo · ${data.brandCount} brands · compare velocity, runway, and budget across the portfolio`
            : `${data.brandCount} brand${data.brandCount === 1 ? '' : 's'} · compare velocity, runway, and budget — open a brand desk for deep ops`
        }
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/brands" className="btn-ghost">
              My brands
            </Link>
            {worst ? (
              <Link
                href={brandHref(worst)}
                className="btn"
                onClick={() => writeSelectedBrandKey(brandPathKey(worst))}
              >
                Open {worst.name}
              </Link>
            ) : (
              <Link href="/brands?create=1" className="btn">
                Create brand
              </Link>
            )}
          </div>
        }
      />

      <StatGrid>
        <Stat label="Brands" value={data.brandCount} />
        <Stat
          label="At risk"
          value={kpis.brandsAtRisk}
          tone={kpis.brandsAtRisk > 0 ? 'warn' : 'good'}
        />
        <Stat label="Goals / 7d" value={kpis.goalsPerWeek} tone="good" />
        <Stat label="Cost / goal" value={kpis.costPerGoalLabel} tone="accent" />
        <Stat
          label="Pending apps"
          value={kpis.pendingApplications}
          tone={kpis.pendingApplications > 0 ? 'warn' : undefined}
        />
        <Stat label="Wallet" value={kpis.escrowLabel} />
      </StatGrid>

      <div className="portfolio-home__charts">
        <Panel
          compact
          className="portfolio-home__chart-main"
          title="Portfolio velocity"
          description="All brands · new leads vs verified goals · last 7 days"
        >
          <DeskTrendLines
            days={series}
            series={['leads', 'goals']}
            height={200}
            ariaLabel="Portfolio lead and goal velocity over 7 days"
          />
        </Panel>

        <Panel
          compact
          className="portfolio-home__chart-side"
          title="Portfolio capital"
          description="Combined open-campaign budget and dial runway"
        >
          <div className="portfolio-home__gauges">
            <BudgetDonut
              budgetCents={portfolioBudget.budgetCents}
              spentCents={portfolioBudget.spentCents}
            />
            <RunwayMeter
              days={portfolioRunway.days}
              dialReady={portfolioRunway.dialReady}
              avgCallsPerDay={portfolioRunway.avgCallsPerDay}
            />
          </div>
        </Panel>
      </div>

      <div className="portfolio-home__charts portfolio-home__charts--secondary">
        <Panel
          compact
          title="Goals by brand"
          description="Verified goals · last 7 days"
        >
          <BrandCompareBars
            rows={data.brands.map((b) => ({
              id: b.id,
              label: b.name,
              value: b.economics.goalsInPeriod,
              tone: b.economics.goalsInPeriod === 0 ? 'warn' : 'good',
            }))}
            valueLabel="goals"
            formatValue={(n) => String(Math.round(n))}
            ariaLabel="Goals by brand"
          />
        </Panel>

        <Panel
          compact
          title="Lead runway by brand"
          description="Days until dial-ready queue empties"
        >
          <BrandCompareBars
            rows={data.brands.map((b) => {
              const days = b.economics.leadRunwayDays ?? 0;
              return {
                id: b.id,
                label: b.name,
                value: days,
                tone: days < 1.5 ? 'bad' : days < 3 ? 'warn' : 'accent',
              };
            })}
            valueLabel="days"
            formatValue={(n) => (n < 1 ? '<1' : n.toFixed(n < 10 ? 1 : 0))}
            maxHint={14}
            ariaLabel="Lead runway by brand"
          />
        </Panel>
      </div>

      <div className="portfolio-home__charts portfolio-home__charts--secondary">
        <Panel
          compact
          title="Needs attention"
          description="Ranked across brands — each row opens the fix"
          actions={<SoftLink href="/brands">My brands</SoftLink>}
        >
          {data.exceptions.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              All clear — no urgent budget, runway, or hiring exceptions.
            </p>
          ) : (
            <div className="portfolio-home__queue-list">
              {data.exceptions.map((ex) => (
                <Link
                  key={`${ex.brandId}-${ex.signal.id}`}
                  href={ex.signal.action?.href || brandHref(ex.brandKey)}
                  className={toneClass(ex.signal.tone)}
                  onClick={() => writeSelectedBrandKey(ex.brandKey)}
                >
                  <div className="portfolio-action__main">
                    <span className="portfolio-action__brand">{ex.brandName}</span>
                    <div className="portfolio-action__copy">
                      <strong className="portfolio-action__title">
                        {ex.signal.label}
                        <span className="portfolio-action__value">{ex.signal.value}</span>
                      </strong>
                      <span className="portfolio-action__detail">{ex.signal.detail}</span>
                    </div>
                  </div>
                  {ex.signal.action ? (
                    <span className="portfolio-action__cta">{ex.signal.action.label} →</span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          compact
          title="Brand health"
          description="Open a brand desk for full economics"
        >
          <div className="portfolio-home__table-list">
            {data.brands.map((b) => {
              const e = b.economics;
              return (
                <Link
                  key={b.id}
                  href={brandHref(b)}
                  className="portfolio-home__table-row"
                  onClick={() => writeSelectedBrandKey(brandPathKey(b))}
                >
                  <div className="portfolio-home__table-brand">
                    <BrandLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} size="sm" />
                    <strong title={b.name}>{b.name}</strong>
                  </div>
                  <span
                    className={`portfolio-home__risk${b.risk >= 80 ? ' is-bad' : b.risk >= 50 ? ' is-warn' : ' is-ok'}`}
                  >
                    {b.risk >= 80 ? 'Risk' : b.risk >= 50 ? 'Watch' : 'OK'}
                  </span>
                  <div className="portfolio-home__table-metrics">
                    <span className="portfolio-home__table-metric">
                      {e.goalsInPeriod} goals
                    </span>
                    <span className="portfolio-home__table-metric">
                      Runway {formatDays(e.leadRunwayDays)}
                    </span>
                    <span className="portfolio-home__table-metric">
                      {e.budget.status === 'uncapped'
                        ? 'Uncapped'
                        : e.budget.status === 'exhausted'
                          ? 'Exhausted'
                          : `${formatUsd(e.budget.remainingCents)} left`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
    </main>
  );
}
