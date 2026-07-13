'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { brandHref } from '@/lib/brand-context';
import { DEMO_CAMPAIGNS, DEMO_MSG } from '@/lib/demo/brand-demo-data';
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
};

type BrandMeta = {
  id: string;
  name: string;
  slug: string;
  packs?: { id: string; name: string }[];
  playbooks?: { id: string; title: string }[];
};

export default function BrandCampaignsPage() {
  const params = useParams();
  const brandKey = String(params.id || '');
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = hydrated && mode === 'demo';
  const [brand, setBrand] = useState<BrandMeta | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!brandKey || !hydrated) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const brandRes = await fetch(`/api/brands/${brandKey}`);
        const brandData = await brandRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!brandRes.ok || !brandData.brand) {
          setBrand(null);
          setCampaigns([]);
          return;
        }
        const b = brandData.brand as BrandMeta;
        setBrand(b);

        if (mode === 'demo') {
          setCampaigns(DEMO_CAMPAIGNS);
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
  }, [brandKey, hydrated, mode]);

  async function reloadLive() {
    if (!brand?.id || mode === 'demo') return;
    const campRes = await fetch(`/api/campaigns?brandId=${encodeURIComponent(brand.id)}`);
    const campData = await campRes.json().catch(() => ({}));
    if (campRes.ok) setCampaigns(campData.campaigns || []);
  }

  if (!hydrated || loading) {
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
  const display = isDemo ? DEMO_CAMPAIGNS : campaigns;

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="Campaigns"
        description="Post paid outcome campaigns for SDRs — qualified leads or booked meetings. You pay per approved result (~20% platform fee); SDRs receive the rest after they connect payouts."
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

      <Panel title="Campaigns" description="OPEN campaigns appear on Brand deals for SDRs.">
        {display.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create an OPEN campaign so reps can find it on Brand deals."
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
          <div className="page-grid page-grid--wide">
            {display.map((c) => (
              <Link key={c.id} href={`${campBase}/${c.id}`} className="card-tile">
                <h2 className="card-tile__title">{c.title}</h2>
                <p className="card-tile__meta">
                  {c.payoutLabel} / {c.goalLabel?.toLowerCase() || 'result'} · {c.status}
                  {c.applicationCount != null ? ` · ${c.applicationCount} applicants` : ''}
                </p>
                <p className="card-tile__meta">
                  {c.description.slice(0, 120)}
                  {c.description.length > 120 ? '…' : ''}
                </p>
                <p className="card-tile__meta brand-campaign__badges">
                  {(() => {
                    const escrowLabel =
                      'escrowLabel' in c && c.escrowLabel
                        ? c.escrowLabel
                        : 'escrowLockedCents' in c &&
                            typeof c.escrowLockedCents === 'number' &&
                            c.escrowLockedCents > 0
                          ? `$${(c.escrowLockedCents / 100).toFixed(0)} escrow`
                          : null;
                    return (
                      <>
                        {escrowLabel ? (
                          <span className="brand-campaign__badge">{escrowLabel}</span>
                        ) : null}
                        {c.bookingLink ? (
                          <span className="brand-campaign__badge brand-campaign__badge--ok">
                            Booking link
                          </span>
                        ) : (
                          <span className="brand-campaign__badge brand-campaign__badge--muted">
                            No booking link
                          </span>
                        )}
                      </>
                    );
                  })()}
                </p>
                <span className="card-tile__footer">Manage →</span>
              </Link>
            ))}
          </div>
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
