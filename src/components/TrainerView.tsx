'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useXaiTrainerRealtime } from '@/hooks/useXaiTrainerRealtime';
import { useLiveCoach } from '@/hooks/useLiveCoach';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import { formatDuration, scoreColor } from '@/lib/trainer/session-utils';
import Toggle from '@/components/ui/Toggle';
import { PageHeader } from '@/components/ui/PagePrimitives';
import CheatSheetPanel, { type CheatSheetSection } from '@/components/CheatSheetPanel';

type Difficulty = 'easy' | 'medium' | 'hard';
type LeadTab = 'training' | 'brand';

interface ProspectRow {
  id: string;
  companyName: string;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  industry?: string | null;
  imageUrl?: string | null;
  ownerName?: string | null;
  ownerTitle?: string | null;
  phone?: string | null;
  status?: string | null;
  hooksJSON?: string | null;
  notes?: string | null;
  brandName?: string | null;
  brandSlug?: string | null;
  brandId?: string | null;
  purpose?: 'training' | 'brand';
}

interface Scorecard {
  overallScore: number;
  scores: Record<string, number>;
  feedback: { strengths: string[]; improvements: string[] };
  summary: string;
}

const FOCUS_OPTIONS = Object.entries(FOCUS_LABELS) as [FocusArea, string][];

function parseHooks(hooksJSON?: string | null): string[] {
  if (!hooksJSON) return [];
  try {
    const parsed = JSON.parse(hooksJSON);
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function mapLead(raw: Record<string, unknown>, purpose: 'training' | 'brand'): ProspectRow {
  const brand = raw.brand as { name?: string; slug?: string } | null | undefined;
  return {
    id: String(raw.id),
    companyName: String(raw.companyName || 'Unknown'),
    city: (raw.city as string | null) ?? null,
    state: (raw.state as string | null) ?? null,
    website: (raw.website as string | null) ?? null,
    industry: (raw.industry as string | null) ?? null,
    imageUrl: (raw.imageUrl as string | null) ?? null,
    ownerName: (raw.ownerName as string | null) ?? null,
    ownerTitle: (raw.ownerTitle as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    status: (raw.status as string | null) ?? null,
    hooksJSON: (raw.hooksJSON as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    brandId: (raw.brandId as string | null) ?? null,
    brandName: brand?.name ?? (raw.brandName as string | null) ?? null,
    brandSlug: brand?.slug ?? (raw.brandSlug as string | null) ?? null,
    purpose,
  };
}

export default function TrainerView() {
  const searchParams = useSearchParams();
  const [focus, setFocus] = useState<FocusArea>('budget_500');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [hintMode, setHintMode] = useState(true);
  const [coachOn, setCoachOn] = useState(true);
  const [trainingLeads, setTrainingLeads] = useState<ProspectRow[]>([]);
  const [brandLeads, setBrandLeads] = useState<ProspectRow[]>([]);
  const [leadTab, setLeadTab] = useState<LeadTab>('training');
  const [prospectId, setProspectId] = useState<string>('');
  const [brandPacks, setBrandPacks] = useState<
    {
      brandId: string;
      brandName: string;
      packId: string;
      packName: string;
      playbookId?: string;
      playbookTitle?: string;
    }[]
  >([]);
  const [packKey, setPackKey] = useState('');
  const [playbooks, setPlaybooks] = useState<
    { id: string; title: string; brandId?: string | null; brandName?: string | null }[]
  >([]);
  const [playbookId, setPlaybookId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canStoreRecordings, setCanStoreRecordings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [earnedBadge, setEarnedBadge] = useState<string | null>(null);
  const [earnedCert, setEarnedCert] = useState<string | null>(null);
  const [bountiesCleared, setBountiesCleared] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gateHoldId, setGateHoldId] = useState<string | null>(null);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [scriptSections, setScriptSections] = useState<CheatSheetSection[]>([]);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('Ready');
  const [coachLog, setCoachLog] = useState<
    { atSeconds: number; prospectText: string; suggestion: string }[]
  >([]);

  const onError = useCallback((message: string) => setError(message), []);

  const realtime = useXaiTrainerRealtime({
    onError,
    onCallEnded: () => setPhaseLabel('Ended'),
  });

  useEffect(() => {
    if (!realtime.isConnected) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [realtime.isConnected]);

  const durationSecs = callStartedAt ? Math.floor((nowTick - callStartedAt) / 1000) : 0;

  const queue = leadTab === 'brand' ? brandLeads : trainingLeads;
  const hasBrandLeads = brandLeads.length > 0;

  const selected = useMemo(() => {
    const all = [...trainingLeads, ...brandLeads];
    return all.find((p) => p.id === prospectId) ?? queue[0] ?? null;
  }, [trainingLeads, brandLeads, prospectId, queue]);

  const coach = useLiveCoach({
    enabled: coachOn,
    active: realtime.isConnected,
    transcript: realtime.transcript,
    phase: realtime.phase,
    gatekeeperName: realtime.gatekeeperName,
    decisionMakerName: realtime.decisionMakerName,
    companyName: selected?.companyName || 'the business',
    difficulty,
    isProspectSpeaking: realtime.isProspectSpeaking,
    isUserSpeaking: realtime.isUserSpeaking,
    callTimer: durationSecs,
    playbookId: playbookId || undefined,
    onSuggestion: (entry) => {
      setCoachLog((prev) => [
        ...prev,
        {
          atSeconds: entry.atSeconds,
          prospectText: entry.prospectText,
          suggestion: entry.suggestion,
        },
      ]);
    },
  });

  const loadLeads = useCallback(async () => {
    const [trainingRes, brandRes] = await Promise.all([
      fetch('/api/prospects?training=1&limit=80'),
      fetch('/api/prospects?dialable=1&limit=80'),
    ]);

    if (trainingRes.ok) {
      const data = await trainingRes.json();
      setTrainingLeads(
        (data.prospects || []).map((p: Record<string, unknown>) => mapLead(p, 'training'))
      );
    } else {
      const legacy = await fetch('/api/prospects/search');
      if (legacy.ok) {
        const data = await legacy.json();
        setTrainingLeads(
          (data.prospects || []).map((p: Record<string, unknown>) => mapLead(p, 'training'))
        );
      }
    }

    if (brandRes.ok) {
      const data = await brandRes.json();
      const rows = (data.prospects || []).map((p: Record<string, unknown>) => mapLead(p, 'brand'));
      setBrandLeads(rows);
      if (rows.length > 0 && searchParams.get('tab') === 'brand') {
        setLeadTab('brand');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const fromUrl = searchParams.get('prospectId');
    if (fromUrl) {
      setProspectId(fromUrl);
      if (brandLeads.some((p) => p.id === fromUrl)) setLeadTab('brand');
      else if (trainingLeads.some((p) => p.id === fromUrl)) setLeadTab('training');
      return;
    }
    if (!prospectId && queue[0]?.id) setProspectId(queue[0].id);
  }, [searchParams, queue, prospectId, brandLeads, trainingLeads]);

  useEffect(() => {
    if (prospectId && queue.some((p) => p.id === prospectId)) return;
    if (queue[0]?.id) setProspectId(queue[0].id);
  }, [leadTab, queue, prospectId]);

  useEffect(() => {
    const focusParam = searchParams.get('focus');
    if (focusParam && focusParam in FOCUS_LABELS) {
      setFocus(focusParam as FocusArea);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/brands?practice=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: {
          brandId: string;
          brandName: string;
          packId: string;
          packName: string;
          playbookId?: string;
          playbookTitle?: string;
        }[] = [];
        for (const b of d?.brands || []) {
          const primaryPb = (b.playbooks || [])[0];
          for (const p of b.packs || []) {
            rows.push({
              brandId: b.id,
              brandName: b.name,
              packId: p.id,
              packName: p.name,
              playbookId: primaryPb?.id,
              playbookTitle: primaryPb?.title,
            });
          }
          if (!(b.packs || []).length && primaryPb) {
            rows.push({
              brandId: b.id,
              brandName: b.name,
              packId: '',
              packName: 'Playbook only',
              playbookId: primaryPb.id,
              playbookTitle: primaryPb.title,
            });
          }
        }
        setBrandPacks(rows);
        const brandId = searchParams.get('brandId');
        const packId = searchParams.get('packId');
        const urlPlaybookId = searchParams.get('playbookId');
        let matched:
          | {
              brandId: string;
              packId: string;
              playbookId?: string;
            }
          | undefined;
        if (brandId && packId) {
          matched = rows.find((r) => r.brandId === brandId && r.packId === packId);
        } else if (brandId) {
          matched = rows.find((r) => r.brandId === brandId);
        } else if (packId) {
          matched = rows.find((r) => r.packId === packId);
        }
        if (matched) {
          setPackKey(`${matched.brandId}:${matched.packId}`);
          if (matched.playbookId && !urlPlaybookId) {
            setPlaybookId(matched.playbookId);
          }
        }
        if (urlPlaybookId) setPlaybookId(urlPlaybookId);
      })
      .catch(() => {});
    fetch('/api/playbooks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setPlaybooks(
          (d?.playbooks || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            brandId: p.brandId || p.brand?.id || null,
            brandName: p.brand?.name || null,
          }))
        )
      )
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (typeof d.minutesRemaining === 'number') {
          setMinutesRemaining(d.minutesRemaining);
        }
        if (d.id) setUserId(String(d.id));
        if (d.orgId) setOrgId(String(d.orgId));
        setCanStoreRecordings(Boolean(d.canStoreRecordings));
      })
      .catch(() => {});
  }, []);

  const selectedPack = brandPacks.find((p) => `${p.brandId}:${p.packId}` === packKey);
  const selectedBrandId = selectedPack?.brandId || null;

  const filteredPlaybooks = playbooks.filter((p) =>
    selectedBrandId ? p.brandId === selectedBrandId : !p.brandId
  );

  function pickPlaybookForBrand(brandId: string | null | undefined, preferredId?: string) {
    const pool = playbooks.filter((p) => (brandId ? p.brandId === brandId : !p.brandId));
    if (preferredId && pool.some((p) => p.id === preferredId)) return preferredId;
    return pool[0]?.id || '';
  }

  function onPackKeyChange(next: string) {
    setPackKey(next);
    if (!next) {
      setPlaybookId(pickPlaybookForBrand(null));
      return;
    }
    const pack = brandPacks.find((p) => `${p.brandId}:${p.packId}` === next);
    setPlaybookId(pickPlaybookForBrand(pack?.brandId, pack?.playbookId));
  }

  useEffect(() => {
    if (!playbooks.length || !playbookId) return;
    const allowed = playbooks.some((p) => {
      if (p.id !== playbookId) return false;
      return selectedBrandId ? p.brandId === selectedBrandId : !p.brandId;
    });
    if (allowed) return;
    const preferred = selectedPack?.playbookId;
    const pool = playbooks.filter((p) =>
      selectedBrandId ? p.brandId === selectedBrandId : !p.brandId
    );
    const next =
      preferred && pool.some((p) => p.id === preferred) ? preferred : pool[0]?.id || '';
    setPlaybookId(next);
  }, [selectedBrandId, playbooks, playbookId, selectedPack?.playbookId]);

  useEffect(() => {
    fetch('/api/trainer/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focus,
        difficulty,
        prospectId: prospectId || undefined,
        playbookId: playbookId || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => setScriptSections(d.sections || []))
      .catch(() => {});
  }, [focus, difficulty, prospectId, playbookId]);

  useEffect(() => {
    if (!realtime.isConnected) return;
    if (realtime.twoStage) {
      setPhaseLabel(realtime.phase === 'decision_maker' ? 'Decision Maker' : 'Gatekeeper');
    } else {
      setPhaseLabel('Live');
    }
  }, [realtime.isConnected, realtime.phase, realtime.twoStage]);

  async function startCall() {
    setError(null);
    setScorecard(null);
    setPointsEarned(null);
    setEarnedBadge(null);
    setSessionId(null);
    setCoachLog([]);

    let gateToken: string | undefined;
    try {
      const gateRes = await fetch('/api/trainer/session-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedPack?.brandId,
          packId: selectedPack?.packId || undefined,
        }),
      });
      const gate = await gateRes.json();
      if (!gateRes.ok || !gate.ok) {
        setError(gate.error || 'No practice minutes left. Upgrade to keep grinding.');
        if (typeof gate.minutesRemaining === 'number') setMinutesRemaining(gate.minutesRemaining);
        return;
      }
      gateToken = gate.gateToken;
      setGateHoldId(gate.holdId || null);
      if (typeof gate.minutesRemaining === 'number') setMinutesRemaining(gate.minutesRemaining);
    } catch {
      setError('Could not start session gate. Try again.');
      return;
    }

    setCallStartedAt(Date.now());
    setPhaseLabel('Connecting…');
    setEarnedCert(null);
    setBountiesCleared([]);
    const ok = await realtime.connect({
      prospectId: prospectId || undefined,
      difficulty,
      focus,
      voice: 'ara',
      gatekeeperVoice: 'ara',
      bossVoice: focus === 'pen_pitch' ? 'rex' : 'sal',
      hintMode,
      brandId: selectedPack?.brandId,
      packId: selectedPack?.packId || undefined,
      playbookId: playbookId || undefined,
      userId: userId || undefined,
      orgId: orgId || undefined,
      gateToken,
    });
    if (!ok) {
      setPhaseLabel('Ready');
      setCallStartedAt(null);
    }
  }

  async function endAndScore() {
    const transcriptText = realtime.transcript
      .map((e) => `${e.role.toUpperCase()}: ${e.text}`)
      .join('\n');
    const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : 0;
    const audioBlob = await realtime.stopRecording();
    realtime.disconnect();
    setPhaseLabel('Scoring…');
    setBusy(true);
    try {
      const clientRequestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch('/api/trainer/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          coachLog,
          prospectId: prospectId || undefined,
          scenarioType: focus,
          focusArea: focus,
          difficulty,
          duration,
          brandId: selectedPack?.brandId,
          packId: selectedPack?.packId || undefined,
          gateHoldId: gateHoldId || undefined,
          clientRequestId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Score failed');
      setScorecard(data.scorecard);
      setPointsEarned(data.pointsEarned ?? null);
      setEarnedBadge(data.badge || null);
      setEarnedCert(data.certification?.label || null);
      setBountiesCleared((data.bountiesCleared || []).map((b: { title: string }) => b.title));
      setSessionId(data.sessionId || null);
      setGateHoldId(null);
      if (typeof data.minutesRemaining === 'number') {
        setMinutesRemaining(data.minutesRemaining);
      } else {
        fetch('/api/me')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && typeof d.minutesRemaining === 'number') {
              setMinutesRemaining(d.minutesRemaining);
            }
          })
          .catch(() => {});
      }

      if (data.sessionId && audioBlob && audioBlob.size > 1000 && canStoreRecordings) {
        try {
          const up = await fetch('/api/clips/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: data.sessionId,
              contentType: audioBlob.type || 'audio/webm',
              durationSec: duration,
            }),
          });
          const upData = await up.json();
          if (up.status === 403) {
            setPhaseLabel('Scored');
          } else if (up.ok && upData.uploadUrl) {
            const putHeaders: Record<string, string> = {
              'Content-Type': audioBlob.type || 'audio/webm',
              ...(upData.uploadHeaders || {}),
            };
            const putRes = await fetch(upData.uploadUrl, {
              method: 'PUT',
              headers: putHeaders,
              body: audioBlob,
            });
            if (putRes.ok) {
              const done = await fetch(`/api/clips/${upData.clipId}/complete`, { method: 'POST' });
              if (done.ok) {
                setPhaseLabel('Scored · audio highlight saved');
              } else {
                setPhaseLabel('Scored · highlight upload incomplete');
                setError(
                  'Call scored, but audio highlight failed to save. You can create a clip draft below.'
                );
              }
            } else {
              setPhaseLabel('Scored · highlight upload failed');
              setError(
                'Call scored, but audio highlight upload failed. You can create a clip draft below.'
              );
            }
          } else {
            setPhaseLabel('Scored · highlight unavailable');
            setError(upData.error || 'Call scored, but highlight upload could not start.');
          }
        } catch {
          setPhaseLabel('Scored · highlight failed');
          setError('Call scored, but audio highlight failed. You can create a clip draft below.');
        }
      } else {
        setPhaseLabel('Scored');
      }
    } catch (e: any) {
      setError(e.message);
      setPhaseLabel('Ready');
    } finally {
      setBusy(false);
      setCallStartedAt(null);
    }
  }

  async function createClipDraft() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clip draft failed');
      setError(null);
      setPhaseLabel(data.message || 'Clip draft saved');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const hooks = parseHooks(selected?.hooksJSON);
  const liveOnLead = realtime.isConnected && selected?.id === prospectId;

  return (
    <div className="app-page app-page--desk">
      <PageHeader
        compact
        eyebrow="Workspace"
        title="Trainer"
        description="AI voice warm-up — pick a lead, then start a practice call."
        actions={
          <>
            <Link href="/outbound" className="btn-ghost">
              Cold Call
            </Link>
            <Link href="/billing" className="btn-ghost">
              Minutes
            </Link>
          </>
        }
      />

      <div className="cc-desk-config" aria-label="Session config">
        <label className="cc-desk-config__field">
          <span>Scenario</span>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as FocusArea)}
            disabled={realtime.isConnected}
          >
            {FOCUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-desk-config__field">
          <span>Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            disabled={realtime.isConnected}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="cc-desk-config__field">
          <span>Brand</span>
          <select
            value={packKey}
            onChange={(e) => onPackKeyChange(e.target.value)}
            disabled={realtime.isConnected}
          >
            <option value="">None — generic</option>
            {brandPacks.map((p) => (
              <option key={`${p.brandId}:${p.packId || 'pb'}`} value={`${p.brandId}:${p.packId}`}>
                {p.brandName} · {p.packName}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-desk-config__field">
          <span>Playbook</span>
          <select
            value={playbookId}
            onChange={(e) => setPlaybookId(e.target.value)}
            disabled={realtime.isConnected}
          >
            <option value="">None — default</option>
            {filteredPlaybooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <div className="cc-desk-config__toggles">
          <Toggle
            compact
            inline
            checked={hintMode}
            onChange={setHintMode}
            label="Hint mode"
            disabled={realtime.isConnected}
          />
          <Toggle
            compact
            inline
            checked={coachOn}
            onChange={setCoachOn}
            label="Live coach"
            disabled={realtime.isConnected}
          />
        </div>
      </div>

      <div className="cc-desk">
        {/* Left: practice leads */}
        <section className="cc-desk__col cc-desk__queue" aria-label="Practice leads">
          <div className="cc-desk__col-head">
            {hasBrandLeads ? (
              <div className="cc-desk__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={leadTab === 'training'}
                  className={`cc-desk__tab${leadTab === 'training' ? ' is-active' : ''}`}
                  onClick={() => setLeadTab('training')}
                  disabled={realtime.isConnected}
                >
                  Training
                  <span className="cc-desk__tab-count">{trainingLeads.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leadTab === 'brand'}
                  className={`cc-desk__tab${leadTab === 'brand' ? ' is-active' : ''}`}
                  onClick={() => setLeadTab('brand')}
                  disabled={realtime.isConnected}
                >
                  Brand
                  <span className="cc-desk__tab-count">{brandLeads.length}</span>
                </button>
              </div>
            ) : (
              <>
                <strong>Training leads</strong>
                <span className="cc-desk__tab-count">{trainingLeads.length}</span>
              </>
            )}
          </div>

          <div className="cc-desk__col-body">
            {queue.length === 0 ? (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">
                  {leadTab === 'brand' ? 'No brand leads' : 'No training leads'}
                </p>
                <p className="cc-desk__gate-desc">
                  {leadTab === 'brand'
                    ? 'Accepted campaign leads appear here for AI practice personalization.'
                    : 'Seed demo training leads or open Leads to add practice contacts.'}
                </p>
                <Link href={leadTab === 'brand' ? '/gigs' : '/leads'} className="btn-ghost">
                  {leadTab === 'brand' ? 'Browse gigs →' : 'Training leads →'}
                </Link>
              </div>
            ) : (
              <ul className="cc-desk__list">
                {queue.map((p) => {
                  const isSelected = selected?.id === p.id;
                  const isLive = liveOnLead && isSelected;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`cc-desk__row${isSelected ? ' is-selected' : ''}${isLive ? ' is-live' : ''}`}
                        onClick={() => !realtime.isConnected && setProspectId(p.id)}
                        disabled={realtime.isConnected && !isSelected}
                      >
                        <span className="cc-desk__row-main">
                          <span className="cc-desk__row-name">{p.companyName}</span>
                          <span className="cc-desk__row-meta">
                            {p.ownerName || p.industry || '—'}
                            {p.city ? ` · ${p.city}` : ''}
                          </span>
                          {p.brandName ? (
                            <span className="cc-desk__row-phone">{p.brandName}</span>
                          ) : null}
                        </span>
                        {isLive && <span className="cc-desk__live-dot" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="cc-desk__col-foot">
            <Link href="/leads" className="cc-desk__foot-link">
              All training leads →
            </Link>
          </div>
        </section>

        {/* Center: AI session */}
        <section className="cc-desk__col cc-desk__dialer" aria-label="AI voice session">
          <div className="cc-desk__col-head">
            <strong>AI voice call</strong>
            <span className="cc-desk__status muted">
              {phaseLabel}
              {realtime.isConnected ? ` · ${formatDuration(durationSecs)}` : ''}
            </span>
          </div>

          <div className="cc-desk__col-body cc-desk__dialer-body">
            {realtime.isConnected && (
              <div className="cc-desk__live-bar">
                <div className="cc-desk__live-info">
                  <span className="cc-desk__live-dot" />
                  <div>
                    <strong>{phaseLabel}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {formatDuration(durationSecs)}
                      {realtime.isProspectSpeaking ? ' · Prospect speaking' : ''}
                      {realtime.isUserSpeaking ? ' · You speaking' : ''}
                    </div>
                  </div>
                </div>
                <div className="cc-desk__live-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => realtime.setMicEnabled(!realtime.micEnabled)}
                  >
                    Mic {realtime.micEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void endAndScore()}
                    disabled={busy}
                    style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }}
                  >
                    End & score
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="cc-desk__error" role="alert">
                {error}
                {error.toLowerCase().includes('minute') && (
                  <>
                    {' '}
                    <Link href="/billing">Upgrade →</Link>
                  </>
                )}
              </p>
            )}

            {selected ? (
              <div className="cc-desk__active-card">
                {selected.brandName && (
                  <div className="cc-desk__brand-row">
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {selected.brandName}
                      {selected.purpose === 'training' ? ' · practice ICP' : ' · brand lead'}
                    </span>
                  </div>
                )}
                <h2 className="cc-desk__active-name">{selected.companyName}</h2>
                <p className="cc-desk__active-contact">
                  {selected.ownerName || 'Decision maker'}
                  {selected.ownerTitle ? ` · ${selected.ownerTitle}` : ''}
                </p>
                <p className="cc-desk__active-phone muted" style={{ fontSize: '0.85rem' }}>
                  AI roleplay · not a real phone dial
                </p>
                {!realtime.isConnected &&
                  (minutesRemaining != null && minutesRemaining <= 0 ? (
                    <Link href="/billing" className="btn cc-desk__call-btn">
                      Upgrade minutes
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn cc-desk__call-btn"
                      onClick={() => void startCall()}
                      disabled={busy}
                    >
                      Start voice call
                    </button>
                  ))}
              </div>
            ) : (
              <div className="cc-desk__idle">
                <p className="cc-desk__gate-title">Select a lead</p>
                <p className="cc-desk__gate-desc">
                  Pick a training or brand lead to personalize the AI scenario.
                </p>
              </div>
            )}

            <div className="cc-desk__transcript" aria-live="polite">
              {realtime.transcript.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Transcript appears here once the call starts.
                </p>
              ) : (
                realtime.transcript.map((entry) => (
                  <div key={`${entry.id}-${entry.seq}`} className={`bubble bubble--${entry.role}`}>
                    <strong>{entry.role}</strong>
                    <span>{entry.text}</span>
                  </div>
                ))
              )}
            </div>

            {coachOn && coach.visible && coach.sayNext && (
              <div className="cc-desk__coach">
                <strong>
                  Coach whisper
                  {coach.source === 'llm' ? ' · AI' : coach.source === 'instant' ? ' · quick tip' : ''}
                </strong>
                <p>{coach.sayNext}</p>
              </div>
            )}

            {scorecard && (
              <div className="cc-desk__scorecard">
                <h2 style={{ color: scoreColor(scorecard.overallScore) }}>
                  {scorecard.overallScore}/100
                  {pointsEarned != null && <small> · +{pointsEarned} pts</small>}
                </h2>
                {earnedBadge && (
                  <p style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
                    Badge unlocked: {earnedBadge}
                  </p>
                )}
                {earnedCert && (
                  <p style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
                    Certification: {earnedCert}
                  </p>
                )}
                {bountiesCleared.length > 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Bounty cleared: {bountiesCleared.join(', ')}
                  </p>
                )}
                <p>{scorecard.summary}</p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.8rem' }}>Strengths</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                      {(scorecard.feedback?.strengths || []).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.8rem' }}>Improve</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                      {(scorecard.feedback?.improvements || []).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginTop: '0.75rem',
                  }}
                >
                  {sessionId && (
                    <Link
                      href={`/sessions/${sessionId}`}
                      style={{ fontWeight: 600, color: 'var(--accent-2)' }}
                    >
                      View session →
                    </Link>
                  )}
                  {sessionId && scorecard.overallScore >= 70 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void createClipDraft()}
                      disabled={busy}
                    >
                      Create clip draft
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: context */}
        <section className="cc-desk__col cc-desk__context" aria-label="Lead context">
          <div className="cc-desk__col-head">
            <strong>Context</strong>
          </div>
          <div className="cc-desk__col-body">
            {selected ? (
              <>
                <div className="cc-desk__ctx-block">
                  <h3 className="cc-desk__ctx-title">{selected.companyName}</h3>
                  <dl className="cc-desk__ctx-dl">
                    <div>
                      <dt>Contact</dt>
                      <dd>
                        {selected.ownerName || '—'}
                        {selected.ownerTitle ? ` · ${selected.ownerTitle}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        {[selected.city, selected.state].filter(Boolean).join(', ') || '—'}
                      </dd>
                    </div>
                    {selected.industry && (
                      <div>
                        <dt>Industry</dt>
                        <dd>{selected.industry}</dd>
                      </div>
                    )}
                    {selected.website && (
                      <div>
                        <dt>Web</dt>
                        <dd>
                          <a
                            href={
                              selected.website.startsWith('http')
                                ? selected.website
                                : `https://${selected.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {selected.website.replace(/^https?:\/\//, '')}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {hooks.length > 0 && (
                  <div className="cc-desk__ctx-block">
                    <h4 className="cc-desk__ctx-label">Hooks</h4>
                    <ul className="cc-desk__hooks">
                      {hooks.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.notes && (
                  <div className="cc-desk__ctx-block">
                    <h4 className="cc-desk__ctx-label">Notes</h4>
                    <p className="cc-desk__notes">{selected.notes}</p>
                  </div>
                )}

                <div className="cc-desk__ctx-block">
                  <h4 className="cc-desk__ctx-label">Playbook</h4>
                  <p className="cc-desk__gate-desc" style={{ marginBottom: '0.65rem' }}>
                    {selectedPack?.playbookTitle && playbookId === selectedPack.playbookId
                      ? `Brand playbook “${selectedPack.playbookTitle}” drives cues & coach.`
                      : 'Cues update from scenario, difficulty, lead, and playbook.'}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setCheatSheetOpen(true)}
                  >
                    Open playbook cheat →
                  </button>
                </div>
              </>
            ) : (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">No lead selected</p>
                <p className="cc-desk__gate-desc">
                  Select a queue row to see contact details, hooks, and playbook cues.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <CheatSheetPanel
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
        sections={scriptSections}
      />
    </div>
  );
}
