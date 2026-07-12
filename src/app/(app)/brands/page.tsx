'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

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

  async function create() {
    if (!name.trim()) {
      setMsg('Add a brand name first.');
      return;
    }
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        pack: {
          name: 'Default pack',
          icp: { segment: 'local SMB' },
          scripts: ['Open with a specific observation'],
          objections: ['We already have a site'],
        },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setName('');
      setMsg('');
      const slugOrId = data.brand?.slug || data.brand?.id;
      if (slugOrId) {
        window.location.href = `/brands/${slugOrId}`;
        return;
      }
      load();
    } else setMsg(data.error);
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Brands"
        title="Your brands"
        description="Only brands you own appear here. Create a brand → practice pack → campaign → SDRs dial your leads."
        actions={
          <Link href="/campaigns" className="btn-ghost">
            Campaigns
          </Link>
        }
      />

      <Panel
        title="Step 1 — Create your brand"
        description="Spins up a default practice pack. Next you’ll tune talk tracks and post a campaign for SDRs."
      >
        <div className="search-row" style={{ marginBottom: 0, maxWidth: 640 }}>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Brand name"
          />
          <button type="button" className="btn" onClick={create}>
            Create brand
          </button>
        </div>
        {msg && (
          <p
            className={msg.includes('name') ? 'msg-err' : 'msg-ok'}
            style={{ marginBottom: 0, marginTop: '0.75rem' }}
          >
            {msg}
          </p>
        )}
      </Panel>

      {loading ? (
        <p className="muted">Loading brands…</p>
      ) : brands.length === 0 ? (
        <Panel>
          <EmptyState
            title="No brands yet"
            description="Name your brand above to start the pack → bounty → certify loop."
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
    </main>
  );
}
