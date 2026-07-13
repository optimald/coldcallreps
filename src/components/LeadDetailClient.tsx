'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';
import { CALL_DISPOSITIONS } from '@/components/FloatingCallWidget';
import { FOCUS_LABELS } from '@/lib/product';
import {
  formatRelativeReview,
  getGrade,
  healthTone,
  parseHooks as parseHooksPayload,
  parseIntel,
  scoreTone,
  signalTone,
  synthesizeTrainingIntel,
  type ProspectIntel,
} from '@/lib/prospect-intel';
import { matchLabel, matchStateOf } from '@/lib/brand-lead-match';
import { formatDuration, scoreColor } from '@/lib/trainer/session-utils';

export type LeadDetailTab = 'identity' | 'intel' | 'preview' | 'pipeline' | 'calls' | 'audit';

type LeadForm = {
  companyName: string;
  ownerName: string;
  ownerTitle: string;
  gatekeeperName: string;
  phone: string;
  website: string;
  industry: string;
  city: string;
  state: string;
  notes: string;
  status: string;
};

type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  actorName: string;
  actorEmail?: string | null;
  meta?: {
    changes?: Record<string, { from: unknown; to: unknown }>;
    source?: string;
  };
};

type CallRow = {
  id: string;
  kind?: 'live';
  direction: string;
  status: string;
  duration: number | null;
  outcome: string | null;
  notes: string | null;
  toNumber?: string | null;
  fromNumber?: string | null;
  createdAt: string;
  repName: string;
};

type SessionRow = {
  id: string;
  kind?: 'practice';
  overallScore: number;
  duration: number;
  focusArea: string;
  scenarioType?: string;
  difficulty: string;
  pointsEarned?: number;
  outcome?: string | null;
  notes?: string | null;
  createdAt: string;
  repName: string;
};

type PipelineSnapshot = {
  enrichmentStatus: string;
  scrapeStatus: string;
  webScanStatus: string;
  qualifyPhase1: boolean | null;
  qualifyPhase2: boolean | null;
  qualifyPhase3: boolean | null;
  outreachReady: boolean;
  bookingUrlFound: string | null;
  reviewRating: number | null;
  reviewCount: number | null;
  attemptCount: number;
  lastDisposition: string | null;
  nextCallAt: string | null;
};

type Meta = {
  brandName?: string | null;
  brandSlug?: string | null;
  brandId?: string | null;
  campaignTitle?: string | null;
  hooks: string[];
  intel: ProspectIntel | null;
  pipeline: PipelineSnapshot;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
};

type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

const WEBEVO_MODULES: { key: keyof NonNullable<ProspectIntel['webEvoModules']>; label: string }[] = [
  { key: 'ui', label: 'UI' },
  { key: 'performance', label: 'Performance' },
  { key: 'seo', label: 'SEO' },
  { key: 'security', label: 'Security' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'compatibility', label: 'Compat' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'accessibility', label: 'A11y' },
  { key: 'siteHealth', label: 'Site health' },
];

const PREVIEW_DIMS: Record<PreviewViewport, { w: number; h: number; label: string }> = {
  desktop: { w: 1280, h: 800, label: '1280 × 800' },
  tablet: { w: 768, h: 1024, label: '768 × 1024' },
  mobile: { w: 375, h: 812, label: '375 × 812' },
};

function dispositionLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—';
  const hit = CALL_DISPOSITIONS.find((d) => d.id === outcome);
  return hit ? hit.label : outcome.replace(/_/g, ' ');
}

function focusLabel(focus: string): string {
  return (FOCUS_LABELS as Record<string, string>)[focus] || focus.replace(/_/g, ' ');
}

function emptyForm(): LeadForm {
  return {
    companyName: '',
    ownerName: '',
    ownerTitle: '',
    gatekeeperName: '',
    phone: '',
    website: '',
    industry: '',
    city: '',
    state: '',
    notes: '',
    status: 'new',
  };
}

function emptyPipeline(): PipelineSnapshot {
  return {
    enrichmentStatus: 'none',
    scrapeStatus: 'not_started',
    webScanStatus: 'not_started',
    qualifyPhase1: null,
    qualifyPhase2: null,
    qualifyPhase3: null,
    outreachReady: false,
    bookingUrlFound: null,
    reviewRating: null,
    reviewCount: null,
    attemptCount: 0,
    lastDisposition: null,
    nextCallAt: null,
  };
}

function formFromProspect(p: Record<string, unknown>): LeadForm {
  return {
    companyName: String(p.companyName || ''),
    ownerName: String(p.ownerName || ''),
    ownerTitle: String(p.ownerTitle || ''),
    gatekeeperName: String(p.gatekeeperName || ''),
    phone: String(p.phone || ''),
    website: String(p.website || ''),
    industry: String(p.industry || ''),
    city: String(p.city || ''),
    state: String(p.state || ''),
    notes: String(p.notes || ''),
    status: String(p.status || 'new'),
  };
}

function pipelineFromProspect(p: Record<string, unknown>): PipelineSnapshot {
  return {
    enrichmentStatus: String(p.enrichmentStatus || 'none'),
    scrapeStatus: String(p.scrapeStatus || 'not_started'),
    webScanStatus: String(p.webScanStatus || 'not_started'),
    qualifyPhase1: p.qualifyPhase1 == null ? null : Boolean(p.qualifyPhase1),
    qualifyPhase2: p.qualifyPhase2 == null ? null : Boolean(p.qualifyPhase2),
    qualifyPhase3: p.qualifyPhase3 == null ? null : Boolean(p.qualifyPhase3),
    outreachReady: Boolean(p.outreachReady),
    bookingUrlFound: p.bookingUrlFound ? String(p.bookingUrlFound) : null,
    reviewRating: typeof p.reviewRating === 'number' ? p.reviewRating : null,
    reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : null,
    attemptCount: typeof p.attemptCount === 'number' ? p.attemptCount : 0,
    lastDisposition: p.lastDisposition ? String(p.lastDisposition) : null,
    nextCallAt: p.nextCallAt ? String(p.nextCallAt) : null,
  };
}

function websiteHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function mapsHref(lat?: number | null, lon?: number | null, fallback?: string | null): string | null {
  if (fallback) return fallback;
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function shotFor(
  shots: { viewport: string; url: string }[] | null | undefined,
  name: string
): string | null {
  if (!shots?.length) return null;
  const hit = shots.find((s) => s.viewport.toLowerCase() === name.toLowerCase());
  return hit?.url || null;
}

function phaseLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function phaseTone(status: string): string {
  if (status === 'completed' || status === 'skipped' || status === 'done') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'in_progress' || status === 'queued' || status === 'pending') return 'mid';
  return 'muted';
}

/** Full-screen lead record: Identity / Enrichment / Site Preview / Pipeline / Calls / Audit. */
export default function LeadDetailClient({
  prospectId,
  backHref,
  backLabel = 'Back',
  initialTab = 'identity',
  brandMode = false,
  showAudit: showAuditProp = false,
}: {
  prospectId: string;
  backHref: string;
  backLabel?: string;
  initialTab?: LeadDetailTab;
  brandMode?: boolean;
  showAudit?: boolean;
}) {
  const [tab, setTab] = useState<LeadDetailTab>(
    initialTab === 'audit' && !showAuditProp ? 'identity' : initialTab
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showAudit, setShowAudit] = useState(showAuditProp);
  const [meta, setMeta] = useState<Meta>({ hooks: [], intel: null, pipeline: emptyPipeline() });
  const [saving, setSaving] = useState(false);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [previewVp, setPreviewVp] = useState<PreviewViewport>('desktop');
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const { values, update, dirty, hydrate, markSaved, reset } = useUnsavedForm<LeadForm>(emptyForm());

  const applyProspect = useCallback(
    (p: Record<string, unknown>, canEditNext: boolean, showAuditNext: boolean) => {
      hydrate(formFromProspect(p));
      setCanEdit(canEditNext);
      setShowAudit(showAuditNext);
      if (!showAuditNext && tab === 'audit') setTab('identity');
      const hooks = parseHooksPayload(p.hooksJSON as string | null);
      let intel = parseIntel(p.hooksJSON as string | null);
      if (!intel && (p.source === 'training' || String(p.source || '').startsWith('demo'))) {
        intel = synthesizeTrainingIntel(p);
      }
      setMeta({
        brandName: (p.brand as { name?: string } | null)?.name || null,
        brandSlug: (p.brand as { slug?: string } | null)?.slug || null,
        brandId: (p.brandId as string) || (p.brand as { id?: string } | null)?.id || null,
        campaignTitle: (p.campaign as { title?: string } | null)?.title || null,
        hooks,
        intel,
        pipeline: pipelineFromProspect(p),
        createdAt: (p.createdAt as string) || null,
        updatedAt: (p.updatedAt as string) || null,
        source: (p.source as string) || null,
      });
    },
    [hydrate, tab]
  );

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load lead');
      applyProspect(data.prospect, Boolean(data.canEdit), Boolean(data.showAudit));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [prospectId, applyProspect]);

  useEffect(() => {
    void loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per prospect
  }, [prospectId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const loadAudits = useCallback(async () => {
    if (!showAudit) return;
    setAuditsLoading(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/audit`);
      const data = await res.json();
      if (res.ok) setAudits(Array.isArray(data.audits) ? data.audits : []);
      else setAudits([]);
    } catch {
      setAudits([]);
    } finally {
      setAuditsLoading(false);
    }
  }, [prospectId, showAudit]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/activity`);
      const data = await res.json();
      if (res.ok) {
        setCalls(Array.isArray(data.calls) ? data.calls : []);
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
    } catch {
      setCalls([]);
      setSessions([]);
    } finally {
      setActivityLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    if (tab === 'audit' && showAudit) void loadAudits();
    if (tab === 'calls') void loadActivity();
  }, [tab, showAudit, loadAudits, loadActivity]);

  const navTabs = (
    [
      ['identity', 'Identity & Ops'],
      ['intel', 'Enrichment'],
      ['preview', 'Site Preview'],
      ['pipeline', 'Pipeline'],
      ['calls', 'Call log'],
      ...(showAudit ? ([['audit', 'Audit']] as const) : []),
    ] as const
  );

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          ownerName: values.ownerName || null,
          ownerTitle: values.ownerTitle || null,
          gatekeeperName: values.gatekeeperName || null,
          phone: values.phone || null,
          website: values.website || null,
          industry: values.industry || null,
          city: values.city || null,
          state: values.state || null,
          notes: values.notes || null,
          source: brandMode ? 'brand_lead_detail' : 'lead_detail',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      markSaved(formFromProspect(data.prospect));
      applyProspect(data.prospect, canEdit, showAudit);
      if (tab === 'audit') void loadAudits();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function runEnrich() {
    if (!canEdit) return;
    setEnrichBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      await loadLead();
      setTab('intel');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Enrich failed');
    } finally {
      setEnrichBusy(false);
    }
  }

  const previewScale = previewVp === 'desktop' ? 0.62 : previewVp === 'tablet' ? 0.55 : 0.72;

  const intel = meta.intel;
  const pipe = meta.pipeline;
  const matchState = matchStateOf({
    enrichmentStatus: pipe.enrichmentStatus,
    status: values.status,
    hooksJSON: meta.hooks.length ? JSON.stringify({ v: 2, hooks: meta.hooks, intel }) : null,
    scrapeStatus: pipe.scrapeStatus,
    webScanStatus: pipe.webScanStatus,
    qualifyPhase1: pipe.qualifyPhase1,
    qualifyPhase2: pipe.qualifyPhase2,
    qualifyPhase3: pipe.qualifyPhase3,
    outreachReady: pipe.outreachReady,
  });
  const webGrade = getGrade(intel?.webEvoScore);
  const siteUrl = websiteHref(values.website);
  const mapsUrl = mapsHref(intel?.latitude, intel?.longitude, intel?.googleMapsUrl);
  const modules = intel?.webEvoModules;
  const hasModules = Boolean(modules && WEBEVO_MODULES.some((m) => modules[m.key] != null));
  const desktopShot = shotFor(intel?.screenshots, 'desktop');
  const tabletShot = shotFor(intel?.screenshots, 'tablet');
  const mobileShot = shotFor(intel?.screenshots, 'mobile');
  const hasShots = Boolean(desktopShot || tabletShot || mobileShot);
  const previewDims = PREVIEW_DIMS[previewVp];

  if (loading) {
    return (
      <div className="lead-detail-fs lead-detail-fs--loading" role="status">
        <p className="muted">Loading lead…</p>
      </div>
    );
  }

  if (error && !values.companyName) {
    return (
      <div className="lead-detail-fs" role="dialog" aria-modal="true" aria-label="Lead">
        <div className="lead-detail-fs__error">
          <h1>Lead</h1>
          <p className="cc-desk__error">{error}</p>
          <Link href={backHref} className="btn-ghost">
            ← {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="lead-detail-fs"
      role="dialog"
      aria-modal="true"
      aria-label={values.companyName || 'Lead record'}
    >
      <div className="lead-detail">
        <nav className="lead-detail__nav" aria-label="Lead sections">
          <Link href={backHref} className="lead-detail__back">
            ← {backLabel}
          </Link>
          <div className="lead-detail__nav-items">
            {navTabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`lead-detail__nav-btn${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="lead-detail__main">
          <header className="lead-detail__head">
            <div>
              <p className="lead-detail__eyebrow">
                {meta.brandName || (brandMode ? 'Brand lead' : 'Lead')}
              </p>
              <h1 className="lead-detail__title">{values.companyName || 'Lead'}</h1>
              <p className="lead-detail__sub muted">
                {[
                  [values.city, values.state].filter(Boolean).join(', ') || null,
                  values.industry || null,
                  meta.campaignTitle ? `Campaign · ${meta.campaignTitle}` : null,
                  matchLabel(matchState),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </header>

          {error ? (
            <p className="cc-desk__error" role="alert">
              {error}
            </p>
          ) : null}

          {tab === 'identity' ? (
            <div className="lead-detail__grid-3">
              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Identity</h3>
                <div className="lead-detail__rows">
                  <RowInput
                    label="Company"
                    value={values.companyName}
                    onChange={(v) => update({ companyName: v })}
                    disabled={!canEdit}
                  />
                  <Row
                    label="Website"
                    value={
                      canEdit ? (
                        <input
                          className="field lead-detail__row-input"
                          value={values.website}
                          onChange={(e) => update({ website: e.target.value })}
                        />
                      ) : siteUrl ? (
                        <a href={siteUrl} target="_blank" rel="noreferrer">
                          {values.website.replace(/^https?:\/\//i, '')}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <RowInput
                    label="Industry"
                    value={values.industry}
                    onChange={(v) => update({ industry: v })}
                    disabled={!canEdit}
                  />
                  <RowInput
                    label="Status"
                    value={values.status}
                    onChange={(v) => update({ status: v })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Location</h3>
                <div className="lead-detail__rows">
                  <Row label="Street" value={intel?.address || '—'} />
                  <RowInput
                    label="City"
                    value={values.city}
                    onChange={(v) => update({ city: v })}
                    disabled={!canEdit}
                  />
                  <RowInput
                    label="State"
                    value={values.state}
                    onChange={(v) => update({ state: v })}
                    disabled={!canEdit}
                  />
                  <Row
                    label="Lat / Lon"
                    value={
                      intel?.latitude != null && intel?.longitude != null ? (
                        mapsUrl ? (
                          <a href={mapsUrl} target="_blank" rel="noreferrer">
                            {intel.latitude}, {intel.longitude}
                          </a>
                        ) : (
                          `${intel.latitude}, ${intel.longitude}`
                        )
                      ) : (
                        '—'
                      )
                    }
                  />
                </div>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Contact</h3>
                <div className="lead-detail__rows">
                  <RowInput
                    label="Decision maker"
                    value={values.ownerName}
                    onChange={(v) => update({ ownerName: v })}
                    disabled={!canEdit}
                  />
                  <RowInput
                    label="Title"
                    value={values.ownerTitle}
                    onChange={(v) => update({ ownerTitle: v })}
                    disabled={!canEdit}
                  />
                  <RowInput
                    label="Gatekeeper"
                    value={values.gatekeeperName}
                    onChange={(v) => update({ gatekeeperName: v })}
                    disabled={!canEdit}
                  />
                  <RowInput
                    label="Phone"
                    value={values.phone}
                    onChange={(v) => update({ phone: v })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="lead-detail__card lead-detail__card--wide">
                <h3 className="lead-detail__card-title">Google Business Profile</h3>
                <div className="lead-detail__rows lead-detail__rows--2">
                  <Row label="Category" value={intel?.googleCategory || '—'} />
                  <Row label="Google phone" value={intel?.googlePhone || values.phone || '—'} />
                  <Row label="Hours" value={intel?.openingHours || '—'} />
                  <Row
                    label="Maps"
                    value={
                      mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noreferrer">
                          Open in Google Maps
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <Row
                    label="Rating"
                    value={
                      pipe.reviewRating != null ? `${pipe.reviewRating.toFixed(1)} / 5` : '—'
                    }
                  />
                  <Row
                    label="Reviews"
                    value={pipe.reviewCount != null ? String(pipe.reviewCount) : '—'}
                  />
                </div>
              </section>

              <section className="lead-detail__card lead-detail__card--wide">
                <h3 className="lead-detail__card-title">Notes</h3>
                <textarea
                  className="field"
                  rows={3}
                  value={values.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  disabled={!canEdit}
                  placeholder={canEdit ? 'Notes…' : undefined}
                />
              </section>

              {meta.hooks.length > 0 ? (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Hooks</h3>
                  <ul className="lead-detail__hooks">
                    {meta.hooks.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === 'intel' ? (
            <div className="lead-detail__grid">
              <section className="lead-detail__card lead-detail__card--wide">
                <div className="lead-detail__card-head">
                  <h3 className="lead-detail__card-title">Enrichment</h3>
                  {canEdit ? (
                    <div className="lead-detail__card-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={enrichBusy}
                        onClick={() => void runEnrich()}
                      >
                        {enrichBusy ? 'Enriching…' : 'Re-enrich'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="lead-detail__score-row">
                  <ScoreChip
                    label="Trojan"
                    value={intel?.score != null ? Math.round(intel.score) : null}
                    tone={scoreTone(intel?.score)}
                  />
                  <ScoreChip
                    label="Health"
                    value={intel?.health != null ? Math.round(intel.health) : null}
                    tone={healthTone(intel?.health)}
                  />
                  <ScoreChip
                    label="Site"
                    value={
                      intel?.webEvoScore != null
                        ? `${webGrade.grade} ${Math.round(intel.webEvoScore)}`
                        : null
                    }
                    tone={
                      webGrade.tone === 'muted'
                        ? 'muted'
                        : webGrade.tone === 'ok'
                          ? 'ok'
                          : webGrade.tone === 'mid'
                            ? 'mid'
                            : 'bad'
                    }
                    hint={intel?.webEvoScore != null ? 'Heuristic' : undefined}
                  />
                </div>
              </section>

              {hasModules ? (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Site modules</h3>
                  <div className="lead-detail__module-grid">
                    {WEBEVO_MODULES.map(({ key, label }) => {
                      const val = modules?.[key];
                      const tone = scoreTone(val ?? null);
                      return (
                        <div
                          key={key}
                          className={`lead-detail__module lead-detail__module--${tone}`}
                        >
                          <span className="lead-detail__module-label">{label}</span>
                          <span className="lead-detail__module-value">
                            {val != null ? Math.round(val) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="lead-detail__card lead-detail__card--wide">
                <h3 className="lead-detail__card-title">Screenshots</h3>
                {hasShots ? (
                  <div className="lead-detail__shot-grid">
                    {(
                      [
                        ['Desktop', desktopShot],
                        ['Tablet', tabletShot],
                        ['Mobile', mobileShot],
                      ] as const
                    ).map(([label, url]) =>
                      url ? (
                        <button
                          key={label}
                          type="button"
                          className="lead-detail__shot"
                          onClick={() => setLightbox({ url, label })}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`${label} screenshot`} loading="lazy" />
                          <span className="lead-detail__shot-label">{label}</span>
                        </button>
                      ) : (
                        <div key={label} className="lead-detail__shot lead-detail__shot--empty">
                          <span className="lead-detail__shot-label">{label}</span>
                          <span className="muted small">No capture</span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="lead-detail__empty">
                    <p className="muted" style={{ margin: 0 }}>
                      No screenshots yet.
                    </p>
                  </div>
                )}
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Site intel</h3>
                <div className="lead-detail__rows">
                  <Row label="CMS" value={intel?.cms || '—'} />
                  <Row label="© Year" value={intel?.copyrightYear ?? '—'} />
                  <Row
                    label="HTTPS"
                    value={intel?.https == null ? '—' : intel.https ? 'Yes' : 'No'}
                  />
                  <Row
                    label="Mobile"
                    value={intel?.mobile == null ? '—' : intel.mobile ? 'Yes' : 'No'}
                  />
                  <Row label="Booking" value={intel?.bookingSystem || pipe.bookingUrlFound || '—'} />
                  <Row
                    label="Has website"
                    value={
                      intel?.hasWebsite == null
                        ? values.website
                          ? 'Yes'
                          : '—'
                        : intel.hasWebsite
                          ? 'Yes'
                          : 'No'
                    }
                  />
                </div>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Reputation</h3>
                <div className="lead-detail__rows">
                  <Row
                    label="Rating"
                    value={
                      pipe.reviewRating != null ? `${pipe.reviewRating.toFixed(1)}★` : '—'
                    }
                  />
                  <Row label="Reviews" value={pipe.reviewCount != null ? pipe.reviewCount : '—'} />
                  <Row label="Last review" value={formatRelativeReview(intel?.lastReviewAt) || '—'} />
                </div>
              </section>

              {intel?.signals && intel.signals.length > 0 ? (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Signals</h3>
                  <div className="lead-detail__signals">
                    {intel.signals.map((s) => (
                      <span
                        key={s}
                        className={`lead-detail__signal lead-detail__signal--${signalTone(s)}`}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {meta.hooks.length > 0 ? (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Talking points</h3>
                  <ul className="lead-detail__hooks">
                    {meta.hooks.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Talking points</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    No enrichment hooks yet.
                    {canEdit ? ' Run Re-enrich to pull site intel and talking points.' : ''}
                  </p>
                </section>
              )}
            </div>
          ) : null}

          {tab === 'preview' ? (
            <div className="lead-detail__preview">
              {!siteUrl ? (
                <section className="lead-detail__card lead-detail__card--wide">
                  <h3 className="lead-detail__card-title">Site Preview</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    No website on this lead. Add a URL in Identity & Ops to preview the site.
                  </p>
                </section>
              ) : (
                <>
                  <div className="lead-detail__preview-toolbar">
                    <div className="lead-detail__preview-vps" role="group" aria-label="Viewport">
                      {(['desktop', 'tablet', 'mobile'] as const).map((vp) => (
                        <button
                          key={vp}
                          type="button"
                          className={`lead-detail__preview-vp${previewVp === vp ? ' is-active' : ''}`}
                          onClick={() => setPreviewVp(vp)}
                        >
                          {vp.charAt(0).toUpperCase() + vp.slice(1)}
                        </button>
                      ))}
                    </div>
                    <span className="lead-detail__preview-dims muted">{previewDims.label}</span>
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="lead-detail__preview-open"
                    >
                      Open site
                    </a>
                  </div>
                  <div className="lead-detail__preview-stage">
                    <div
                      className="lead-detail__preview-scaler"
                      style={{
                        width: previewDims.w * previewScale,
                        height: previewDims.h * previewScale,
                      }}
                    >
                      <iframe
                        title={`${values.companyName || 'Lead'} site preview`}
                        src={siteUrl}
                        className="lead-detail__preview-frame"
                        style={{
                          width: previewDims.w,
                          height: previewDims.h,
                          transform: `scale(${previewScale})`,
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === 'pipeline' ? (
            <div className="lead-detail__grid">
              <section className="lead-detail__card lead-detail__card--wide">
                <h3 className="lead-detail__card-title">Match state</h3>
                <p className="lead-detail__pipeline-match">
                  <span className={`brand-leads__match-chip brand-leads__match-chip--${matchState}`}>
                    {matchLabel(matchState)}
                  </span>
                  <span className="muted small">
                    {pipe.outreachReady ? 'Dial-ready' : 'Not dial-ready yet'}
                  </span>
                </p>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Phases</h3>
                <dl className="lead-detail__kv">
                  <div>
                    <dt>P1 Scrape</dt>
                    <dd>
                      <span
                        className={`lead-detail__phase lead-detail__phase--${phaseTone(pipe.scrapeStatus)}`}
                      >
                        {phaseLabel(pipe.scrapeStatus)}
                      </span>
                      {pipe.qualifyPhase1 != null ? (
                        <span className="muted small">
                          {' '}
                          · QC {pipe.qualifyPhase1 ? 'pass' : 'fail'}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>P2 Webscan</dt>
                    <dd>
                      <span
                        className={`lead-detail__phase lead-detail__phase--${phaseTone(pipe.webScanStatus)}`}
                      >
                        {phaseLabel(pipe.webScanStatus)}
                      </span>
                      {pipe.qualifyPhase2 != null ? (
                        <span className="muted small">
                          {' '}
                          · QC {pipe.qualifyPhase2 ? 'pass' : 'fail'}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>P3 Enrich</dt>
                    <dd>
                      <span
                        className={`lead-detail__phase lead-detail__phase--${phaseTone(
                          pipe.enrichmentStatus === 'done'
                            ? 'completed'
                            : pipe.enrichmentStatus === 'pending'
                              ? 'in_progress'
                              : pipe.enrichmentStatus
                        )}`}
                      >
                        {phaseLabel(pipe.enrichmentStatus)}
                      </span>
                      {pipe.qualifyPhase3 != null ? (
                        <span className="muted small">
                          {' '}
                          · QC {pipe.qualifyPhase3 ? 'pass' : 'fail'}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Dial ops</h3>
                <dl className="lead-detail__kv">
                  <div>
                    <dt>Attempts</dt>
                    <dd>{pipe.attemptCount}</dd>
                  </div>
                  <div>
                    <dt>Last disposition</dt>
                    <dd>{dispositionLabel(pipe.lastDisposition)}</dd>
                  </div>
                  <div>
                    <dt>Next call</dt>
                    <dd>
                      {pipe.nextCallAt ? new Date(pipe.nextCallAt).toLocaleString() : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Prospect booking URL</dt>
                    <dd>
                      {pipe.bookingUrlFound ? (
                        <a href={pipe.bookingUrlFound} target="_blank" rel="noreferrer">
                          {pipe.bookingUrlFound.replace(/^https?:\/\//, '').slice(0, 40)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : null}

          {tab === 'calls' ? (
            <div className="lead-detail__activity">
              {activityLoading ? (
                <p className="muted">Loading calls…</p>
              ) : (
                (() => {
                  const feed = [
                    ...calls.map((c) => ({
                      sortAt: c.createdAt,
                      node: (
                        <article key={`live-${c.id}`} className="lead-detail__call-card">
                          <div className="lead-detail__call-card-top">
                            <span className="lead-detail__call-kind lead-detail__call-kind--live">
                              Live {c.direction}
                            </span>
                            <time dateTime={c.createdAt}>
                              {new Date(c.createdAt).toLocaleString()}
                            </time>
                          </div>
                          <dl className="lead-detail__call-stats">
                            <div>
                              <dt>Disposition</dt>
                              <dd>
                                <span
                                  className={`lead-detail__dispos${c.outcome ? ' is-set' : ''}`}
                                  data-outcome={c.outcome || undefined}
                                >
                                  {dispositionLabel(c.outcome)}
                                </span>
                              </dd>
                            </div>
                            <div>
                              <dt>Duration</dt>
                              <dd>{formatDuration(c.duration || 0)}</dd>
                            </div>
                            <div>
                              <dt>Status</dt>
                              <dd>{c.status.replace(/_/g, ' ')}</dd>
                            </div>
                            {showAudit ? (
                              <div>
                                <dt>Rep</dt>
                                <dd>{c.repName}</dd>
                              </div>
                            ) : null}
                            {c.toNumber ? (
                              <div>
                                <dt>To</dt>
                                <dd>{c.toNumber}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {c.notes ? (
                            <p className="lead-detail__list-notes">{c.notes}</p>
                          ) : null}
                        </article>
                      ),
                    })),
                    ...sessions.map((s) => ({
                      sortAt: s.createdAt,
                      node: (
                        <article key={`practice-${s.id}`} className="lead-detail__call-card">
                          <div className="lead-detail__call-card-top">
                            <span className="lead-detail__call-kind lead-detail__call-kind--practice">
                              Practice
                            </span>
                            <time dateTime={s.createdAt}>
                              {new Date(s.createdAt).toLocaleString()}
                            </time>
                          </div>
                          <dl className="lead-detail__call-stats">
                            <div>
                              <dt>Score</dt>
                              <dd>
                                <Link
                                  href={`/sessions/${s.id}`}
                                  style={{
                                    color: scoreColor(s.overallScore),
                                    fontWeight: 750,
                                    textDecoration: 'none',
                                  }}
                                >
                                  {s.overallScore}/100
                                </Link>
                                {s.pointsEarned != null && s.pointsEarned > 0
                                  ? ` · +${s.pointsEarned} pts`
                                  : ''}
                              </dd>
                            </div>
                            <div>
                              <dt>Disposition</dt>
                              <dd>
                                <span
                                  className={`lead-detail__dispos${s.outcome ? ' is-set' : ''}`}
                                  data-outcome={s.outcome || undefined}
                                >
                                  {dispositionLabel(s.outcome)}
                                </span>
                              </dd>
                            </div>
                            <div>
                              <dt>Duration</dt>
                              <dd>{formatDuration(s.duration)}</dd>
                            </div>
                            <div>
                              <dt>Scenario</dt>
                              <dd>{focusLabel(s.focusArea)}</dd>
                            </div>
                            <div>
                              <dt>Difficulty</dt>
                              <dd>{s.difficulty}</dd>
                            </div>
                            {showAudit ? (
                              <div>
                                <dt>Rep</dt>
                                <dd>{s.repName}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {s.notes ? (
                            <p className="lead-detail__list-notes">{s.notes}</p>
                          ) : null}
                          <div className="lead-detail__call-card-actions">
                            <Link href={`/sessions/${s.id}`} className="btn-ghost">
                              Open session →
                            </Link>
                          </div>
                        </article>
                      ),
                    })),
                  ].sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));

                  return (
                    <section className="lead-detail__card lead-detail__card--wide">
                      <h3 className="lead-detail__card-title">Call log</h3>
                      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.78rem' }}>
                        {showAudit
                          ? 'Live dials and practice sessions for every rep on this lead.'
                          : 'Your live dials and practice sessions on this lead.'}
                      </p>
                      {feed.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>
                          No calls logged yet.
                        </p>
                      ) : (
                        <div className="lead-detail__call-feed">{feed.map((f) => f.node)}</div>
                      )}
                    </section>
                  );
                })()
              )}
            </div>
          ) : null}

          {tab === 'audit' && showAudit ? (
            <section className="lead-detail__card lead-detail__card--wide">
              <h3 className="lead-detail__card-title">Change history</h3>
              <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
                Brand-only — every field edit with who made the change.
              </p>
              {auditsLoading ? (
                <p className="muted">Loading…</p>
              ) : audits.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No changes logged yet.
                </p>
              ) : (
                <ul className="lead-detail__audit-list">
                  {audits.map((a) => {
                    const changes = a.meta?.changes || {};
                    const keys = Object.keys(changes);
                    return (
                      <li key={a.id}>
                        <div className="lead-detail__audit-head">
                          <strong>{a.action.replace(/_/g, ' ')}</strong>
                          <span className="muted">
                            {a.actorName}
                            {a.actorEmail ? ` · ${a.actorEmail}` : ''} ·{' '}
                            {new Date(a.createdAt).toLocaleString()}
                            {a.meta?.source ? ` · ${a.meta.source}` : ''}
                          </span>
                        </div>
                        {keys.length > 0 ? (
                          <ul className="lead-detail__audit-changes">
                            {keys.map((k) => (
                              <li key={k}>
                                <em>{k}</em>:{' '}
                                <span className="muted">{fmt(changes[k]?.from)}</span>
                                {' → '}
                                <span>{fmt(changes[k]?.to)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        <aside className="lead-detail__rail" aria-label="Lead summary">
          <div className="lead-detail__rail-card">
            <h3>{values.companyName}</h3>
            <div className="lead-detail__rail-scores">
              <div className={`lead-detail__rail-score lead-detail__rail-score--${scoreTone(intel?.score)}`}>
                <span>Trojan</span>
                <strong>{intel?.score != null ? Math.round(intel.score) : '—'}</strong>
              </div>
              <div
                className={`lead-detail__rail-score lead-detail__rail-score--${healthTone(intel?.health)}`}
              >
                <span>Health</span>
                <strong>{intel?.health != null ? Math.round(intel.health) : '—'}</strong>
              </div>
              <div
                className={`lead-detail__rail-score lead-detail__rail-score--${
                  webGrade.tone === 'warn' ? 'bad' : webGrade.tone
                }`}
              >
                <span>Site</span>
                <strong>
                  {intel?.webEvoScore != null
                    ? `${webGrade.grade} ${Math.round(intel.webEvoScore)}`
                    : '—'}
                </strong>
              </div>
            </div>
            <dl>
              <div>
                <dt>Contact</dt>
                <dd>
                  {values.ownerName || '—'}
                  {values.ownerTitle ? ` · ${values.ownerTitle}` : ''}
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{values.phone || '—'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{[values.city, values.state].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              {mapsUrl ? (
                <div>
                  <dt>Maps</dt>
                  <dd>
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      {intel?.latitude != null && intel?.longitude != null
                        ? `${intel.latitude}, ${intel.longitude}`
                        : 'Open map'}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Match</dt>
                <dd>
                  <span className={`brand-leads__match-chip brand-leads__match-chip--${matchState}`}>
                    {matchLabel(matchState)}
                  </span>
                </dd>
              </div>
              {meta.source ? (
                <div>
                  <dt>Source</dt>
                  <dd>{meta.source}</dd>
                </div>
              ) : null}
              {meta.updatedAt ? (
                <div>
                  <dt>Modified</dt>
                  <dd>{new Date(meta.updatedAt).toLocaleDateString()}</dd>
                </div>
              ) : null}
            </dl>
            {!canEdit ? (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.65rem' }}>
                View only
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {lightbox ? (
        <div
          className="lead-detail__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightbox.label} screenshot`}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="lead-detail__lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={`${lightbox.label} screenshot`}
            className="lead-detail__lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {canEdit ? (
        <UnsavedChangesBar
          dirty={dirty}
          saving={saving}
          onReset={reset}
          onSave={() => void save()}
        />
      ) : null}
    </div>
  );
}

function ScoreChip({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number | null;
  tone: string;
  hint?: string;
}) {
  return (
    <div className={`lead-detail__score-chip lead-detail__score-chip--${tone}`}>
      <span className="lead-detail__score-chip-label">{label}</span>
      <span className="lead-detail__score-chip-value">{value ?? '—'}</span>
      {hint ? <span className="lead-detail__score-chip-hint">{hint}</span> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="lead-detail__row">
      <span className="lead-detail__row-label">{label}</span>
      <div className="lead-detail__row-value">{value}</div>
    </div>
  );
}

function RowInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="lead-detail__row">
      <span className="lead-detail__row-label">{label}</span>
      <input
        className="field lead-detail__row-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        readOnly={disabled}
      />
    </label>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}
