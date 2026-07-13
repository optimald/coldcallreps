'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import CreateBrandModal from '@/components/CreateBrandModal';
import { brandPathKey, writeSelectedBrandKey } from '@/lib/brand-context';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/brands?mine=1');
      const data = await res.json();
      const list = data.brands || [];
      setBrands(list);
      const wantCreate =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('create') === '1';
      if (list.length === 0 || wantCreate) {
        setCreateOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Account"
        title="My brands"
        description="Manage brands you own. The sidebar selector sets which brand Home and campaigns use."
        actions={
          <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
            Create brand
          </button>
        }
      />

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
                {b.packs?.length || 0} packs · {b._count?.certifications || 0} certified ·{' '}
                {b._count?.bounties || 0} bounties
              </p>
              <span className="card-tile__footer">Open dashboard →</span>
            </Link>
          ))}
        </div>
      )}

      <CreateBrandModal
        open={createOpen}
        onClose={() => {
          // Keep modal open when there are zero brands — must create one first
          if (brands.length === 0) return;
          setCreateOpen(false);
        }}
        redirectTo={undefined}
        onCreated={(key) => {
          if (key) writeSelectedBrandKey(key);
        }}
      />
    </main>
  );
}
