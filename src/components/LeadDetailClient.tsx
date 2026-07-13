'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';
import { CALL_DISPOSITIONS } from '@/components/FloatingCallWidget';
import { FOCUS_LABELS } from '@/lib/product';
import { parseHooks as parseHooksPayload } from '@/lib/prospect-intel';
import { formatDuration, scoreColor } from '@/lib/trainer/session-utils';

export type LeadDetailTab = 'identity' | 'calls' | 'audit';

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

function dispositionLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—';
  const hit = CALL_DISPOSITIONS.find((d) => d.id === outcome);
  return hit ? hit.label : outcome.replace(/_/g, ' ');
}

function focusLabel(focus: string): string {
  return (FOCUS_LABELS as Record<string, string>)[focus] || focus.replace(/_/g, ' ');
}

type Meta = {
  brandName?: string | null;
  brandSlug?: string | null;
  brandId?: string | null;
  campaignTitle?: string | null;
  hooks: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
};

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

/** Full-screen lead record: Identity / Calls / (brand-only) Audit + unsaved bar. */
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
  /** Brand managers / superadmin only — Audit tab. */
  showAudit?: boolean;
}) {
  const [tab, setTab] = useState<LeadDetailTab>(
    initialTab === 'audit' && !showAuditProp ? 'identity' : initialTab
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showAudit, setShowAudit] = useState(showAuditProp);
  const [meta, setMeta] = useState<Meta>({ hooks: [] });
  const [saving, setSaving] = useState(false);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const { values, update, dirty, hydrate, markSaved, reset } = useUnsavedForm<LeadForm>(emptyForm());

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${prospectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load lead');
      const p = data.prospect;
      hydrate(formFromProspect(p));
      setCanEdit(Boolean(data.canEdit));
      const auditOk = Boolean(data.showAudit);
      setShowAudit(auditOk);
      if (!auditOk && tab === 'audit') setTab('identity');
      setMeta({
        brandName: p.brand?.name || null,
        brandSlug: p.brand?.slug || null,
        brandId: p.brandId || p.brand?.id || null,
        campaignTitle: p.campaign?.title || null,
        hooks: parseHooksPayload(p.hooksJSON).slice(0, 8),
        createdAt: p.createdAt || null,
        updatedAt: p.updatedAt || null,
        source: p.source || null,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [prospectId, hydrate, tab]);

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
      if (tab === 'audit') void loadAudits();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

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
            <div className="lead-detail__grid">
              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Identity</h3>
                <div className="lead-detail__fields">
                  <Field
                    label="Company"
                    value={values.companyName}
                    onChange={(v) => update({ companyName: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Industry"
                    value={values.industry}
                    onChange={(v) => update({ industry: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Status"
                    value={values.status}
                    onChange={(v) => update({ status: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Website"
                    value={values.website}
                    onChange={(v) => update({ website: v })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Location</h3>
                <div className="lead-detail__fields">
                  <Field
                    label="City"
                    value={values.city}
                    onChange={(v) => update({ city: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="State"
                    value={values.state}
                    onChange={(v) => update({ state: v })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="lead-detail__card">
                <h3 className="lead-detail__card-title">Contact</h3>
                <div className="lead-detail__fields">
                  <Field
                    label="Decision maker"
                    value={values.ownerName}
                    onChange={(v) => update({ ownerName: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Title"
                    value={values.ownerTitle}
                    onChange={(v) => update({ ownerTitle: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Gatekeeper"
                    value={values.gatekeeperName}
                    onChange={(v) => update({ gatekeeperName: v })}
                    disabled={!canEdit}
                  />
                  <Field
                    label="Phone"
                    value={values.phone}
                    onChange={(v) => update({ phone: v })}
                    disabled={!canEdit}
                  />
                </div>
              </section>

              <section className="lead-detail__card lead-detail__card--wide">
                <h3 className="lead-detail__card-title">Notes</h3>
                <textarea
                  className="field"
                  rows={5}
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

function Field({
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
    <label className="lead-detail__field">
      <span>{label}</span>
      <input
        className="field"
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
