'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  DEMO_MSG,
  getDemoCampaigns,
  getDemoLeads,
  type DemoLead,
} from '@/lib/demo/brand-demo-data';
import {
  DeskToolbar,
  DeskToolbarSearch,
  DeskToolbarSelect,
} from '@/components/ui/DeskChrome';
import BrandLeadsPhaseTable from '@/components/BrandLeadsPhaseTable';
import { parseIntel, scoreTone } from '@/lib/prospect-intel';

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
  mapsPlaceId?: string | null;
  notes?: string | null;
  attemptCount?: number;
  callCount?: number;
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
  if (source === 'maps') return 'Generate';
  if (source === 'import') return 'Import';
  if (source === 'url') return 'URL';
  if (source === 'training') return 'Demo';
  return source;
}

/** UI source filter → API / fixture source value */
function sourceFilterToApi(ui: string): string | null {
  if (ui === 'generate') return 'maps';
  if (ui === 'import' || ui === 'manual') return ui;
  return null;
}

const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'generate', label: 'Generate' },
  { value: 'import', label: 'Import' },
  { value: 'manual', label: 'Manual' },
];

const PHASE_FILTER_OPTIONS = [
  { value: '', label: 'All phases' },
  { value: 'raw', label: 'Raw — pending P1' },
  { value: 'p1', label: 'Phase 1 — scraped' },
  { value: 'p2', label: 'Phase 2 — scanned' },
  { value: 'p3', label: 'Phase 3 — enriched' },
  { value: 'ready', label: 'Dial-ready' },
];

function domainOf(website?: string | null) {
  if (!website) return null;
  return website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 28);
}

function locationOf(lead: { city?: string | null; state?: string | null }) {
  return [lead.city, lead.state].filter(Boolean).join(', ') || null;
}

/** Trojan-style P1–P3 qualification dots (P4/P5 frozen). */
function PhaseDots({
  lead,
}: {
  lead: {
    qualifyPhase1?: boolean | null;
    qualifyPhase2?: boolean | null;
    qualifyPhase3?: boolean | null;
  };
}) {
  const phases = [lead.qualifyPhase1, lead.qualifyPhase2, lead.qualifyPhase3];
  return (
    <div className="brand-leads__phases" aria-label="Pipeline phases 1–3">
      {phases.map((p, i) => {
        const pending = p == null && (i === 0 || phases[i - 1] === true);
        const tone = p === true ? 'ok' : p === false ? 'bad' : pending ? 'pending' : 'idle';
        return (
          <span
            key={i}
            className={`brand-leads__phase-dot brand-leads__phase-dot--${tone}`}
            title={`Phase ${i + 1}${p === true ? ' passed' : p === false ? ' failed' : pending ? ' pending' : ''}`}
          >
            {p === true ? '✓' : p === false ? '×' : pending ? '·' : ''}
          </span>
        );
      })}
    </div>
  );
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
  const searchParams = useSearchParams();
  const { mode, hydrated } = useBrandDeskMode();
  // Prefer live data until desk mode is known demo — never flash DEMO_LEADS at Live users.
  const isDemo = mode === 'demo';
  const isLive = !isDemo;
  const brandId = brands[0]?.id || '';
  const brandKey = brands[0]?.slug || brands[0]?.id || '';

  const [campaignFilter, setCampaignFilter] = useState(
    () => searchParams.get('campaignId') || ''
  );
  const [sourceFilter, setSourceFilter] = useState(
    () => searchParams.get('source') || ''
  );
  const [matchFilter, setMatchFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [trainingLeads, setTrainingLeads] = useState<TrainingLeadView[]>(() =>
    getDemoLeads(brandKey || 'demo-meridianops')
  );
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

  // Sync filters from URL (e.g. Generate job → leads)
  useEffect(() => {
    const camp = searchParams.get('campaignId') || '';
    const src = searchParams.get('source') || '';
    setCampaignFilter(camp);
    setSourceFilter(src);
  }, [searchParams]);

  function writeLeadFilters(next: { campaignId?: string; source?: string }) {
    if (!brandKey) return;
    const params = new URLSearchParams();
    const camp = next.campaignId !== undefined ? next.campaignId : campaignFilter;
    const src = next.source !== undefined ? next.source : sourceFilter;
    if (camp) params.set('campaignId', camp);
    if (src) params.set('source', src);
    const qs = params.toString();
    router.replace(qs ? `${brandHref(brandKey, 'leads')}?${qs}` : brandHref(brandKey, 'leads'), {
      scroll: false,
    });
  }

  const brandCampaigns = useMemo(() => {
    if (isLive) return campaigns.filter((c) => c.brandId === brandId);
    return getDemoCampaigns(brandKey).map((c) => ({
      id: c.id,
      title: c.title,
      brandId: brandId || 'demo',
      status: c.status,
    }));
  }, [isLive, campaigns, brandId, brandKey]);

  // Sync enroll goal from campaign filter; allow empty = All goals
  useEffect(() => {
    if (campaignFilter && brandCampaigns.some((c) => c.id === campaignFilter)) {
      setAssignCampaignId(campaignFilter);
      return;
    }
    if (assignCampaignId && !brandCampaigns.some((c) => c.id === assignCampaignId)) {
      setAssignCampaignId('');
    }
  }, [brandCampaigns, campaignFilter, assignCampaignId]);

  const campaignTitle = useCallback(
    (id: string | null | undefined) => {
      if (!id) return 'Needs campaign';
      const live = brandCampaigns.find((c) => c.id === id)?.title;
      if (live) return live;
      const demo = getDemoCampaigns(brandKey).find((c) => c.id === id)?.title;
      return demo || 'Needs campaign';
    },
    [brandCampaigns, brandKey]
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
        const listLimit =
          typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
            ? '50'
            : '100';
        const qs = new URLSearchParams({
          brandId,
          limit: listLimit,
          fields: 'list',
        });
        if (campaignFilter) qs.set('campaignId', campaignFilter);
        if (searchDebounced) qs.set('q', searchDebounced);
        const apiSource = sourceFilterToApi(sourceFilter);
        if (apiSource) qs.set('source', apiSource);
        const res = await fetch(`/api/prospects?${qs}`);
        const data = await res.json();
        if (signal?.cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setLeads(data.prospects || []);
        setServerTotal(typeof data.total === 'number' ? data.total : null);
        setServerHasMore(Boolean(data.hasMore));
      } catch (e: unknown) {
        if (signal?.cancelled) return;
        setMsg(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [brandId, campaignFilter, searchDebounced, sourceFilter]
  );

  const loadMoreCampaign = useCallback(async () => {
    if (!brandId || !serverHasMore) return;
    setLoading(true);
    try {
      const listLimit =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
          ? '50'
          : '100';
      const qs = new URLSearchParams({
        brandId,
        limit: listLimit,
        fields: 'list',
        skip: String(leads.length),
      });
      if (campaignFilter) qs.set('campaignId', campaignFilter);
      if (searchDebounced) qs.set('q', searchDebounced);
      const apiSource = sourceFilterToApi(sourceFilter);
      if (apiSource) qs.set('source', apiSource);
      const res = await fetch(`/api/prospects?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const next = (data.prospects || []) as Lead[];
      setLeads((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setServerTotal(typeof data.total === 'number' ? data.total : null);
      setServerHasMore(Boolean(data.hasMore));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [brandId, campaignFilter, searchDebounced, sourceFilter, leads.length, serverHasMore]);

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
      setTrainingLeads(getDemoLeads(brandKey));
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
    const apiSource = sourceFilterToApi(sourceFilter);
    return pool.filter((l) => {
      if (campaignFilter && l.campaignId !== campaignFilter) return false;
      if (apiSource) {
        const leadSource = l.source || 'manual';
        if (leadSource !== apiSource) return false;
      }
      if (matchFilter) {
        const state = matchStateOf(l);
        if (matchFilter === 'prepping' && state !== 'prepping' && state !== 'failed') return false;
        if (matchFilter === 'dialing' && state !== 'dialing') return false;
        if (matchFilter === 'booked' && state !== 'booked') return false;
      }
      if (phaseFilter) {
        const p1 = l.qualifyPhase1;
        const p2 = l.qualifyPhase2;
        const p3 = l.qualifyPhase3;
        if (phaseFilter === 'raw' && p1 != null) return false;
        if (phaseFilter === 'p1' && !(p1 === true && p2 == null)) return false;
        if (phaseFilter === 'p2' && !(p2 === true && p3 == null)) return false;
        if (phaseFilter === 'p3' && p3 !== true) return false;
        if (
          phaseFilter === 'ready' &&
          !(p3 === true && l.outreachReady)
        ) {
          return false;
        }
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
  }, [pool, matchFilter, phaseFilter, campaignFilter, searchDebounced, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filteredLeads.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, matchFilter, phaseFilter, searchDebounced, pageSize, sourceFilter]);

  // Auto-refresh live leads (no manual Refresh button)
  useEffect(() => {
    if (!isLive || !brandId || !hydrated) return;
    const onFocus = () => void loadCampaign();
    window.addEventListener('focus', onFocus);
    const t = setInterval(() => void loadCampaign(), 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(t);
    };
  }, [isLive, brandId, hydrated, loadCampaign]);

  async function addLead(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    if (isLive && !brandId) return;
    if (!assignCampaignId) {
      setMsg('Pick a campaign — leads must be enrolled in a campaign');
      return;
    }
    setMsg(null);
    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: brandId || null,
        campaignId: assignCampaignId,
        training: false,
        source: 'manual',
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
    if (!campaignId) {
      setMsg('Pick a campaign — brand leads must stay enrolled');
      return;
    }
    const nextId = campaignId;
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
    if (!assignCampaignId) {
      setMsg('Pick a campaign before importing — leads must be enrolled');
      return;
    }
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
        campaignId: assignCampaignId,
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

  const phaseStats = useMemo(() => {
    const total = pool.length;
    const raw = pool.filter((l) => !l.qualifyPhase1).length;
    const high = pool.filter((l) => {
      const s = parseIntel(l.hooksJSON)?.score;
      return s != null && s >= 60;
    }).length;
    const audited = pool.filter((l) => l.qualifyPhase3 && l.outreachReady).length;
    const fresh = pool.filter((l) => l.status === 'new').length;
    return { total, raw, high, audited, fresh };
  }, [pool]);

  return (
    <div className="stack brand-leads">
      <div className="brand-leads__phase-strip" aria-label="Lead enrichment summary">
        <span className="brand-leads__phase-pill">
          <strong>{phaseStats.total}</strong> Total
        </span>
        <span className="brand-leads__phase-pill brand-leads__phase-pill--new">
          <strong>{phaseStats.fresh}</strong> New
        </span>
        <span className="brand-leads__phase-pill brand-leads__phase-pill--hot">
          <strong>{phaseStats.high}</strong> High priority
        </span>
        <span className="brand-leads__phase-pill brand-leads__phase-pill--raw">
          <strong>{phaseStats.raw}</strong> Raw (P1)
        </span>
        <span className="brand-leads__phase-pill brand-leads__phase-pill--ok">
          <strong>{phaseStats.audited}</strong> Dial-ready
        </span>
      </div>

      <div className="brand-leads__chrome">
        <DeskToolbar>
          <DeskToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Search company, owner, phone…"
            label="Search leads"
          />
          <DeskToolbarSelect
            value={campaignFilter}
            onChange={(v) => {
              setCampaignFilter(v);
              writeLeadFilters({ campaignId: v });
            }}
            label="Campaign"
          >
            <option value="">All campaigns</option>
            {brandCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </DeskToolbarSelect>
          <DeskToolbarSelect
            value={sourceFilter}
            onChange={(v) => {
              setSourceFilter(v);
              writeLeadFilters({ source: v });
            }}
            label="Source"
          >
            {SOURCE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </DeskToolbarSelect>
          <DeskToolbarSelect value={phaseFilter} onChange={setPhaseFilter} label="Phase">
            {PHASE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </DeskToolbarSelect>
          <DeskToolbarSelect value={matchFilter} onChange={setMatchFilter} label="Status">
            {MATCH_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </DeskToolbarSelect>
          <DeskToolbarSelect
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            label="Rows per page"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={100000}>All</option>
          </DeskToolbarSelect>
        </DeskToolbar>

        <div className="brand-leads__actions">
          {brandKey ? (
            <Link href={`/brands/${brandKey}/pipeline?find=1`} className="btn-ghost btn-sm">
              Generate leads
            </Link>
          ) : null}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setAddOpen(true)}>
            New lead
          </button>
          <div className="brand-leads__goal">
            <DeskToolbarSelect
              value={assignCampaignId}
              onChange={setAssignCampaignId}
              label="Goal for new / import"
            >
              <option value="">All goals</option>
              {brandCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </DeskToolbarSelect>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              if (!assignCampaignId) {
                setMsg('Pick a goal before importing — leads must be enrolled');
                return;
              }
              fileRef.current?.click();
            }}
          >
            Import
          </button>
          {brandKey ? (
            <Link href={`/brands/${brandKey}/campaigns`} className="btn-ghost btn-sm">
              Campaigns
            </Link>
          ) : null}
          {brandKey ? (
            <Link href={`/brands/${brandKey}/leads/audit`} className="btn-ghost btn-sm">
              Audit log
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
                  ? 'No leads yet. Generate leads, import a CSV, or add one manually.'
                  : 'No leads match the current filters.'
                : 'No demo leads.'}
            </p>
            {isLive && pool.length === 0 ? (
              <div className="brand-leads__actions" style={{ marginLeft: 0 }}>
                {brandKey ? (
                  <Link href={`/brands/${brandKey}/pipeline?find=1`} className="btn-ghost btn-sm">
                    Generate leads
                  </Link>
                ) : null}
                <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(true)}>
                  New lead
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setCampaignFilter('');
                  setMatchFilter('');
                  setPhaseFilter('');
                  setSourceFilter('');
                  setSearch('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="brand-leads__cards" aria-label="Leads">
              {paged.map((l) => {
                const state = matchStateOf(l);
                const intel = parseIntel(l.hooksJSON);
                const score = intel?.score ?? null;
                const loc = locationOf(l);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`brand-leads__card${selected.has(l.id) ? ' is-selected' : ''}`}
                      onClick={() => openDetail(l)}
                    >
                      <div className="brand-leads__card-top">
                        <span className="brand-leads__avatar" aria-hidden>
                          {l.companyName.charAt(0).toUpperCase()}
                        </span>
                        <div className="brand-leads__card-meta">
                          <span className="brand-leads__name">{l.companyName}</span>
                          <span className="brand-leads__sub muted">
                            {[loc, l.phone].filter(Boolean).join(' · ') || domainOf(l.website) || '—'}
                          </span>
                        </div>
                        <span
                          className={`brand-leads__score brand-leads__score--${scoreTone(score)}`}
                        >
                          {score != null ? Math.round(score) : '—'}
                        </span>
                      </div>
                      <div className="brand-leads__card-foot">
                        <PhaseDots lead={l} />
                        <span className={matchChipClass(state)}>{matchLabel(state)}</span>
                        <span className="muted small">{campaignTitle(l.campaignId)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <BrandLeadsPhaseTable
              leads={paged}
              isLive={isLive}
              brandKey={brandKey}
              brandCampaigns={brandCampaigns}
              selected={selected}
              allPageSelected={allPageSelected}
              somePageSelected={somePageSelected}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelect={toggleSelect}
              onOpenDetail={openDetail}
              onAssignLead={(id, campaignId) => void assignLead(id, campaignId)}
              campaignTitle={campaignTitle}
              matchChipClass={matchChipClass}
              matchLabel={matchLabel}
              matchStateOf={(lead) => matchStateOf(lead)}
            />
          </>
        )}

        {totalPages > 1 || (isLive && serverHasMore) ? (
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
              Page {pageSafe} of {totalPages} · {filteredLeads.length} loaded
              {serverTotal != null ? ` of ${serverTotal}` : ''}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pageSafe >= totalPages && !serverHasMore}
              onClick={() => {
                if (pageSafe < totalPages) {
                  setPage((p) => Math.min(totalPages, p + 1));
                  return;
                }
                if (isLive && serverHasMore) void loadMoreCampaign();
              }}
            >
              {pageSafe >= totalPages && serverHasMore ? 'Load more' : 'Next →'}
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
                        required
                      >
                        {!detail.campaignId ? (
                          <option value="" disabled>
                            Select campaign…
                          </option>
                        ) : null}
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
        title="New lead"
        wide
      >
        <form className="stack gap-sm" onSubmit={addLead}>
          <p className="muted small">
            {isLive
              ? 'Manual add — free (no lead credits). Must enroll in a campaign.'
              : 'Demo lead for practice desks.'}
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
              Goal
              <select
                className="field"
                value={assignCampaignId}
                onChange={(e) => setAssignCampaignId(e.target.value)}
              >
                <option value="">All goals</option>
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
              Save lead
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
