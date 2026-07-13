'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import CreateBrandModal from '@/components/CreateBrandModal';
import { brandPathKey, writeSelectedBrandKey } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import {
  DEMO_MSG,
  getDemoCampaigns,
  getDemoKpis,
  getDemoTeam,
} from '@/lib/demo/brand-demo-data';
import { CANONICAL_DEMO_BRANDS } from '@/lib/demo/canonical-brands';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

type BrandCard = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  packsCount: number;
  certifiedCount: number;
  bountiesCount: number;
  metaExtra?: string;
};

function demoBrandCards(): BrandCard[] {
  return CANONICAL_DEMO_BRANDS.map((b) => {
    const kpis = getDemoKpis(b.slug);
    const campaigns = getDemoCampaigns(b.slug);
    const team = getDemoTeam(b.slug);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      logoUrl: b.logoUrl,
      packsCount: 1,
      certifiedCount: team.length,
      bountiesCount: kpis.openCampaigns,
      metaExtra: `${campaigns.length} campaigns · ${kpis.leads} leads`,
    };
  });
}

export default function BrandsPage() {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [brands, setBrands] = useState<BrandCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg(null);
      try {
        if (isDemo) {
          if (!cancelled) setBrands(demoBrandCards());
          return;
        }
        const res = await fetch('/api/brands?mine=1');
        const data = await res.json();
        const list = (data.brands || []).map(
          (b: {
            id: string;
            slug?: string | null;
            name: string;
            logoUrl?: string | null;
            packs?: unknown[];
            _count?: { certifications?: number; bounties?: number };
          }) => ({
            id: b.id,
            slug: b.slug || b.id,
            name: b.name,
            logoUrl: b.logoUrl,
            packsCount: b.packs?.length || 0,
            certifiedCount: b._count?.certifications || 0,
            bountiesCount: b._count?.bounties || 0,
          })
        ) as BrandCard[];
        if (!cancelled) {
          setBrands(list);
          const wantCreate =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('create') === '1';
          if (list.length === 0 || wantCreate) setCreateOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isDemo]);

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Account"
        title="My brands"
        description={
          isDemo
            ? 'Demo brands for the desk walkthrough — switch to Live to manage brands you own.'
            : 'Manage brands you own. The sidebar selector sets which brand Overview and campaigns use.'
        }
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
            Create brand
          </button>
        }
      />

      {msg ? (
        <p className="msg-err" role="status">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Loading brands…</p>
      ) : brands.length === 0 ? (
        <Panel>
          <EmptyState
            title="No brands yet"
            description="Create a brand to start the pack → campaign → certify loop."
            action={
              <button
                type="button"
                className="btn"
                style={{ marginTop: '1rem' }}
                onClick={() => setCreateOpen(true)}
              >
                Create brand
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="page-grid">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/brands/${b.slug || b.id}`}
              className="card-tile"
              onClick={() => writeSelectedBrandKey(brandPathKey(b))}
            >
              <div className="card-tile__logo-row">
                <BrandLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} size="sm" />
                <h2 className="card-tile__title">{b.name}</h2>
              </div>
              <p className="card-tile__meta">
                {isDemo && b.metaExtra
                  ? b.metaExtra
                  : `${b.packsCount} packs · ${b.certifiedCount} certified · ${b.bountiesCount} bounties`}
              </p>
              <span className="card-tile__footer">Open dashboard →</span>
            </Link>
          ))}
        </div>
      )}

      <CreateBrandModal
        open={createOpen && !isDemo}
        onClose={() => {
          if (brands.length === 0) return;
          setCreateOpen(false);
        }}
        redirectTo={undefined}
        onCreated={(key) => {
          if (!key) return;
          writeSelectedBrandKey(key);
        }}
      />
    </main>
  );
}
