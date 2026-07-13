'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import SlideOver from '@/components/ui/SlideOver';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { brandHref } from '@/lib/brand-context';
import {
  MATCH_FILTER_OPTIONS,
  matchLabel,
  matchStateOf,
  type MatchState,
} from '@/lib/brand-lead-match';
import { DEMO_CAMPAIGNS, DEMO_LEADS, DEMO_MSG, type DemoLead } from '@/lib/demo/brand-demo-data';

type BrandOpt = { id: string; name: string; slug: string | null };
type CampaignOpt = {
  id: string;
  title: string;
  brandId: string;
  status?: string | null;
};
type Lead = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  ownerName: string | null;
  ownerTitle?: string | null;
  ownerEmail?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  campaignId: string | null;
  status?: string | null;
  source?: string | null;
  hooksJSON?: string | null;
  enrichmentStatus?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  outreachReady?: boolean | null;
  bookingUrlFound?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
type TrainingLeadView = DemoLead;

const PIPELINE_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'warming', label: 'Warming' },
  { value: 'dialing', label: 'Dialing' },
  { value: 'done', label: 'Meeting Booked' },
] as const;

const ALIASES: Record<string, string> = {
  company: 'companyName',
  companyname: 'companyName',
  company_name: 'companyName',
  phone: 'phone',
  website: 'website',
  owner: 'ownerName',
  ownername: 'ownerName',
  owner_name: 'ownerName',
};

function sourceLabel(source?: string | null) {
  if (!source || source === 'manual') return 'Manual';
  if (source === 'maps') return 'Maps';
  if (source === 'import') return 'Import';
  if (source === 'url') return 'URL';
  if (source === 'training') return 'Demo';
  return source;
}

function domainOf(website?: string | null) {
  if (!website) return null;
  return website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 28);
}

function locationOf(lead: { city?: string | null; state?: string | null }) {
  return [lead.city, lead.state].filter(Boolean).join(', ') || null;
}

function formatTs(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function websiteHref(website: string) {
  return website.startsWith('http') ? website : `https://${website}`;
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function matchChipClass(state: MatchState) {
  return `brand-leads__match-chip brand-leads__match-chip--${state}`;
}

export default function BrandLeadsClient({
  brands,
  campaigns,
}: {
  brands: BrandOpt[];
  campaigns: CampaignOpt[];
  /** @deprecated Demo mode always uses in-memory fixtures. */
  platformTrainingLeads?: TrainingLeadView[];
}) {
  const router = useRouter();
  const { mode, hydrated } = useBrandDeskMode();
  const isLive = hydrated && mode === 'live';
  const isDemo = hydrated && mode === 'demo';
  const brandId = brands[0]?.id || '';
  const brandKey = brands[0]?.slug || brands[0]?.id || '';

  const [campaignFilter, setCampaignFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trainingLeads, setTrainingLeads] = useState<TrainingLeadView[]>(DEMO_LEADS);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [assignCampaignId, setAssignCampaignId] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const brandCampaigns = useMemo(() => {
    if (isLive) return campaigns.filter((c) => c.brandId === brandId);
    return DEMO_CAMPAIGNS.map((c) => ({
      id: c.id,
      title: c.title,
      brandId: brandId || 'demo',
      status: c.status,
    }));
  }, [isLive, campaigns, brandId]);

  const campaignTitle = useCallback(
    (id: string | null | undefined) => {
      if (!id) return 'Unassigned';
      const live = brandCampaigns.find((c) => c.id === id)?.title;
      if (live) return live;
      const demo = DEMO_CAMPAIGNS.find((c) => c.id === id)?.title;
      return demo || 'Unassigned';
    },
    [brandCampaigns]
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadCampaign = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!brandId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ brandId, limit: '200' });
        if (campaignFilter) qs.set('campaignId', campaignFilter);
        if (searchDebounced) qs.set('q', searchDebounced);
        const res = await fetch(`/api/prospects?${qs}`);
        const data = await res.json();
        if (signal?.cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setLeads(data.prospects || []);
      } catch (e: unknown) {
        if (signal?.cancelled) return;
        setMsg(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [brandId, campaignFilter, searchDebounced]
  );

  const deskReadyRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!deskReadyRef.current) {
      deskReadyRef.current = true;
      return;
    }
    setSelected(new Set());
    setDetail(null);
    setPage(1);
    setMsg(null);
  }, [hydrated, mode, brandId]);

  useEffect(() => {
    if (!hydrated) return;

    if (mode === 'demo') {
      setTrainingLeads(DEMO_LEADS);
      setLoading(false);
      return;
    }

    if (!brandId) return;
    const signal = { cancelled: false };
    void loadCampaign(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [hydrated, mode, brandId, loadCampaign]);

  useEffect(() => {
    if (!detail || !hydrated) return;
    if (isLive && loading) return;
    const pool = isLive ? leads : trainingLeads;
    const next = pool.find((l) => l.id === detail.id);
    if (next) setDetail(next as Lead);
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from pools only
  }, [leads, trainingLeads, isLive, loading, hydrated]);

  const pool = isLive ? leads : trainingLeads;

  const filteredLeads = useMemo(() => {
    return pool.filter((l) => {
      if (campaignFilter && l.campaignId !== campaignFilter) return false;
      if (matchFilter) {
        const state = matchStateOf(l);
        if (matchFilter === 'prepping' && state !== 'prepping' && state !== 'failed') return false;
        if (matchFilter === 'dialing' && state !== 'dialing') return false;
        if (matchFilter === 'booked' && state !== 'booked') return false;
      }
      if (searchDebounced) {
        const q = searchDebounced.toLowerCase();
        return (
          l.companyName.toLowerCase().includes(q) ||
          (l.ownerName || '').toLowerCase().includes(q) ||
          (l.phone || '').includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (l.industry || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pool, matchFilter, campaignFilter, searchDebounced]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filteredLeads.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, matchFilter, searchDebounced, pageSize]);

  async function addLead(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    if (isLive && !brandId) return;
    setMsg(null);
    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: brandId || null,
        campaignId: assignCampaignId || null,
        training: false,
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
    setAddOpen(false);
    setMsg('Lead added — conditioning starts automatically.');
    await loadCampaign();
  }

  async function enrichOne(id: string, syncCrm = false) {
    if (!isLive) {
      setMsg(DEMO_MSG);
      return;
    }
    setEnriching(id);
    setMsg(null);
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: id, syncCrm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      setMsg(
        `Conditioned — ${(data.hooks || []).length} talking points${syncCrm ? ' · synced to CRM' : ''}`
      );
      await loadCampaign();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Enrich failed');
    } finally {
      setEnriching(null);
    }
  }

  async function enrichSelected(syncCrm = false) {
    const ids = [...selected];
    if (!ids.length) {
      setMsg('Select leads first');
      return;
    }
    setBulkBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: ids, syncCrm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      setMsg(
        `Conditioned ${data.enriched || ids.length} lead${(data.enriched || ids.length) === 1 ? '' : 's'}${
          syncCrm ? ' · pushed to connected CRM' : ''
        }`
      );
      setSelected(new Set());
      await loadCampaign();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Enrich failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function syncSelectedToCrm() {
    const ids = [...selected];
    if (!ids.length) {
      setMsg('Select leads first');
      return;
    }
    setBulkBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/integrations/crm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'push', prospectIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setMsg(`Synced ${ids.length} lead${ids.length === 1 ? '' : 's'} to connected CRM`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function exportSelected() {
    const ids = selected.size ? selected : new Set(filteredLeads.map((l) => l.id));
    const rows = filteredLeads.filter((l) => ids.has(l.id));
    if (!rows.length) {
      setMsg('Nothing to export');
      return;
    }
    const headers = ['Company', 'Industry', 'Owner', 'Title', 'Phone', 'City', 'State', 'Campaign', 'Status'];
    const dq = /"/g;
    const csvRows = rows.map((l) =>
      [
        l.companyName,
        l.industry || '',
        l.ownerName || '',
        ('ownerTitle' in l && l.ownerTitle) || '',
        l.phone || '',
        l.city || '',
        l.state || '',
        campaignTitle(l.campaignId),
        matchLabel(matchStateOf(l)),
      ]
        .map((v) => `"${String(v).replace(dq, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageIds = paged.map((l) => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function assignLead(id: string, campaignId: string) {
    if (!isLive) {
      setMsg(DEMO_MSG);
      return;
    }
    const nextId = campaignId || null;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, campaignId: nextId } : l)));
    if (detail?.id === id) setDetail({ ...detail, campaignId: nextId });
    await fetch('/api/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, campaignId: nextId }),
    });
    await loadCampaign();
  }

  async function patchStatus(id: string, status: string) {
    if (!isLive) {
      setMsg(DEMO_MSG);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    if (detail?.id === id) setDetail({ ...detail, status });
    await fetch('/api/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadCampaign();
  }

  async function onCsv(file: File) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    if (isLive && !brandId) return;
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
        campaignId: assignCampaignId || null,
        training: false,
        rows,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Import failed');
      return;
    }
    setMsg(`Imported ${data.created} leads${data.skipped ? ` · skipped ${data.skipped}` : ''}`);
    await loadCampaign();
  }

  function openDetail(lead: Lead | TrainingLeadView) {
    if (isLive && brandKey && lead.id) {
      router.push(brandHref(brandKey, 'leads', lead.id));
      return;
    }
    setDetail({
      ...lead,
      campaignId: lead.campaignId ?? null,
    } as Lead);
  }

  function closeDetail() {
    setDetail(null);
  }

  const detailDomain = detail ? domainOf(detail.website) : null;
  const detailCreated = detail ? formatTs(detail.createdAt) : null;
  const detailUpdated = detail ? formatTs(detail.updatedAt) : null;
  const detailEmail =
    detail && 'ownerEmail' in detail && detail.ownerEmail ? String(detail.ownerEmail) : null;
  const detailMatch = detail ? matchStateOf(detail) : null;

  return (
    <div className="stack brand-leads">
      <div className="brand-leads__toolbar">
        <div className="brand-leads__search">
          <input
            className="field"
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search leads"
          />
        </div>
        <div className="brand-leads__filter-controls">
          <select
            className="field"
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            aria-label="Filter by campaign"
          >
            <option value="">All campaigns</option>
            {brandCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            aria-label="Filter by match status"
          >
            {MATCH_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="field brand-leads__page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={100000}>All</option>
          </select>
        </div>
        <div className="brand-leads__actions">
          {brandKey ? (
            <Link href={`/brands/${brandKey}/pipeline?find=1`} className="btn btn-primary btn-sm">
              Find leads
            </Link>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAddOpen(true)}
          >
            Add
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (isDemo) {
                setTrainingLeads(DEMO_LEADS);
                return;
              }
              void loadCampaign();
            }}
            disabled={loading}
          >
            Refresh
          </button>
          {brandKey ? (
            <Link href={`/brands/${brandKey}/campaigns`} className="btn btn-ghost btn-sm">
              Campaigns
            </Link>
          ) : null}
        </div>
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

      {msg ? <p className="form-msg">{msg}</p> : null}

      {selected.size > 0 ? (
        <div className="brand-leads__bulk">
          <span className="brand-leads__bulk-count">{selected.size} selected</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportSelected}>
            Export
          </button>
          {isLive ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              {advancedOpen ? 'Hide advanced' : 'Advanced'}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          {isLive && advancedOpen ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkBusy}
                onClick={() => void enrichSelected(false)}
              >
                Condition
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkBusy}
                onClick={() => void enrichSelected(true)}
              >
                Condition + sync
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkBusy}
                onClick={() => void syncSelectedToCrm()}
              >
                Push to CRM
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="brand-leads__panel">
        {loading && filteredLeads.length === 0 ? (
          <div className="brand-leads__empty">
            <p className="muted">Loading leads…</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="brand-leads__empty">
            <p className="muted">
              {isLive
                ? pool.length === 0
                  ? 'No leads yet. Find leads on Pipeline, or add one manually.'
                  : 'No leads match the current filters.'
                : 'No demo leads.'}
            </p>
            {isLive && pool.length === 0 ? (
              <div className="brand-leads__actions" style={{ marginLeft: 0 }}>
                {brandKey ? (
                  <Link href={`/brands/${brandKey}/pipeline?find=1`} className="btn btn-primary">
                    Find leads
                  </Link>
                ) : null}
                <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(true)}>
                  Add lead
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setCampaignFilter('');
                  setMatchFilter('');
                  setSearch('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="brand-leads__table-wrap">
            <table className="brand-leads__table brand-leads__table--match">
              <thead>
                <tr className="brand-leads__row brand-leads__row--head">
                  {isLive ? (
                    <th className="brand-leads__th-check brand-leads__col--check">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected && !allPageSelected;
                        }}
                        onChange={toggleSelectAll}
                        aria-label="Select page"
                      />
                    </th>
                  ) : null}
                  <th className="brand-leads__col--company">Company</th>
                  <th className="brand-leads__col--dm">Decision maker</th>
                  <th className="brand-leads__col--phone">Phone</th>
                  <th className="brand-leads__col--match-status">Status</th>
                  <th className="brand-leads__col--campaign">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => {
                  const live = l as Lead;
                  const loc = locationOf(l);
                  const state = matchStateOf(l);
                  const title =
                    'ownerTitle' in l && l.ownerTitle ? String(l.ownerTitle) : null;
                  return (
                    <tr
                      key={l.id}
                      className={`brand-leads__tr brand-leads__row${selected.has(l.id) ? ' is-selected' : ''}`}
                      onClick={() => openDetail(l)}
                    >
                      {isLive ? (
                        <td
                          className="brand-leads__td-check brand-leads__col--check"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(l.id)}
                            onChange={() => toggleSelect(l.id)}
                            aria-label={`Select ${l.companyName}`}
                          />
                        </td>
                      ) : null}
                      <td className="brand-leads__col--company">
                        <div className="brand-leads__name-cell">
                          <span className="brand-leads__avatar" aria-hidden>
                            {l.companyName.charAt(0).toUpperCase()}
                          </span>
                          <div className="brand-leads__name-meta">
                            <span className="brand-leads__name">{l.companyName}</span>
                            <span className="brand-leads__sub muted">
                              {[l.industry, loc].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="brand-leads__col--dm">
                        <div className="brand-leads__dm">
                          <span className="brand-leads__dm-name">{l.ownerName || '—'}</span>
                          {title ? <span className="brand-leads__dm-title muted">{title}</span> : null}
                        </div>
                      </td>
                      <td className="brand-leads__col--phone brand-leads__phone">
                        {l.phone || <span className="muted">—</span>}
                      </td>
                      <td className="brand-leads__col--match-status">
                        <span className={matchChipClass(state)}>{matchLabel(state)}</span>
                      </td>
                      <td
                        className="brand-leads__col--campaign"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isLive ? (
                          <select
                            className="field field-sm brand-leads__campaign-select"
                            value={live.campaignId || ''}
                            onChange={(e) => void assignLead(l.id, e.target.value)}
                            aria-label="Assign campaign"
                          >
                            <option value="">Unassigned</option>
                            {brandCampaigns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted small">{campaignTitle(l.campaignId)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="brand-leads__pager">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="muted small">
              Page {pageSafe} of {totalPages} · {filteredLeads.length} shown
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>

      <SlideOver
        open={!!detail}
        onClose={closeDetail}
        title={detail?.companyName || 'Lead'}
        description={
          detailMatch
            ? matchLabel(detailMatch)
            : detailDomain
              ? detailDomain
              : isLive
                ? 'Lead detail'
                : 'Demo lead'
        }
        wide
      >
        {detail && detailMatch ? (
          <div className="brand-leads__detail">
            <section className="brand-leads__detail-section">
              <h3 className="brand-leads__detail-section-title">Match status</h3>
              <p>
                <span className={matchChipClass(detailMatch)}>{matchLabel(detailMatch)}</span>
                {detail.outreachReady ? (
                  <span className="brand-leads__match-chip brand-leads__match-chip--booked" style={{ marginLeft: 8 }}>
                    Dial-ready
                  </span>
                ) : null}
              </p>
              <dl className="brand-leads__detail-grid" style={{ marginTop: '0.75rem' }}>
                <div>
                  <dt>Phase 1 · Targeting</dt>
                  <dd>{detail.scrapeStatus || 'not_started'}</dd>
                </div>
                <div>
                  <dt>Phase 2 · Conditioning</dt>
                  <dd>{detail.webScanStatus || 'not_started'}</dd>
                </div>
                <div>
                  <dt>Phase 3 · Enrich</dt>
                  <dd>{detail.enrichmentStatus || 'none'}</dd>
                </div>
                <div>
                  <dt>QC gates</dt>
                  <dd>
                    {[
                      detail.qualifyPhase1 ? 'P1' : null,
                      detail.qualifyPhase2 ? 'P2' : null,
                      detail.qualifyPhase3 ? 'P3' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </dd>
                </div>
                {detail.bookingUrlFound ? (
                  <div>
                    <dt>Prospect booking URL</dt>
                    <dd>
                      <a href={detail.bookingUrlFound} target="_blank" rel="noreferrer">
                        {detail.bookingUrlFound.slice(0, 48)}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="brand-leads__detail-section">
              <h3 className="brand-leads__detail-section-title">Company</h3>
              <dl className="brand-leads__detail-grid">
                <div>
                  <dt>Industry</dt>
                  <dd>{detail.industry || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{locationOf(detail) || '—'}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>
                    {detail.website ? (
                      <a href={websiteHref(detail.website)} target="_blank" rel="noreferrer">
                        {detailDomain || detail.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{sourceLabel(detail.source)}</dd>
                </div>
              </dl>
            </section>

            <section className="brand-leads__detail-section">
              <h3 className="brand-leads__detail-section-title">Decision maker</h3>
              <dl className="brand-leads__detail-grid">
                <div>
                  <dt>Name</dt>
                  <dd>
                    {detail.ownerName || '—'}
                    {detail.ownerTitle ? (
                      <span className="muted"> · {detail.ownerTitle}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd className="brand-leads__phone">{detail.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {detailEmail ? <a href={`mailto:${detailEmail}`}>{detailEmail}</a> : '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="brand-leads__detail-section">
              <h3 className="brand-leads__detail-section-title">Campaign</h3>
              <dl className="brand-leads__detail-grid">
                <div>
                  <dt>Assigned</dt>
                  <dd>
                    {isLive ? (
                      <select
                        className="field field-sm brand-leads__detail-select"
                        value={detail.campaignId || ''}
                        onChange={(e) => void assignLead(detail.id, e.target.value)}
                        aria-label="Assign campaign"
                      >
                        <option value="">Unassigned</option>
                        {brandCampaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      campaignTitle(detail.campaignId)
                    )}
                  </dd>
                </div>
                {isLive ? (
                  <div>
                    <dt>Pipeline stage</dt>
                    <dd>
                      <select
                        className="field field-sm brand-leads__detail-select"
                        value={detail.status || 'new'}
                        onChange={(e) => void patchStatus(detail.id, e.target.value)}
                        aria-label="Lead status"
                      >
                        {PIPELINE_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {detail.notes ? (
              <section className="brand-leads__detail-section">
                <h3 className="brand-leads__detail-section-title">Notes</h3>
                <p className="brand-leads__detail-notes">{detail.notes}</p>
              </section>
            ) : null}

            {(detailCreated || detailUpdated) && (
              <section className="brand-leads__detail-section">
                <h3 className="brand-leads__detail-section-title">Timestamps</h3>
                <dl className="brand-leads__detail-grid">
                  {detailCreated ? (
                    <div>
                      <dt>Created</dt>
                      <dd className="muted small">{detailCreated}</dd>
                    </div>
                  ) : null}
                  {detailUpdated ? (
                    <div>
                      <dt>Updated</dt>
                      <dd className="muted small">{detailUpdated}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            )}

            {isLive ? (
              <details className="brand-leads__advanced-details">
                <summary>Advanced</summary>
                <div className="brand-leads__detail-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={enriching === detail.id}
                    onClick={() => void enrichOne(detail.id, false)}
                  >
                    {enriching === detail.id ? 'Conditioning…' : 'Re-condition'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={enriching === detail.id}
                    onClick={() => void enrichOne(detail.id, true)}
                  >
                    Condition + sync CRM
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </SlideOver>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={isLive ? 'Add lead' : 'Add demo lead'}
        wide
      >
        <form className="stack gap-sm" onSubmit={addLead}>
          <p className="muted small">
            {isLive
              ? 'Adds to this brand’s match pipeline. Optionally assign a campaign.'
              : 'Practice-only lead for trainer desks.'}
          </p>
          <label className="field-label">
            Company
            <input
              className="field"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <div className="grid-2">
            <label className="field-label">
              Phone
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="field-label">
              Website
              <input className="field" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <label className="field-label">
            Decision maker
            <input className="field" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          {isLive ? (
            <label className="field-label">
              Campaign
              <select
                className="field"
                value={assignCampaignId}
                onChange={(e) => setAssignCampaignId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {brandCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isLive ? 'Add lead' : 'Add demo lead'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
