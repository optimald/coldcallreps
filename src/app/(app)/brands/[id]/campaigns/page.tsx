'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { brandHref } from '@/lib/brand-context';
import { DEMO_MSG, getDemoCampaigns } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  payoutLabel: string;
  goalLabel: string;
  applicationCount?: number;
  bookingLink?: string | null;
  escrowLabel?: string | null;
  escrowLockedCents?: number | null;
  dateRangeLabel?: string | null;
  budgetLabel?: string | null;
  activateOn?: boolean;
  dialEligible?: boolean;
};

type BrandMeta = {
  id: string;
  name: string;
  slug: string;
  packs?: { id: string; name: string }[];
  playbooks?: { id: string; title: string }[];
};

function statusChipClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'brand-campaign-row__chip brand-campaign-row__chip--open';
    case 'PAUSED':
      return 'brand-campaign-row__chip brand-campaign-row__chip--paused';
    case 'DRAFT':
      return 'brand-campaign-row__chip brand-campaign-row__chip--draft';
    case 'CLOSED':
      return 'brand-campaign-row__chip brand-campaign-row__chip--closed';
    default:
      return 'brand-campaign-row__chip';
  }
}

export default function BrandCampaignsPage() {
  const params = useParams();
  const brandKey = String(params.id || '');
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [brand, setBrand] = useState<BrandMeta | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(() =>
    mode === 'demo' ? getDemoCampaigns(brandKey) : []
  );
  const [loading, setLoading] = useState(() => mode !== 'demo');
  const [createOpen, setCreateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!brandKey) return;

    let cancelled = false;

    async function load() {
      if (mode === 'demo') {
        setCampaigns(getDemoCampaigns(brandKey));
        setLoading(false);
        // Still resolve brand meta for create modal
      } else {
        setLoading(true);
      }
      try {
        const brandRes = await fetch(`/api/brands/${brandKey}`);
        const brandData = await brandRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!brandRes.ok || !brandData.brand) {
          setBrand(null);
          if (mode !== 'demo') setCampaigns([]);
          return;
        }
        const b = brandData.brand as BrandMeta;
        setBrand(b);

        if (mode === 'demo') {
          setCampaigns(getDemoCampaigns(brandKey));
          return;
        }

        const campRes = await fetch(`/api/campaigns?brandId=${encodeURIComponent(b.id)}`);
        const campData = await campRes.json().catch(() => ({}));
        if (cancelled) return;
        if (campRes.ok) setCampaigns(campData.campaigns || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [brandKey, mode]);

  async function reloadLive() {
    if (!brand?.id || mode === 'demo') return;
    const campRes = await fetch(`/api/campaigns?brandId=${encodeURIComponent(brand.id)}`);
    const campData = await campRes.json().catch(() => ({}));
    if (campRes.ok) setCampaigns(campData.campaigns || []);
  }

  async function toggleActivate(c: CampaignRow, next: boolean) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    if (c.status === 'CLOSED') return;
    setTogglingId(c.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activateOn: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not update activate');
        return;
      }
      setCampaigns((prev) =>
        prev.map((row) => (row.id === c.id ? { ...row, ...data.campaign } : row))
      );
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!brand) {
    return (
      <main className="app-page">
        <PageHeader title="Brand not found" description="This brand may have been removed." />
        <Link href="/brands" className="soft-link">
          ← Back to brands
        </Link>
      </main>
    );
  }

  const campBase = brandHref(brand, 'campaigns');
  const display = isDemo ? getDemoCampaigns(brandKey) : campaigns;

  return (
    <main className="app-page">
      <PageHeader
        title="Campaigns"
        description="Paid outcome campaigns for SDRs. Activate gates new dials only — in-flight calls keep going."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (isDemo) {
                setMsg(DEMO_MSG);
                return;
              }
              setCreateOpen(true);
            }}
          >
            New campaign
          </button>
        }
      />

      {msg ? (
        <p className="muted" role="status">
          {msg}
        </p>
      ) : null}

      <Panel title="Campaigns" description="Active campaigns appear on Brand deals for SDRs.">
        {display.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create and activate a campaign so reps can find it on Brand deals."
            action={
              <button
                type="button"
                className="btn"
                style={{ marginTop: '1rem' }}
                onClick={() => {
                  if (isDemo) {
                    setMsg(DEMO_MSG);
                    return;
                  }
                  setCreateOpen(true);
                }}
              >
                New campaign
              </button>
            }
          />
        ) : (
          <ul className="brand-campaign-rows">
            {display.map((c) => {
              const activateOn = c.activateOn ?? c.status === 'OPEN';
              const canToggle = c.status !== 'CLOSED';
              const escrowLabel =
                c.escrowLabel ||
                ('escrowLockedCents' in c &&
                typeof c.escrowLockedCents === 'number' &&
                c.escrowLockedCents > 0
                  ? `$${(c.escrowLockedCents / 100).toFixed(0)} escrow`
                  : '—');
              return (
                <li key={c.id} className="brand-campaign-row">
                  <div className="brand-campaign-row__main">
                    <Link href={`${campBase}/${c.id}`} className="brand-campaign-row__left">
                      <div className="brand-campaign-row__title-line">
                        <span className="brand-campaign-row__title">{c.title}</span>
                        <span className={statusChipClass(c.status)}>{c.status}</span>
                      </div>
                      <p className="brand-campaign-row__meta">
                        {c.goalLabel}
                        {c.dateRangeLabel ? ` · ${c.dateRangeLabel}` : ''}
                      </p>
                    </Link>
                    <div className="brand-campaign-row__vitals">
                      <label className="brand-campaign-row__activate">
                        <span className="brand-campaign-row__vital-label">Activate</span>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={activateOn}
                          disabled={!canToggle || togglingId === c.id || isDemo}
                          onChange={(e) => void toggleActivate(c, e.target.checked)}
                        />
                      </label>
                      <div className="brand-campaign-row__vital">
                        <span className="brand-campaign-row__vital-label">Budget</span>
                        <span className="brand-campaign-row__vital-value">
                          {c.budgetLabel || '—'}
                        </span>
                      </div>
                      <div className="brand-campaign-row__vital">
                        <span className="brand-campaign-row__vital-label">Payout</span>
                        <span className="brand-campaign-row__vital-value">{c.payoutLabel}</span>
                      </div>
                      <div className="brand-campaign-row__vital">
                        <span className="brand-campaign-row__vital-label">Apps</span>
                        <span className="brand-campaign-row__vital-value">
                          {c.applicationCount ?? 0}
                        </span>
                      </div>
                      <div className="brand-campaign-row__vital">
                        <span className="brand-campaign-row__vital-label">Escrow</span>
                        <span className="brand-campaign-row__vital-value">{escrowLabel}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {!isDemo ? (
        <CreateCampaignModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          brandId={brand.id}
          brandName={brand.name}
          packs={brand.packs}
          playbooks={brand.playbooks}
          onCreated={() => void reloadLive()}
        />
      ) : null}
    </main>
  );
}
