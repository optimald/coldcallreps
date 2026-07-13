'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { DEMO_MSG, getDemoApplications } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState } from '@/components/ui/PagePrimitives';
import Modal from '@/components/ui/Modal';
import {
  defaultAcceptMessage,
  defaultRejectMessage,
} from '@/lib/notifications/defaults';

export type FeaturedCall = {
  id: string;
  title: string | null;
  href: string;
  mediaSrc: string | null;
  durationSec: number | null;
  overallScore: number | null;
  focusArea: string | null;
};

export type ApplicationRow = {
  id: string;
  status: string;
  campaignId: string;
  campaignTitle: string;
  displayName: string;
  profileSlug: string | null;
  createdAt: string;
  message?: string | null;
  applicant?: {
    id: string;
    displayName: string;
    profileSlug: string | null;
    verified?: boolean;
    headline?: string | null;
    bio?: string | null;
    skills?: string[];
    totalPoints?: number;
    streak?: number;
    bestScore?: number;
    avgScore?: number;
    sessionCount?: number;
    connectReady?: boolean;
    certifications?: { label: string; score: number }[];
    featuredCalls?: FeaturedCall[];
  };
};

type DecisionKind = 'ACTIVE' | 'REJECTED';

function statusClass(status: string) {
  switch (status) {
    case 'APPLIED':
      return 'sdr-app-row__chip sdr-app-row__chip--applied';
    case 'ACTIVE':
    case 'ACCEPTED':
      return 'sdr-app-row__chip sdr-app-row__chip--active';
    case 'REJECTED':
      return 'sdr-app-row__chip sdr-app-row__chip--rejected';
    default:
      return 'sdr-app-row__chip';
  }
}

function vitalsLine(a: ApplicationRow) {
  const app = a.applicant;
  if (!app) return null;
  const parts: string[] = [];
  if (app.bestScore) parts.push(`Best ${app.bestScore}`);
  if (app.avgScore) parts.push(`Avg ${app.avgScore}`);
  if (app.totalPoints != null) parts.push(`${app.totalPoints} pts`);
  if (app.streak) parts.push(`${app.streak}d streak`);
  if (app.verified) parts.push('Verified');
  return parts.length ? parts.join(' · ') : null;
}

function demoToRows(brandKey: string): ApplicationRow[] {
  return getDemoApplications(brandKey).map((a) => ({
    ...a,
    applicant: {
      id: a.id,
      displayName: a.displayName,
      profileSlug: a.profileSlug,
      verified: a.status === 'ACTIVE',
      headline: 'Outbound SDR · high-ticket verticals',
      bio: 'Books discovery calls for founder-led sales teams. Strong opener and objection handling.',
      skills: ['Discovery', 'Objection handling', 'Multi-thread'],
      totalPoints: 420 + (a.displayName.length % 80),
      streak: 4,
      bestScore: 88,
      avgScore: 81,
      sessionCount: 14,
      connectReady: true,
      certifications: [{ label: 'Brand certified', score: 86 }],
      featuredCalls: [
        {
          id: 'demo-clip-1',
          title: 'Retail opener · gatekeeper',
          href: '#',
          mediaSrc: null,
          durationSec: 42,
          overallScore: 87,
          focusArea: 'opener',
        },
      ],
    },
  }));
}

export default function BrandSdrApplicationsClient({
  brandKey,
  brandName,
  initial,
  campaignId,
}: {
  brandKey: string;
  brandName: string;
  initial: ApplicationRow[];
  /** Optional campaign filter (account Recruit view). */
  campaignId?: string;
}) {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = hydrated && mode === 'demo';
  const [rows, setRows] = useState<ApplicationRow[]>(initial);
  const [defaults, setDefaults] = useState({
    acceptMessage: defaultAcceptMessage({ brandName, campaignTitle: '{{campaign}}' }),
    rejectMessage: defaultRejectMessage({ brandName, campaignTitle: '{{campaign}}' }),
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemo && initial.length === 0);

  const [resumeRow, setResumeRow] = useState<ApplicationRow | null>(null);
  const [decision, setDecision] = useState<{
    row: ApplicationRow;
    kind: DecisionKind;
  } | null>(null);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const load = useCallback(async () => {
    if (isDemo) {
      setRows(demoToRows(brandKey));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/applications`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (data.defaults) setDefaults(data.defaults);
      setRows(
        (data.applications || [])
          .map(
            (a: {
              id: string;
              status: string;
              campaignId: string;
              campaignTitle: string;
              createdAt: string;
              message?: string | null;
              applicant: ApplicationRow['applicant'];
            }) => ({
              id: a.id,
              status: a.status,
              campaignId: a.campaignId,
              campaignTitle: a.campaignTitle,
              displayName: a.applicant?.displayName || 'Rep',
              profileSlug: a.applicant?.profileSlug || null,
              createdAt: a.createdAt,
              message: a.message,
              applicant: a.applicant,
            })
          )
          .filter((a: ApplicationRow) => !campaignId || a.campaignId === campaignId)
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [brandKey, isDemo, campaignId]);

  useEffect(() => {
    if (!hydrated) return;
    if (isDemo) {
      setRows(demoToRows(brandKey));
      setLoading(false);
      return;
    }
    void load();
  }, [hydrated, isDemo, load, brandKey]);

  function openDecision(row: ApplicationRow, kind: DecisionKind) {
    const template =
      kind === 'ACTIVE'
        ? (defaults.acceptMessage || '').replace(/\{\{campaign\}\}/g, row.campaignTitle)
        : (defaults.rejectMessage || '').replace(/\{\{campaign\}\}/g, row.campaignTitle);
    setDecision({ row, kind });
    setDecisionMessage(template);
    setSaveAsDefault(false);
  }

  async function confirmDecision() {
    if (!decision) return;
    if (isDemo) {
      setMsg(DEMO_MSG);
      setDecision(null);
      return;
    }
    const { row, kind } = decision;
    setBusyId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${row.campaignId}/applications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: row.id,
          status: kind,
          message: decisionMessage,
          sendEmail: true,
          saveAsDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      const nextStatus = data.application?.status || kind;
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r))
      );
      setMsg(data.notice || `Marked ${nextStatus}`);
      setDecision(null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  const displayRows = useMemo(
    () => (isDemo ? demoToRows(brandKey) : rows),
    [isDemo, rows, brandKey]
  );

  if (!hydrated || loading) {
    return <p className="muted">Loading applications…</p>;
  }

  if (displayRows.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Post an OPEN campaign so SDRs can apply from Brand deals."
        action={
          <Link href={brandHref(brandKey, 'campaigns')} className="btn" style={{ marginTop: '1rem' }}>
            Post a campaign
          </Link>
        }
      />
    );
  }

  return (
    <div className="stack">
      {msg ? (
        <p className="muted" role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}

      <ul className="sdr-app-rows">
        {displayRows.map((a) => {
          const pending = a.status === 'APPLIED';
          const vitals = vitalsLine(a);
          return (
            <li key={a.id} className="sdr-app-row">
              <button
                type="button"
                className="sdr-app-row__main"
                onClick={() => setResumeRow(a)}
              >
                <div className="sdr-app-row__identity">
                  <div className="sdr-app-row__title-line">
                    <span className="sdr-app-row__name">{a.displayName}</span>
                    <span className={statusClass(a.status)}>{a.status}</span>
                  </div>
                  <p className="sdr-app-row__meta">
                    {a.campaignTitle}
                    {' · '}
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                  {vitals ? <p className="sdr-app-row__vitals">{vitals}</p> : null}
                </div>
              </button>
              <div className="sdr-app-row__actions">
                {pending ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === a.id}
                      onClick={() => openDecision(a, 'ACTIVE')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId === a.id}
                      onClick={() => openDecision(a, 'REJECTED')}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {a.status === 'ACCEPTED' ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === a.id}
                    onClick={() => openDecision(a, 'ACTIVE')}
                  >
                    Activate
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setResumeRow(a)}
                >
                  Resume
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={Boolean(resumeRow)}
        onClose={() => setResumeRow(null)}
        wide
        title={resumeRow?.displayName || 'SDR resume'}
        description={
          resumeRow
            ? `${resumeRow.campaignTitle} · ${resumeRow.status}`
            : undefined
        }
      >
        {resumeRow ? (
          <div className="stack" style={{ gap: '1rem' }}>
            {resumeRow.applicant?.headline ? (
              <p style={{ margin: 0, fontWeight: 600 }}>{resumeRow.applicant.headline}</p>
            ) : null}
            {resumeRow.applicant?.bio ? (
              <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {resumeRow.applicant.bio}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No resume bio yet — stats and featured calls still help you decide.
              </p>
            )}

            <dl className="brand-campaign__meta">
              <div>
                <dt>Best score</dt>
                <dd>{resumeRow.applicant?.bestScore || '—'}</dd>
              </div>
              <div>
                <dt>Avg score</dt>
                <dd>{resumeRow.applicant?.avgScore || '—'}</dd>
              </div>
              <div>
                <dt>Points</dt>
                <dd>{resumeRow.applicant?.totalPoints ?? '—'}</dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{resumeRow.applicant?.streak ?? '—'}</dd>
              </div>
              <div>
                <dt>Sessions</dt>
                <dd>{resumeRow.applicant?.sessionCount ?? '—'}</dd>
              </div>
              <div>
                <dt>Connect</dt>
                <dd>{resumeRow.applicant?.connectReady ? 'Ready' : 'Incomplete'}</dd>
              </div>
            </dl>

            {resumeRow.applicant?.skills?.length ? (
              <div>
                <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.4rem' }}>Skills</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {resumeRow.applicant.skills.join(' · ')}
                </p>
              </div>
            ) : null}

            {resumeRow.message ? (
              <div>
                <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.4rem' }}>Apply note</h3>
                <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {resumeRow.message}
                </p>
              </div>
            ) : null}

            <div>
              <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.55rem' }}>
                Calls on their resume
              </h3>
              {(resumeRow.applicant?.featuredCalls || []).length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No featured calls yet.
                </p>
              ) : (
                <div className="stack" style={{ gap: '0.75rem' }}>
                  {resumeRow.applicant!.featuredCalls!.map((call) => (
                    <article key={call.id} className="sdr-app-clip">
                      <div className="sdr-app-clip__head">
                        <strong>{call.title || 'Featured call'}</strong>
                        <span className="muted">
                          {call.overallScore != null ? `Score ${call.overallScore}` : ''}
                          {call.focusArea ? ` · ${call.focusArea}` : ''}
                          {call.durationSec != null ? ` · ${call.durationSec}s` : ''}
                        </span>
                      </div>
                      {call.mediaSrc ? (
                        <audio controls preload="metadata" src={call.mediaSrc} style={{ width: '100%' }}>
                          Your browser does not support audio.
                        </audio>
                      ) : isDemo ? (
                        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                          Demo — audio unavailable offline
                        </p>
                      ) : null}
                      {call.href && call.href !== '#' ? (
                        <Link href={call.href} className="soft-link" target="_blank">
                          Open highlight →
                        </Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {resumeRow.profileSlug ? (
                <Link href={`/${resumeRow.profileSlug}`} className="btn-ghost" target="_blank">
                  Full public profile →
                </Link>
              ) : null}
              {resumeRow.status === 'APPLIED' ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setResumeRow(null);
                      openDecision(resumeRow, 'ACTIVE');
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setResumeRow(null);
                      openDecision(resumeRow, 'REJECTED');
                    }}
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.kind === 'ACTIVE' ? 'Accept applicant' : 'Reject applicant'}
        description={
          decision
            ? `${decision.row.displayName} · ${decision.row.campaignTitle}. Message is emailed to the SDR.`
            : undefined
        }
      >
        {decision ? (
          <div className="stack" style={{ gap: '0.75rem' }}>
            <label className="field-label">
              Message to SDR
              <textarea
                className="field"
                rows={6}
                value={decisionMessage}
                onChange={(e) => setDecisionMessage(e.target.value)}
              />
            </label>
            <label
              className="muted"
              style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.85rem' }}
            >
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
              />
              Save as default {decision.kind === 'ACTIVE' ? 'accept' : 'reject'} message for this brand
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setDecision(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={busyId === decision.row.id || !decisionMessage.trim()}
                onClick={() => void confirmDecision()}
              >
                {busyId === decision.row.id
                  ? 'Sending…'
                  : decision.kind === 'ACTIVE'
                    ? 'Accept & email'
                    : 'Reject & email'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
