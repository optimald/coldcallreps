'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  payoutLabel: string;
  goalLabel: string;
  brand?: { id: string; name: string; slug: string };
  applicationCount?: number;
};

type BrandOption = { id: string; name: string; packs?: { id: string; name: string }[]; playbooks?: { id: string; title: string }[] };

export default function CampaignsPageClient() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icpText, setIcpText] = useState('');
  const [payoutDollars, setPayoutDollars] = useState('30');
  const [goalType, setGoalType] = useState('QUALIFIED_LEAD');
  const [status, setStatus] = useState('OPEN');
  const [packId, setPackId] = useState('');
  const [playbookId, setPlaybookId] = useState('');

  const selected = brands.find((b) => b.id === brandId);

  async function loadBrands() {
    const [brandsRes, meRes] = await Promise.all([fetch('/api/brands?mine=1'), fetch('/api/me')]);
    const d = await brandsRes.json().catch(() => ({}));
    const me = meRes.ok ? await meRes.json().catch(() => null) : null;
    const userId = me?.id as string | undefined;
    const role = me?.platformRole || 'REP';
    const all: BrandOption[] = d.brands || [];
    const owned =
      role === 'SUPERADMIN'
        ? all
        : all.filter((b: any) => b.ownerId && userId && b.ownerId === userId);
    setBrands(owned);
    if (!brandId && owned.length) {
      setBrandId(owned[0].id);
    }
  }

  async function loadCampaigns(forBrandId: string) {
    if (!forBrandId) {
      setCampaigns([]);
      return;
    }
    const res = await fetch(`/api/campaigns?brandId=${encodeURIComponent(forBrandId)}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setCampaigns(d.campaigns || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadBrands();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!brandId) return;
    loadCampaigns(brandId);
    // Load packs/playbooks for create form
    fetch(`/api/brands/${brandId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.brand) return;
        setBrands((prev) =>
          prev.map((b) =>
            b.id === brandId
              ? {
                  ...b,
                  packs: d.brand.packs || [],
                  playbooks: d.brand.playbooks || [],
                }
              : b
          )
        );
      })
      .catch(() => {});
  }, [brandId]);

  async function createCampaign() {
    setBusy(true);
    setMsg('');
    const payoutCents = Math.round(Number(payoutDollars) * 100);
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId,
        title,
        description,
        icpText: icpText || undefined,
        payoutCents,
        goalType,
        status,
        packId: packId || undefined,
        playbookId: playbookId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || 'Could not create campaign');
      return;
    }
    setMsg('Campaign created.');
    setTitle('');
    setDescription('');
    setIcpText('');
    await loadCampaigns(brandId);
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Marketplace"
        title="Campaigns"
        description="Post paid outcome campaigns for SDRs — qualified leads or booked meetings. You pay per approved result (~20% platform fee); SDRs receive the rest after they connect payouts."
        actions={
          <Link href="/gigs" className="btn-ghost">
            Preview brand deals board →
          </Link>
        }
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : brands.length === 0 ? (
        <Panel>
          <EmptyState
            title="Create a brand first"
            description="Campaigns are brand-owned. Set up a brand, pack, and playbook, then post a gig."
            action={
              <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                Go to brands
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel title="Your campaigns" description="Filter by brand.">
            <div className="search-row" style={{ marginBottom: '1rem' }}>
              <select
                className="field"
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setPackId('');
                  setPlaybookId('');
                }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {campaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                description="Create an OPEN campaign below so reps can find it on Gigs."
              />
            ) : (
              <div className="page-grid page-grid--wide">
                {campaigns.map((c) => {
                  const brandKey = c.brand?.slug || c.brand?.id || brandId;
                  const href = brandKey
                    ? `/brands/${brandKey}/campaigns/${c.id}`
                    : `/campaigns/${c.id}`;
                  return (
                  <Link key={c.id} href={href} className="card-tile">
                    <h2 className="card-tile__title">{c.title}</h2>
                    <p className="card-tile__meta">
                      {c.payoutLabel} / {c.goalLabel?.toLowerCase() || 'result'} · {c.status}
                      {c.applicationCount != null ? ` · ${c.applicationCount} applicants` : ''}
                    </p>
                    <p className="card-tile__meta">
                      {c.description.slice(0, 120)}
                      {c.description.length > 120 ? '…' : ''}
                    </p>
                    <span className="card-tile__footer">Manage →</span>
                  </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="New campaign" description="Link a pack/playbook so accepted reps can practice immediately.">
            <div className="stack" style={{ gap: '0.65rem', maxWidth: 560 }}>
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title — e.g. $30 qualified leads"
              />
              <textarea
                className="field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What reps deliver, how you define a result, volume expectations…"
              />
              <textarea
                className="field"
                value={icpText}
                onChange={(e) => setIcpText(e.target.value)}
                rows={3}
                placeholder="ICP — titles, company size, geography, triggers (optional)"
              />
              <div className="search-row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="field"
                  value={payoutDollars}
                  onChange={(e) => setPayoutDollars(e.target.value)}
                  placeholder="Payout $"
                  style={{ maxWidth: 120 }}
                />
                <select
                  className="field"
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                >
                  <option value="QUALIFIED_LEAD">Qualified lead</option>
                  <option value="BOOKED_MEETING">Booked meeting</option>
                </select>
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="DRAFT">Draft</option>
                  <option value="OPEN">Open</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="search-row" style={{ flexWrap: 'wrap' }}>
                <select className="field" value={packId} onChange={(e) => setPackId(e.target.value)}>
                  <option value="">Pack (optional)</option>
                  {(selected?.packs || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={playbookId}
                  onChange={(e) => setPlaybookId(e.target.value)}
                >
                  <option value="">Playbook (optional)</option>
                  {(selected?.playbooks || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy || !title.trim() || !description.trim()}
                onClick={createCampaign}
                style={{ alignSelf: 'flex-start' }}
              >
                {busy ? 'Creating…' : 'Create campaign'}
              </button>
            </div>
            {msg && <p className={msg.includes('created') ? 'msg-ok' : 'msg-err'}>{msg}</p>}
          </Panel>
        </>
      )}
    </main>
  );
}
