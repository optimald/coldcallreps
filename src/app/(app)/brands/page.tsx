'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import CreateBrandModal from '@/components/CreateBrandModal';
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
      setBrands(data.brands || []);
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
        eyebrow="Brands"
        title="Your brands"
        description="Only brands you own appear here. Create a brand → practice pack → campaign → SDRs dial your leads."
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
            <Link key={b.id} href={`/brands/${b.slug || b.id}`} className="card-tile">
              <div className="card-tile__logo-row">
                <BrandLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} size="sm" />
                <h2 className="card-tile__title">{b.name}</h2>
              </div>
              <p className="card-tile__meta">
                {b.packs?.length || 0} packs · {b._count?.certifications || 0} certified ·{' '}
                {b._count?.bounties || 0} bounties
              </p>
              <span className="card-tile__footer">Open brand desk →</span>
            </Link>
          ))}
        </div>
      )}

      <CreateBrandModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </main>
  );
}
