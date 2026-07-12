'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import TrainingLeadsPanel, { type TrainingLeadView } from '@/components/TrainingLeadsPanel';

type BrandOpt = { id: string; name: string; slug: string };
type CampaignOpt = { id: string; title: string; brandId: string; status: string };
type Lead = {
  id: string;
  companyName: string;
  phone?: string | null;
  website?: string | null;
  ownerName?: string | null;
  city?: string | null;
  status?: string | null;
  campaignId?: string | null;
  enrichmentStatus?: string | null;
  hooksJSON?: string | null;
  source?: string | null;
};

type Tab = 'campaign' | 'training';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h: string) {
  return h.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_-]+/g, '');
}

const ALIASES: Record<string, string> = {
  companyname: 'companyName',
  company: 'companyName',
  name: 'companyName',
  phone: 'phone',
  phonenumber: 'phone',
  website: 'website',
  url: 'website',
  ownername: 'ownerName',
  owner: 'ownerName',
  city: 'city',
  state: 'state',
  industry: 'industry',
  notes: 'notes',
};

function LeadTabs({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Lead type"
      style={{
        display: 'flex',
        gap: '0.35rem',
        flexWrap: 'wrap',
        marginBottom: '0.25rem',
      }}
    >
      {(
        [
          { id: 'training' as const, label: 'Training' },
          { id: 'campaign' as const, label: 'Campaign' },
        ] as const
      ).map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'btn' : 'btn-ghost'}
            onClick={() => onChange(t.id)}
            style={
              active
                ? undefined
                : {
                    borderColor: 'color-mix(in srgb, var(--border) 80%, transparent)',
                  }
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BrandLeadsClient({
  brands,
  campaigns,
  platformTrainingLeads,
}: {
  brands: BrandOpt[];
  campaigns: CampaignOpt[];
  platformTrainingLeads: TrainingLeadView[];
}) {
  const [tab, setTab] = useState<Tab>('training');
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trainingLeads, setTrainingLeads] = useState<TrainingLeadView[]>(platformTrainingLeads);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [assignCampaignId, setAssignCampaignId] = useState('');

  const brandCampaigns = campaigns.filter((c) => c.brandId === brandId);
  const hasBrand = Boolean(brandId);

  const loadCampaign = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ brandId, limit: '100' });
      if (campaignFilter) qs.set('campaignId', campaignFilter);
      const res = await fetch(`/api/prospects?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setLeads(data.prospects || []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [brandId, campaignFilter]);

  const loadTraining = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ training: '1', limit: '100' });
      const res = await fetch(`/api/prospects?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setTrainingLeads(data.prospects || []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'campaign' && brandId) void loadCampaign();
    if (tab === 'training') void loadTraining();
  }, [tab, brandId, loadCampaign, loadTraining]);

  async function addLead(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    if (tab === 'campaign' && !brandId) return;
    setMsg(null);
    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: brandId || null,
        campaignId: tab === 'campaign' ? assignCampaignId || null : null,
        training: tab === 'training',
        companyName: companyName.trim(),
        phone: phone.trim() || null,
        website: website.trim() || null,
        ownerName: ownerName.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Create failed');
      return;
    }
    setCompanyName('');
    setPhone('');
    setWebsite('');
    setOwnerName('');
    if (tab === 'training') await loadTraining();
    else await loadCampaign();
  }

  async function enrichOne(id: string) {
    setEnriching(id);
    setMsg(null);
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      setMsg(`Enriched — ${(data.hooks || []).length} talking points`);
      await loadCampaign();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Enrich failed');
    } finally {
      setEnriching(null);
    }
  }

  async function assignLead(id: string, campaignId: string) {
    await fetch('/api/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, campaignId: campaignId || null }),
    });
    await loadCampaign();
  }

  async function onCsv(file: File) {
    if (!brandId) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setMsg('CSV needs a header row and at least one data row');
      return;
    }
    const headers = splitCsvLine(lines[0]).map(normalizeHeader);
    const colMap = headers.map((h) => ALIASES[h] || null);
    const rows = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      const row: Record<string, string> = {};
      colMap.forEach((key, i) => {
        if (key && cells[i]?.trim()) row[key] = cells[i].trim();
      });
      return row;
    });

    const res = await fetch('/api/prospects/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId,
        campaignId: tab === 'campaign' ? assignCampaignId || null : null,
        training: tab === 'training',
        rows,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Import failed');
      return;
    }
    setMsg(`Imported ${data.created} leads${data.skipped ? ` · skipped ${data.skipped}` : ''}`);
    if (tab === 'training') await loadTraining();
    else await loadCampaign();
  }

  const brandPicker: ReactNode =
    brands.length > 0 ? (
      <select
        className="field"
        value={brandId}
        onChange={(e) => {
          setBrandId(e.target.value);
          setCampaignFilter('');
          setAssignCampaignId('');
        }}
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <LeadTabs tab={tab} onChange={setTab} />

      {msg && (
        <p className="muted" style={{ margin: 0 }} role="status">
          {msg}
        </p>
      )}

      {tab === 'training' ? (
        <>
          <TrainingLeadsPanel
            leads={trainingLeads}
            mode="brand"
            emptyAction={
              <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                Set up brand
              </Link>
            }
          />

          {hasBrand ? (
            <Panel
              title="Add training lead"
              description="Practice contacts for your brand playbook. They never enter paid campaign dial queues."
            >
              <form onSubmit={addLead} className="stack" style={{ gap: '0.55rem', maxWidth: 560 }}>
                {brandPicker}
                <input
                  className="field"
                  placeholder="Company name *"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <div className="search-row" style={{ flexWrap: 'wrap' }}>
                  <input
                    className="field"
                    placeholder="Phone (555 ok for demos)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Owner / contact"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn">
                    Add training lead
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => fileRef.current?.click()}
                  >
                    Import CSV
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void loadTraining()}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
              </form>
            </Panel>
          ) : (
            <EmptyState
              title="Add your own training leads"
              description="Create a brand to load practice contacts for your playbook. Platform training leads above work for everyone."
              action={
                <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                  Set up brand
                </Link>
              }
            />
          )}
        </>
      ) : brands.length === 0 ? (
        <EmptyState
          title="Create a brand for campaign leads"
          description="Campaign leads are real contacts you assign to gigs. Training leads (previous tab) are available now for practice."
          action={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link href="/brands" className="btn">
                Set up brand
              </Link>
              <button type="button" className="btn-ghost" onClick={() => setTab('training')}>
                View training leads
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {brandPicker}
            <select
              className="field"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">All campaigns / unassigned</option>
              {brandCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void loadCampaign()}
              disabled={loading}
            >
              Refresh
            </button>
            <Link href="/campaigns" className="btn-ghost">
              Manage campaigns
            </Link>
          </div>

          <Panel
            title="Add campaign leads"
            description="Load contacts for paid outbound. Assign to a campaign — accepted SDRs dial them from Outbound."
          >
            <form onSubmit={addLead} className="stack" style={{ gap: '0.55rem', maxWidth: 560 }}>
              <select
                className="field"
                value={assignCampaignId}
                onChange={(e) => setAssignCampaignId(e.target.value)}
              >
                <option value="">Brand pool (any accepted campaign)</option>
                {brandCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    Assign to: {c.title}
                  </option>
                ))}
              </select>
              <input
                className="field"
                placeholder="Company name *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <div className="search-row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="field"
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="field"
                  placeholder="Website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <input
                  className="field"
                  placeholder="Owner / contact"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn">
                  Add lead
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  Import CSV
                </button>
              </div>
            </form>
          </Panel>

          <Panel
            title={`Campaign lead list (${leads.length})`}
            description="Enrich for talking points. Accepted SDRs call these from Outbound using your playbook."
          >
            {loading ? (
              <p className="muted">Loading…</p>
            ) : leads.length === 0 ? (
              <EmptyState
                title="No campaign leads yet"
                description="Add manually or import a CSV (companyName, phone, website, ownerName)."
              />
            ) : (
              <div className="stack" style={{ gap: '0.45rem' }}>
                {leads.map((l) => (
                  <div
                    key={l.id}
                    className="session-row"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: '1 1 200px' }}>
                      <strong>{l.companyName}</strong>
                      <div className="session-row__meta">
                        {l.ownerName || '—'} · {l.phone || 'no phone'}
                        {l.website ? ` · ${l.website}` : ''}
                        {l.enrichmentStatus === 'done' ? ' · enriched' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        className="field"
                        value={l.campaignId || ''}
                        onChange={(e) => void assignLead(l.id, e.target.value)}
                        style={{ minWidth: 140 }}
                      >
                        <option value="">Brand pool</option>
                        {brandCampaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={enriching === l.id}
                        onClick={() => void enrichOne(l.id)}
                      >
                        {enriching === l.id ? 'Enriching…' : 'Enrich'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onCsv(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
