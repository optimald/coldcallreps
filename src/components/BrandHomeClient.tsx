'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import {
  DeskActionsPanel,
  EconomicsStatStrip,
} from '@/components/DeskEconomics';
import {
  BudgetDonut,
  DeskGroupedBars,
  EscrowBurnChart,
  PipelineFunnel,
  RunwayMeter,
} from '@/components/DeskCharts';
import {
  brandHref,
  brandPathKey,
  readSelectedBrandKey,
  resolveSelectedBrand,
  writeSelectedBrandKey,
  type BrandRef,
} from '@/lib/brand-context';
import type { BrandEconomics } from '@/lib/desk-economics';
import {
  getDemoApplications,
  getDemoCallsBoard,
  getDemoCampaigns,
  getDemoEconomics,
  getDemoKpis,
  getDemoStats,
} from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import {
  EmptyState,
  PageHeader,
  Panel,
} from '@/components/ui/PagePrimitives';

type GoalRow = {
  id: string;
  kind: 'booking' | 'claim' | 'call';
  title: string;
  companyName: string;
  repName: string;
  status: string;
  at: string;
  campaignId?: string | null;
};

export type OverviewPayload = {
  brand: { id: string; slug: string; name: string; logoUrl?: string | null };
  kpis: {
    openCampaigns: number;
    pendingApplications: number;
    activeSdrs: number;
    leads: number;
    callsToday: number;
    bookings: number;
    escrowLabel: string;
  };
  economics?: BrandEconomics;
  dialVolume: { key: string; label: string; count: number }[];
  campaigns: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    _count: { applications: number };
  }[];
  activity: {
    applications: {
      id: string;
      status: string;
      createdAt: string;
      repName: string;
      campaignId: string;
      campaignTitle: string;
    }[];
    calls: {
      id: string;
      status: string;
      outcome?: string | null;
      createdAt: string;
      durationSec: number | null;
      companyName: string;
      repName: string;
    }[];
  };
  goals?: GoalRow[];
};

function dispositionMeta(status: string, outcome?: string | null) {
  const s = (status || '').toLowerCase();
  const o = (outcome || '').toLowerCase();
  if (
    o === 'meeting_booked' ||
    o === 'appointment_set' ||
    s === 'appointment_set' ||
    o.includes('book')
  ) {
    return { label: 'Meeting booked', tone: 'good' as const };
  }
  if (o === 'interested' || o.includes('interest')) {
    return { label: 'Interested', tone: 'accent' as const };
  }
  if (s === 'callback' || o === 'callback') {
    return { label: 'Callback', tone: 'accent' as const };
  }
  if (s === 'pending_audit') return { label: 'Pending audit', tone: 'warn' as const };
  if (s === 'passed' || s === 'paid') return { label: 'Verified', tone: 'good' as const };
  return { label: outcome || status || 'Goal', tone: 'muted' as const };
}

function demoOverview(brand: BrandRef): OverviewPayload {
  const key = brandPathKey(brand);
  const stats = getDemoStats(key);
  const kpis = getDemoKpis(key);
  const campaigns = getDemoCampaigns(key);
  const applications = getDemoApplications(key);
  const board = getDemoCallsBoard(key, brand.name);
  const calls = [...board.active, ...board.past].slice(0, 10).map((c) => ({
    id: c.id,
    status: c.status || 'completed',
    outcome: c.outcome ?? null,
    createdAt: c.createdAt || new Date().toISOString(),
    durationSec: c.duration ?? null,
    companyName: c.companyName || 'Lead',
    repName: c.sdrName || 'SDR',
  }));
  const goals: GoalRow[] = [
    ...board.upcoming.map((u) => ({
      id: u.id,
      kind: 'booking' as const,
      title: u.campaignTitle || u.title,
      companyName: u.companyName || u.title,
      repName: u.sdrName || 'SDR',
      status: u.kind === 'callback' ? 'CALLBACK' : 'BOOKED',
      at: u.startsAt,
      campaignId: u.campaignId,
    })),
    ...calls
      .filter((c) => {
        const o = (c.outcome || '').toLowerCase();
        return o.includes('book') || o === 'interested';
      })
      .map((c) => ({
        id: `goal-${c.id}`,
        kind: 'call' as const,
        title: c.outcome || 'Goal',
        companyName: c.companyName,
        repName: c.repName,
        status: c.outcome || c.status,
        at: c.createdAt,
        campaignId: null,
      })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    brand: {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: brand.logoUrl,
    },
    kpis: {
      openCampaigns: kpis.openCampaigns,
      pendingApplications: kpis.pendingApplications,
      activeSdrs: stats.activeApps,
      leads: kpis.leads,
      callsToday: kpis.callsToday,
      bookings: stats.bookings,
      escrowLabel: kpis.escrowLabel.replace(/\.00$/, ''),
    },
    economics: getDemoEconomics(key),
    dialVolume: stats.days,
    campaigns: campaigns.slice(0, 6).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      updatedAt: new Date().toISOString(),
      _count: { applications: c.applicationCount },
    })),
    activity: {
      applications: applications.slice(0, 6).map((a) => ({
        id: a.id,
        status: a.status,
        createdAt: a.createdAt,
        repName: a.displayName,
        campaignId: a.campaignId,
        campaignTitle: a.campaignTitle,
      })),
      calls,
    },
    goals,
  };
}

export default function BrandHomeClient({
  brandKey,
  greetingName = 'there',
  initialBrand,
  initialDeskMode,
  initialOverview,
}: {
  brandKey?: string;
  greetingName?: string;
  initialBrand?: BrandRef | null;
  initialDeskMode?: 'live' | 'demo';
  initialOverview?: OverviewPayload | null;
}) {
  const { mode, hydrated } = useBrandDeskMode(initialDeskMode);
  const [brands, setBrands] = useState<BrandRef[]>(() =>
    initialBrand ? [initialBrand] : []
  );
  const [brand, setBrand] = useState<BrandRef | null>(() => initialBrand || null);
  const [data, setData] = useState<OverviewPayload | null>(() => {
    if (initialBrand && initialDeskMode === 'demo') return demoOverview(initialBrand);
    return initialOverview || null;
  });
  const [loading, setLoading] = useState(() => {
    if (initialBrand && initialDeskMode === 'demo') return false;
    return !initialOverview;
  });
  const [createHint, setCreateHint] = useState(false);

  useEffect(() => {
    if (initialBrand) {
      writeSelectedBrandKey(brandPathKey(initialBrand));
      return;
    }
    let cancelled = false;
    fetch('/api/brands?mine=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list: BrandRef[] = (d?.brands || []).map((b: BrandRef & { logoUrl?: string }) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          logoUrl: b.logoUrl,
        }));
        setBrands(list);
        const resolved = resolveSelectedBrand(list, brandKey || readSelectedBrandKey());
        setBrand(resolved);
        if (resolved) writeSelectedBrandKey(brandPathKey(resolved));
        if (list.length === 0) setCreateHint(true);
        else setCreateHint(false);
      })
      .catch(() => {
        if (!cancelled) setCreateHint(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandKey, initialBrand]);

  useEffect(() => {
    if (!brandKey || brands.length === 0) return;
    const resolved = resolveSelectedBrand(brands, brandKey);
    if (resolved && (!brand || brandPathKey(brand) !== brandPathKey(resolved))) {
      setBrand(resolved);
      writeSelectedBrandKey(brandPathKey(resolved));
    }
  }, [brandKey, brands, brand]);

  useEffect(() => {
    if (!hydrated || !brand) {
      if (hydrated && brands.length === 0 && !initialBrand) setLoading(false);
      return;
    }

    if (mode === 'demo') {
      setData(demoOverview(brand));
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (!initialOverview) setLoading(true);
    fetch(`/api/brands/${encodeURIComponent(brandPathKey(brand))}/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.kpis) setData(d as OverviewPayload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, mode, brand, brands.length, initialBrand, initialOverview]);

  if (!hydrated || loading) {
    return (
      <main className="app-page app-page--desk">
        <p className="muted">Loading brand desk…</p>
      </main>
    );
  }

  if (!brand || createHint) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Brand"
          title={`Hey ${greetingName}`}
          description="Create a brand to unlock campaigns, leads, and SDR hiring."
        />
        <Panel>
          <EmptyState
            title="No brands yet"
            description="Your brand dashboard tracks economics for one brand at a time."
            action={
              <Link href="/brands?create=1" className="btn" style={{ marginTop: '1rem' }}>
                Create brand
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  const kpis = data?.kpis;
  const campaigns = data?.campaigns || [];
  const goals = (data?.goals || []).filter((g) => g.kind === 'booking' || g.kind === 'claim');
  const logoUrl = data?.brand?.logoUrl ?? brand.logoUrl;
  const openCampaign = campaigns.find((c) => c.status === 'OPEN') || campaigns[0] || null;
  const economics =
    data?.economics || getDemoEconomics(brandPathKey(brand));

  return (
    <main className="app-page app-page--desk dashboard-page brand-home-page">
      <PageHeader
        compact
        leading={
          <BrandLogo name={brand.name} slug={brand.slug} logoUrl={logoUrl} size="md" />
        }
        eyebrow="Brand desk"
        title={brand.name}
        description={
          mode === 'demo'
            ? 'Demo · ROI vitals — escrow, credits, connect & book rates.'
            : 'ROI vitals — escrow burn, lead credits, connect & book rates.'
        }
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={brandHref(brand, 'calls')} className="btn">
              Calls
            </Link>
            <Link href={brandHref(brand, 'campaigns')} className="btn-ghost">
              Campaigns
            </Link>
            <Link href={brandHref(brand, 'settings')} className="btn-ghost">
              Settings
            </Link>
          </div>
        }
      />

      <EconomicsStatStrip economics={economics} />

      <div className="brand-home__fold brand-home__fold--split">
        <Panel
          compact
          title="Pipeline funnel"
          description="Enriched → dials → connections → appointments"
        >
          <PipelineFunnel stages={economics.vitals.funnel} height={168} />
        </Panel>
        <Panel
          compact
          title="Escrow burn velocity"
          description="Cumulative spend · dashed line is campaign budget"
        >
          <EscrowBurnChart
            days={economics.series || []}
            budgetCents={economics.budget.budgetCents}
            spentCents={economics.budget.spentCents}
            height={168}
          />
        </Panel>
      </div>

      <div className="brand-home__fold brand-home__fold--calls-first">
        <Panel
          compact
          title="Verified goals"
          description="Bookings and appointment claims — the outcomes that matter"
          actions={
            <Link href={brandHref(brand, 'calls')} className="soft-link">
              Calls board →
            </Link>
          }
        >
          {goals.length === 0 ? (
            <EmptyState
              title="No verified goals yet"
              description="Booked meetings and audited claims land here."
            />
          ) : (
            <div className="stack brand-home__list">
              {goals.slice(0, 12).map((g) => {
                const disp = dispositionMeta(
                  g.status,
                  g.kind === 'booking' ? 'meeting_booked' : g.status
                );
                const when = new Date(g.at);
                const upcoming = when.getTime() > Date.now();
                return (
                  <Link
                    key={g.id}
                    href={
                      g.campaignId
                        ? brandHref(brand, 'campaigns', g.campaignId)
                        : brandHref(brand, 'calls')
                    }
                    className="session-row brand-home__call"
                  >
                    <div className="brand-home__call-main">
                      <div style={{ fontWeight: 650 }}>{g.companyName}</div>
                      <div className="session-row__meta">
                        {g.repName} · {disp.label}
                        {upcoming ? ' · upcoming' : ''}
                      </div>
                    </div>
                    <span className={`brand-home__disp brand-home__disp--${disp.tone}`}>
                      {disp.label}
                    </span>
                    <span className="muted brand-home__call-when">
                      {upcoming
                        ? when.toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : when.toLocaleDateString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel compact title="Budget & runway" description="Capital burn vs dial queue">
          <div className="portfolio-home__gauges">
            <BudgetDonut
              budgetCents={economics.budget.budgetCents}
              spentCents={economics.budget.spentCents}
            />
            <RunwayMeter
              days={economics.leadRunwayDays}
              dialReady={economics.dialReadyLeads}
              avgCallsPerDay={economics.avgCallsPerDay}
            />
          </div>
        </Panel>
      </div>

      <div className="brand-home__fold brand-home__fold--split brand-home__fold--secondary">
        <Panel compact title="Dial volume" description="Outbound · last 7 days">
          <DeskGroupedBars
            days={economics.series || []}
            series={['dials']}
            height={120}
            ariaLabel="Dial volume over 7 days"
          />
        </Panel>

        <Panel compact title="Needs attention" description="What to fix next">
          <DeskActionsPanel economics={economics} title="" limit={4} />
        </Panel>
      </div>

      <div className="brand-home__foot">
        {openCampaign ? (
          <Link
            href={brandHref(brand, 'campaigns', openCampaign.id)}
            className="brand-home__campaign-card brand-home__campaign-card--inline"
          >
            <span className="session-row__meta">Active campaign</span>
            <strong>{openCampaign.title}</strong>
            <span className="session-row__meta">
              {openCampaign.status} · {kpis?.activeSdrs ?? 0} SDRs ·{' '}
              {kpis?.pendingApplications ?? 0} pending apps · wallet {kpis?.escrowLabel ?? '—'}
            </span>
          </Link>
        ) : (
          <Link
            href={brandHref(brand, 'campaigns')}
            className="brand-home__campaign-card brand-home__campaign-card--inline"
          >
            <strong>Create a campaign</strong>
            <span className="session-row__meta">
              Set budget and pay per goal so economics can track.
            </span>
          </Link>
        )}

        <div className="brand-home__quick-links">
          <Link href={brandHref(brand, 'pipeline')} className="btn-ghost">
            Add leads →
          </Link>
          <Link href={brandHref(brand, 'sdrs', 'applications')} className="btn-ghost">
            Hire SDRs →
          </Link>
          <Link href={brandHref(brand, 'leads')} className="btn-ghost">
            Lead list →
          </Link>
        </div>
      </div>
    </main>
  );
}
