'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Award,
  CheckCircle,
  Clock,
  FileText,
  History,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ShieldAlert,
  Sparkles,
  User,
  Volume2,
} from 'lucide-react';
import { useXaiTrainerRealtime, type TrainerTranscriptEntry } from '@/hooks/useXaiTrainerRealtime';
import { useLiveCoach, type CoachLogEntry } from '@/hooks/useLiveCoach';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import { formatDuration, formatSessionDate, scoreColor } from '@/lib/trainer/session-utils';
import CheatSheetPanel, { type CheatSheetSection } from '@/components/CheatSheetPanel';
import { useShell } from '@/components/ShellProvider';
import {
  TRAINER_VOICES,
  trainerVoiceLabel,
  trainerVoiceSummary,
} from '@/lib/trainer/voices';
import './ColdCallTrainerView.css';

type Difficulty = 'easy' | 'medium' | 'hard';
type ViewState = 'SETUP' | 'LIVE' | 'SCORECARD' | 'HISTORY';

interface LeadOption {
  id: string;
  companyName: string;
  brandName?: string | null;
  purpose: 'training' | 'brand';
}

interface BrandPackOption {
  brandId: string;
  brandName: string;
  packId: string;
  packName: string;
  playbookId?: string;
  playbookTitle?: string;
}

interface PlaybookOption {
  id: string;
  title: string;
  brandId?: string | null;
}

interface Scorecard {
  overallScore: number;
  scores: Record<string, number>;
  feedback: { strengths: string[]; improvements: string[] };
  summary: string;
}

interface SessionSummary {
  id: string;
  scenarioType: string;
  focusArea: string;
  difficulty?: string;
  overallScore: number;
  duration: number;
  createdAt: string;
  leadCompany?: string | null;
}

const FOCUS_OPTIONS = Object.entries(FOCUS_LABELS) as [FocusArea, string][];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ColdCallTrainerView() {
  const shell = useShell();
  const [viewState, setViewState] = useState<ViewState>('SETUP');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [focus, setFocus] = useState<FocusArea>('standard');
  const [voice, setVoice] = useState('leo');
  const [gatekeeperVoice, setGatekeeperVoice] = useState('ara');
  const [bossVoice, setBossVoice] = useState('sal');

  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [prospectId, setProspectId] = useState('');
  const [brandPacks, setBrandPacks] = useState<BrandPackOption[]>([]);
  const [packKey, setPackKey] = useState('');
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([]);
  const [playbookId, setPlaybookId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canStoreRecordings, setCanStoreRecordings] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(
    () => shell?.metrics.minutesRemaining ?? null
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [coachActive, setCoachActive] = useState(false);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [earnedBadge, setEarnedBadge] = useState<string | null>(null);
  const [earnedCert, setEarnedCert] = useState<string | null>(null);
  const [bountiesCleared, setBountiesCleared] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gateHoldId, setGateHoldId] = useState<string | null>(null);
  const [lastCallSnapshot, setLastCallSnapshot] = useState<{
    transcript: TrainerTranscriptEntry[];
    coachLog: CoachLogEntry[];
  } | null>(null);

  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [cheatOpen, setCheatOpen] = useState(false);
  const [cheatLoading, setCheatLoading] = useState(false);
  const [cheatSections, setCheatSections] = useState<CheatSheetSection[]>([]);
  const [cheatProductUrl, setCheatProductUrl] = useState<string | undefined>();
  const [cheatTrainingImages, setCheatTrainingImages] = useState<string[]>([]);
  const [cheatTrainingVideoUrl, setCheatTrainingVideoUrl] = useState<string | undefined>();

  const coachLogRef = useRef<CoachLogEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const onError = useCallback((message: string) => setError(message), []);
  const onCallEnded = useCallback(() => {
    setError((prev) => prev ?? 'Call ended — no response from caller.');
  }, []);

  const realtime = useXaiTrainerRealtime({ onError, onCallEnded });

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === prospectId) || null,
    [leads, prospectId]
  );

  const coach = useLiveCoach({
    enabled: viewState === 'LIVE' && realtime.isConnected,
    active: coachActive,
    transcript: realtime.transcript,
    phase: realtime.phase,
    gatekeeperName: realtime.gatekeeperName,
    decisionMakerName: realtime.decisionMakerName,
    companyName: selectedLead?.companyName || 'the business',
    difficulty,
    isProspectSpeaking: realtime.isProspectSpeaking,
    isUserSpeaking: realtime.isUserSpeaking,
    callTimer,
    playbookId: playbookId || undefined,
    onSuggestion: (entry) => {
      coachLogRef.current.push(entry);
    },
  });

  // Load leads once.
  useEffect(() => {
    (async () => {
      try {
        const [trainingRes, brandRes] = await Promise.all([
          fetch('/api/prospects?training=1&limit=40'),
          fetch('/api/prospects?dialable=1&limit=60'),
        ]);
        const rows: LeadOption[] = [];
        if (trainingRes.ok) {
          const data = await trainingRes.json();
          for (const p of data.prospects || []) {
            rows.push({
              id: String(p.id),
              companyName: String(p.companyName || 'Unknown'),
              brandName: null,
              purpose: 'training',
            });
          }
        }
        if (brandRes.ok) {
          const data = await brandRes.json();
          for (const p of data.prospects || []) {
            rows.push({
              id: String(p.id),
              companyName: String(p.companyName || 'Unknown'),
              brandName: p.brand?.name || p.brandName || null,
              purpose: 'brand',
            });
          }
        }
        setLeads(rows);
      } catch {
        /* practice works without a lead */
      }
    })();
  }, []);

  // Load brand packs + playbooks once.
  useEffect(() => {
    fetch('/api/brands?practice=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: BrandPackOption[] = [];
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
          }))
        )
      )
      .catch(() => {});

    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (typeof d.minutesRemaining === 'number') {
          setMinutesRemaining((current) =>
            current === d.minutesRemaining ? current : d.minutesRemaining
          );
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

  // Fetch talking points whenever the scenario changes so the cheat sheet is instant.
  useEffect(() => {
    let cancelled = false;
    setCheatLoading(true);
    fetch('/api/trainer/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospectId: prospectId || undefined,
        focus,
        difficulty,
        playbookId: playbookId || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCheatSections(d.sections || []);
        setCheatProductUrl(typeof d.productUrl === 'string' ? d.productUrl : undefined);
        setCheatTrainingImages(Array.isArray(d.trainingImages) ? d.trainingImages.map(String) : []);
        setCheatTrainingVideoUrl(
          typeof d.trainingVideoUrl === 'string' ? d.trainingVideoUrl : undefined
        );
      })
      .catch(() => {
        if (cancelled) return;
        setCheatSections([]);
        setCheatProductUrl(undefined);
        setCheatTrainingImages([]);
        setCheatTrainingVideoUrl(undefined);
      })
      .finally(() => {
        if (!cancelled) setCheatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prospectId, focus, difficulty, playbookId]);

  useEffect(() => {
    if (viewState !== 'HISTORY') return;
    setHistoryLoading(true);
    fetch('/api/trainer/sessions?limit=30', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSessionHistory(d.sessions || []))
      .catch(() => setError('Could not load past sessions'))
      .finally(() => setHistoryLoading(false));
  }, [viewState]);

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtime.transcript, coach.sayNext, coachActive]);

  const handleTranscriptScroll = () => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 64;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startCall() {
    setError(null);
    setScorecard(null);
    setPointsEarned(null);
    setEarnedBadge(null);
    setEarnedCert(null);
    setBountiesCleared([]);
    setSessionId(null);
    setLastCallSnapshot(null);
    setCoachActive(false);
    coachLogRef.current = [];
    userScrolledUpRef.current = false;

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

    setViewState('LIVE');
    setCallTimer(0);
    timerRef.current = setInterval(() => setCallTimer((prev) => prev + 1), 1000);

    const ok = await realtime.connect({
      prospectId: prospectId || undefined,
      difficulty,
      focus,
      voice,
      gatekeeperVoice,
      bossVoice,
      brandId: selectedPack?.brandId,
      packId: selectedPack?.packId || undefined,
      playbookId: playbookId || undefined,
      userId: userId || undefined,
      orgId: orgId || undefined,
      gateToken,
    });

    if (!ok) {
      if (timerRef.current) clearInterval(timerRef.current);
      setViewState('SETUP');
    }
  }

  async function endCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    const finishedTranscript = [...realtime.transcript];
    const finishedCoachLog = [...coachLogRef.current];
    const duration = callTimer;

    const audioBlob = await realtime.stopRecording();
    realtime.disconnect();

    setViewState('SCORECARD');
    setIsEvaluating(true);
    setLastCallSnapshot({ transcript: finishedTranscript, coachLog: finishedCoachLog });

    const transcriptText = finishedTranscript
      .map((t) => {
        const label =
          t.role === 'user'
            ? 'Salesperson'
            : t.role === 'gatekeeper'
              ? `Gatekeeper (${realtime.gatekeeperName})`
              : t.role === 'decision_maker'
                ? `Decision Maker (${realtime.decisionMakerName})`
                : 'Prospect';
        return `${label}: ${t.text}`;
      })
      .join('\n');

    if (transcriptText.trim() === '') {
      setScorecard({
        overallScore: 0,
        summary: 'No conversation was recorded.',
        feedback: { strengths: [], improvements: [] },
        scores: {},
      });
      setIsEvaluating(false);
      return;
    }

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
          coachLog: finishedCoachLog,
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
      if (!res.ok) throw new Error(data.error || 'Failed to evaluate call');

      setScorecard(data.scorecard);
      setPointsEarned(data.pointsEarned ?? null);
      setEarnedBadge(data.badge || null);
      setEarnedCert(data.certification?.label || null);
      setBountiesCleared((data.bountiesCleared || []).map((b: { title: string }) => b.title));
      setSessionId(data.sessionId || null);
      setGateHoldId(null);
      if (typeof data.minutesRemaining === 'number') setMinutesRemaining(data.minutesRemaining);

      if (data.sessionId && audioBlob && audioBlob.size > 1000 && canStoreRecordings) {
        void uploadClip(data.sessionId, audioBlob, duration);
      }
    } catch (err: any) {
      setError(err.message || 'Evaluation failed.');
      setScorecard({
        overallScore: 0,
        summary: 'Evaluation failed.',
        feedback: { strengths: [], improvements: [] },
        scores: {},
      });
    } finally {
      setIsEvaluating(false);
    }
  }

  async function uploadClip(clipSessionId: string, audioBlob: Blob, duration: number) {
    try {
      const up = await fetch('/api/clips/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: clipSessionId,
          contentType: audioBlob.type || 'audio/webm',
          durationSec: duration,
        }),
      });
      const upData = await up.json();
      if (!up.ok || !upData.uploadUrl) return;
      const putHeaders: Record<string, string> = {
        'Content-Type': audioBlob.type || 'audio/webm',
        ...(upData.uploadHeaders || {}),
      };
      const putRes = await fetch(upData.uploadUrl, { method: 'PUT', headers: putHeaders, body: audioBlob });
      if (putRes.ok) {
        await fetch(`/api/clips/${upData.clipId}/complete`, { method: 'POST' });
      }
    } catch {
      /* best-effort — scorecard already saved regardless */
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const speakerLabel = (role: TrainerTranscriptEntry['role']) => {
    if (role === 'user') return 'You';
    if (role === 'gatekeeper') return `Gatekeeper (${realtime.gatekeeperName})`;
    if (role === 'decision_maker') return `Boss (${realtime.decisionMakerName})`;
    return 'Prospect';
  };

  const phaseLabel =
    realtime.phase === 'gatekeeper'
      ? `Gatekeeper — ${realtime.gatekeeperName} (${trainerVoiceLabel(gatekeeperVoice)})`
      : realtime.phase === 'decision_maker'
        ? `Decision Maker — ${realtime.decisionMakerName} (${trainerVoiceLabel(bossVoice)})`
        : null;

  const statusLabel = realtime.isConnecting
    ? 'Connecting…'
    : realtime.isProspectSpeaking
      ? realtime.phase === 'gatekeeper'
        ? 'Gatekeeper is speaking…'
        : realtime.phase === 'decision_maker'
          ? 'Boss is speaking…'
          : 'Prospect is speaking…'
      : realtime.isUserSpeaking
        ? 'You are speaking…'
        : realtime.isConnected
          ? realtime.twoStage && realtime.phase === 'gatekeeper'
            ? 'Get past the gatekeeper — earn the transfer'
            : 'Live — speak anytime'
          : 'Disconnected';

  const renderScorecardBody = (card: Scorecard) => (
    <>
      <div className="cct-score-card">
        <div className="cct-score-donut">
          <svg viewBox="0 0 128 128" className="cct-score-donut__svg">
            <circle cx="64" cy="64" r="56" fill="transparent" stroke="var(--line)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="transparent"
              stroke={scoreColor(card.overallScore || 0)}
              strokeWidth="8"
              strokeDasharray="351.85"
              strokeDashoffset={351.85 - (351.85 * (card.overallScore || 0)) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="cct-score-donut__label">
            <span className="cct-score-donut__value">{card.overallScore}</span>
            <span className="cct-score-donut__unit">Score</span>
          </div>
        </div>
        <div className="cct-score-summary">
          <h3>
            <Award size={18} className="cct-icon-accent" /> Performance Summary
          </h3>
          <p>{card.summary}</p>
        </div>
      </div>

      {card.scores && Object.keys(card.scores).length > 0 && (
        <div className="cct-score-tiles">
          {Object.entries(card.scores).map(([key, val]) => (
            <div key={key} className="cct-score-tile">
              <div className="cct-score-tile__label">{key}</div>
              <div className="cct-score-tile__value">
                {val}
                <span>/ 100</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cct-feedback-grid">
        <div>
          <h4 className="cct-feedback-heading cct-feedback-heading--good">
            <CheckCircle size={15} /> Strengths
          </h4>
          <ul>
            {(card.feedback?.strengths || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="cct-feedback-heading cct-feedback-heading--warn">
            <ShieldAlert size={15} /> Areas to Improve
          </h4>
          <ul>
            {(card.feedback?.improvements || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-page cct-page">
      <header className="cct-topbar">
        <div>
          <h1>Cold Call Trainer</h1>
          <p className="cct-muted">Gatekeeper → Boss · xAI Realtime · Live coach</p>
        </div>
        <div className="cct-topbar__actions">
          {minutesRemaining != null && (
            <span className="cct-minutes-chip">{Math.max(0, Math.floor(minutesRemaining))} min left</span>
          )}
          {viewState !== 'LIVE' && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setViewState(viewState === 'HISTORY' ? 'SETUP' : 'HISTORY')}
            >
              <History size={16} />
              {viewState === 'HISTORY' ? 'Back to setup' : 'Past calls'}
            </button>
          )}
          <Link href="/cold_calls" className="btn-ghost">
            Cold Call
          </Link>
          <Link href="/billing" className="btn-ghost">
            Minutes
          </Link>
        </div>
      </header>

      {error && (
        <p className="cct-error" role="alert">
          {error}
          {error.toLowerCase().includes('minute') && (
            <>
              {' '}
              <Link href="/billing">Upgrade →</Link>
            </>
          )}
          <button type="button" className="cct-error__dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}

      <div className="cct-body">
        <AnimatePresence mode="wait">
          {viewState === 'SETUP' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="cct-setup"
            >
              <div className="cct-setup__intro">
                <h2>Configure Practice Scenario</h2>
                <p className="cct-muted">
                  Practice the full cold call: get past the gatekeeper, then pitch the decision maker.
                </p>
              </div>

              <div className="cct-setup__grid">
                <label className="cct-field">
                  <span>Practice lead</span>
                  <select value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
                    <option value="">No lead — generic practice</option>
                    {leads.some((l) => l.purpose === 'training') && (
                      <optgroup label="Practice leads">
                        {leads
                          .filter((l) => l.purpose === 'training')
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.companyName}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {leads.some((l) => l.purpose === 'brand') && (
                      <optgroup label="Brand leads">
                        {leads
                          .filter((l) => l.purpose === 'brand')
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.companyName}
                              {l.brandName ? ` · ${l.brandName}` : ''}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </label>

                <label className="cct-field">
                  <span>Scenario focus</span>
                  <select value={focus} onChange={(e) => setFocus(e.target.value as FocusArea)}>
                    {FOCUS_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cct-field">
                  <span>Difficulty</span>
                  <div className="cct-pill-row">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficulty(level)}
                        className={`cct-pill${difficulty === level ? ' is-active' : ''}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="cct-field">
                  <span>Brand pack (optional)</span>
                  <select value={packKey} onChange={(e) => onPackKeyChange(e.target.value)}>
                    <option value="">None — generic</option>
                    {brandPacks.map((p) => (
                      <option key={`${p.brandId}:${p.packId || 'pb'}`} value={`${p.brandId}:${p.packId}`}>
                        {p.brandName} · {p.packName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cct-field">
                  <span>Playbook (optional)</span>
                  <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
                    <option value="">None — default</option>
                    {filteredPlaybooks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="cct-voice-cast">
                <div className="cct-voice-cast__head">
                  <Volume2 size={16} className="cct-icon-accent" />
                  Voice Cast
                </div>
                {focus === 'standard' ? (
                  <div className="cct-voice-cast__grid">
                    <div className="cct-voice-slot cct-voice-slot--gatekeeper">
                      <div className="cct-voice-slot__head">
                        <span>Phase 1 · Gatekeeper</span>
                        <small>Screens the call</small>
                      </div>
                      {TRAINER_VOICES.map((v) => (
                        <button
                          key={`gk-${v.id}`}
                          type="button"
                          onClick={() => setGatekeeperVoice(v.id)}
                          className={`cct-voice-btn${gatekeeperVoice === v.id ? ' is-active' : ''}`}
                        >
                          {trainerVoiceSummary(v.id)}
                        </button>
                      ))}
                    </div>
                    <div className="cct-voice-slot cct-voice-slot--boss">
                      <div className="cct-voice-slot__head">
                        <span>Phase 2 · Decision Maker</span>
                        <small>You pitch here</small>
                      </div>
                      {TRAINER_VOICES.map((v) => (
                        <button
                          key={`boss-${v.id}`}
                          type="button"
                          onClick={() => setBossVoice(v.id)}
                          className={`cct-voice-btn${bossVoice === v.id ? ' is-active' : ''}`}
                        >
                          {trainerVoiceSummary(v.id)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="cct-voice-cast__single">
                    {TRAINER_VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVoice(v.id)}
                        className={`cct-voice-btn${voice === v.id ? ' is-active' : ''}`}
                      >
                        {trainerVoiceSummary(v.id)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="cct-setup__actions">
                <button type="button" className="btn-ghost" onClick={() => setCheatOpen(true)}>
                  <FileText size={15} />
                  Talking points
                </button>
                {minutesRemaining != null && minutesRemaining <= 0 ? (
                  <Link href="/billing" className="btn cct-start-btn">
                    Upgrade minutes
                  </Link>
                ) : (
                  <button type="button" className="btn cct-start-btn" onClick={() => void startCall()}>
                    <Phone size={16} />
                    Start Practice Call
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {viewState === 'LIVE' && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="cct-live"
            >
              <div className="cct-live__bar">
                <div className="cct-live__who">
                  <div className="cct-live__avatar-wrap">
                    <div
                      className={`cct-live__avatar${
                        realtime.isProspectSpeaking
                          ? ' is-prospect'
                          : realtime.isUserSpeaking
                            ? ' is-user'
                            : ''
                      }`}
                    >
                      <User size={22} />
                    </div>
                    {(realtime.isProspectSpeaking || realtime.isUserSpeaking) && (
                      <span className="cct-live__pulse" aria-hidden />
                    )}
                  </div>
                  <div className="cct-live__meta">
                    <div className="cct-live__status">{statusLabel}</div>
                    <div className="cct-live__submeta">
                      <Activity size={12} className={realtime.isConnected ? 'cct-icon-good' : ''} />
                      <span>{formatTime(callTimer)}</span>
                      {phaseLabel && (
                        <span
                          className={`cct-phase-badge${
                            realtime.phase === 'gatekeeper'
                              ? ' cct-phase-badge--gatekeeper'
                              : ' cct-phase-badge--boss'
                          }`}
                        >
                          {phaseLabel}
                        </span>
                      )}
                      {realtime.isConnected && <span className="cct-icon-good">· xAI Realtime</span>}
                    </div>
                  </div>
                </div>
                <button type="button" className="cct-danger-btn" onClick={() => void endCall()}>
                  <PhoneOff size={16} />
                  End Call
                </button>
              </div>

              <div
                ref={transcriptScrollRef}
                onScroll={handleTranscriptScroll}
                className="cct-live__transcript"
                aria-live="polite"
              >
                {realtime.transcript.length === 0 && realtime.isConnecting && (
                  <p className="cct-muted cct-transcript-empty">Connecting to xAI realtime voice…</p>
                )}
                {realtime.transcript.map((msg) => (
                  <div key={`${msg.id}-${msg.seq}`} className={`cct-bubble-row${msg.role === 'user' ? ' is-user' : ''}`}>
                    <span className="cct-bubble-row__label">{speakerLabel(msg.role)}</span>
                    <div className={`cct-bubble cct-bubble--${msg.role}`}>{msg.text}</div>
                  </div>
                ))}
                {coachActive && coach.visible && (
                  <div className="cct-bubble-row is-user">
                    <span className="cct-bubble-row__label">Coach</span>
                    <div className="cct-bubble cct-bubble--coach">{coach.sayNext}</div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              <div className="cct-live__controls">
                <div className="cct-live__mic">
                  <button
                    type="button"
                    onClick={() => realtime.setMicEnabled(!realtime.micEnabled)}
                    disabled={!realtime.isConnected}
                    className={`cct-mic-btn${realtime.micEnabled && realtime.isConnected ? ' is-on' : ''}`}
                  >
                    {realtime.micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
                  <span className="cct-mic-label">
                    {realtime.micEnabled && realtime.isConnected
                      ? 'Live mic — interrupt anytime'
                      : !realtime.isConnected
                        ? 'Connecting…'
                        : 'Mic muted'}
                  </span>
                </div>
                <div className="cct-live__actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setCheatOpen(true)}
                  >
                    <FileText size={14} />
                    Script
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoachActive((on) => !on)}
                    disabled={!realtime.isConnected}
                    className={`cct-coach-btn${coachActive ? ' is-active' : ''}`}
                  >
                    <Lightbulb size={15} />
                    {coachActive ? 'Coach On' : 'Coach'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {viewState === 'SCORECARD' && (
            <motion.div
              key="scorecard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              className="cct-scorecard-view"
            >
              <div className="cct-scorecard-view__head">
                <h2>Call Evaluation</h2>
                <p className="cct-muted">Grok-powered analysis of your practice session.</p>
                <div className="cct-award-row">
                  {pointsEarned != null && <span className="cct-award-chip">+{pointsEarned} pts</span>}
                  {earnedBadge && <span className="cct-award-chip cct-award-chip--badge">Badge: {earnedBadge}</span>}
                  {earnedCert && <span className="cct-award-chip cct-award-chip--badge">Cert: {earnedCert}</span>}
                  {bountiesCleared.map((b) => (
                    <span key={b} className="cct-award-chip cct-award-chip--bounty">
                      Bounty cleared: {b}
                    </span>
                  ))}
                </div>
              </div>

              {isEvaluating ? (
                <div className="cct-evaluating">
                  <Loader2 size={36} className="cct-spin cct-icon-accent" />
                  <p>Analyzing transcript and generating feedback…</p>
                </div>
              ) : scorecard ? (
                <div className="cct-scorecard-body">
                  {renderScorecardBody(scorecard)}

                  {lastCallSnapshot &&
                    (lastCallSnapshot.transcript.length > 0 || lastCallSnapshot.coachLog.length > 0) && (
                      <div className="cct-recap">
                        <h3>
                          <FileText size={15} /> Call Transcript
                        </h3>
                        <div className="cct-recap__transcript">
                          {lastCallSnapshot.transcript.map((msg) => (
                            <div
                              key={`${msg.id}-${msg.seq}`}
                              className={`cct-bubble-row${msg.role === 'user' ? ' is-user' : ''}`}
                            >
                              <span className="cct-bubble-row__label">{speakerLabel(msg.role)}</span>
                              <div className={`cct-bubble cct-bubble--${msg.role}`}>{msg.text}</div>
                            </div>
                          ))}
                        </div>

                        {lastCallSnapshot.coachLog.length > 0 && (
                          <>
                            <h3>
                              <Lightbulb size={15} className="cct-icon-warn" /> Coach Suggestions
                            </h3>
                            <ul className="cct-coach-log">
                              {lastCallSnapshot.coachLog.map((entry, i) => (
                                <li key={i}>
                                  <span className="cct-muted">{formatTime(entry.atSeconds)}</span>
                                  <div className="cct-coach-log__quote">After: &ldquo;{entry.prospectText}&rdquo;</div>
                                  <div className="cct-coach-log__tip">{entry.suggestion}</div>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}

                  <div className="cct-scorecard-view__actions">
                    {sessionId && (
                      <Link href={`/sessions/${sessionId}`} className="btn-ghost">
                        View full session →
                      </Link>
                    )}
                    {sessionId && scorecard.overallScore >= 70 && (
                      <button type="button" className="btn-ghost" onClick={() => void createClipDraft()} disabled={busy}>
                        Create clip draft
                      </button>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => setViewState('SETUP')}>
                      Practice again
                    </button>
                    <button type="button" className="btn" onClick={() => setViewState('HISTORY')}>
                      <History size={15} />
                      Past calls
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {viewState === 'HISTORY' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              className="cct-history-view"
            >
              <div className="cct-history-view__head">
                <h2>Past Practice Calls</h2>
                <p className="cct-muted">Full transcripts, coaching, and scorecards.</p>
              </div>

              {historyLoading ? (
                <div className="cct-evaluating">
                  <Loader2 size={22} className="cct-spin cct-icon-accent" />
                  <p>Loading sessions…</p>
                </div>
              ) : sessionHistory.length === 0 ? (
                <div className="cct-empty">No saved sessions yet. Complete a practice call to see it here.</div>
              ) : (
                <ul className="cct-history-list">
                  {sessionHistory.map((session) => (
                    <li key={session.id}>
                      <Link href={`/sessions/${session.id}`} className="cct-history-row">
                        <div className="cct-history-row__main">
                          <div className="cct-history-row__title">{session.leadCompany || 'General practice'}</div>
                          <div className="cct-history-row__meta">
                            <span>{formatSessionDate(session.createdAt)}</span>
                            <span>·</span>
                            <span>{(FOCUS_LABELS as Record<string, string>)[session.focusArea] || session.focusArea}</span>
                            {session.difficulty && (
                              <>
                                <span>·</span>
                                <span className="cct-capitalize">{session.difficulty}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="cct-history-row__stats">
                          <span className="cct-history-row__duration">
                            <Clock size={12} />
                            {formatDuration(session.duration)}
                          </span>
                          <span className="cct-history-row__score" style={{ color: scoreColor(session.overallScore) }}>
                            {session.overallScore}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {viewState === 'LIVE' && (
        <button type="button" className="cct-cheat-fab" onClick={() => setCheatOpen(true)}>
          <Sparkles size={14} />
          Cheat sheet
        </button>
      )}

      <CheatSheetPanel
        open={cheatOpen}
        onClose={() => setCheatOpen(false)}
        sections={cheatSections}
        loading={cheatLoading}
        productUrl={cheatProductUrl}
        trainingImages={cheatTrainingImages}
        trainingVideoUrl={cheatTrainingVideoUrl}
      />
    </div>
  );
}
