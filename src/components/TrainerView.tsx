'use client';

import { useCallback, useEffect, useState } from 'react';
import { useXaiTrainerRealtime } from '@/hooks/useXaiTrainerRealtime';
import { useLiveCoach } from '@/hooks/useLiveCoach';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import { formatDuration, scoreColor } from '@/lib/trainer/session-utils';
import './ColdCallTrainerView.css';

type Difficulty = 'easy' | 'medium' | 'hard';

interface ProspectRow {
  id: string;
  companyName: string;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  industry?: string | null;
}

interface Scorecard {
  overallScore: number;
  scores: Record<string, number>;
  feedback: { strengths: string[]; improvements: string[] };
  summary: string;
}

const FOCUS_OPTIONS = Object.entries(FOCUS_LABELS) as [FocusArea, string][];

export default function TrainerView() {
  const [focus, setFocus] = useState<FocusArea>('budget_500');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [hintMode, setHintMode] = useState(true);
  const [coachOn, setCoachOn] = useState(true);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [prospectId, setProspectId] = useState<string>('');
  const [mapsQuery, setMapsQuery] = useState('plumbers');
  const [mapsLocation, setMapsLocation] = useState('Austin, TX');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [scriptSections, setScriptSections] = useState<{ title: string; points: string[] }[]>([]);
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

  const coach = useLiveCoach({
    enabled: coachOn,
    active: realtime.isConnected,
    transcript: realtime.transcript,
    phase: realtime.phase,
    gatekeeperName: realtime.gatekeeperName,
    decisionMakerName: realtime.decisionMakerName,
    companyName: prospects.find((p) => p.id === prospectId)?.companyName || 'the business',
    difficulty,
    isProspectSpeaking: realtime.isProspectSpeaking,
    isUserSpeaking: realtime.isUserSpeaking,
    callTimer: durationSecs,
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

  const loadProspects = useCallback(async () => {
    const res = await fetch('/api/prospects/search');
    if (!res.ok) return;
    const data = await res.json();
    setProspects(data.prospects || []);
    if (!prospectId && data.prospects?.[0]?.id) setProspectId(data.prospects[0].id);
  }, [prospectId]);

  useEffect(() => {
    loadProspects();
  }, [loadProspects]);

  useEffect(() => {
    fetch('/api/trainer/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focus,
        difficulty,
        prospectId: prospectId || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => setScriptSections(d.sections || []))
      .catch(() => {});
  }, [focus, difficulty, prospectId]);

  useEffect(() => {
    if (!realtime.isConnected) return;
    if (realtime.twoStage) {
      setPhaseLabel(realtime.phase === 'decision_maker' ? 'Decision Maker' : 'Gatekeeper');
    } else {
      setPhaseLabel('Live');
    }
  }, [realtime.isConnected, realtime.phase, realtime.twoStage]);

  async function searchMaps() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mapsQuery, location: mapsLocation, maxResults: 8 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      await loadProspects();
      if (data.saved?.[0]?.id) setProspectId(data.saved[0].id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function enrichUrl() {
    if (!websiteUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      await loadProspects();
      if (data.prospectId) setProspectId(data.prospectId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startCall() {
    setError(null);
    setScorecard(null);
    setPointsEarned(null);
    setCoachLog([]);
    setCallStartedAt(Date.now());
    setPhaseLabel('Connecting…');
    await realtime.connect({
      prospectId: prospectId || undefined,
      difficulty,
      focus,
      voice: 'ara',
      gatekeeperVoice: 'ara',
      bossVoice: focus === 'pen_pitch' ? 'rex' : 'sal',
      hintMode,
    });
  }

  async function endAndScore() {
    const transcriptText = realtime.transcript
      .map((e) => `${e.role.toUpperCase()}: ${e.text}`)
      .join('\n');
    const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : 0;
    realtime.disconnect();
    setPhaseLabel('Scoring…');
    setBusy(true);
    try {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Score failed');
      setScorecard(data.scorecard);
      setPointsEarned(data.pointsEarned ?? null);
      setPhaseLabel('Scored');
    } catch (e: any) {
      setError(e.message);
      setPhaseLabel('Ready');
    } finally {
      setBusy(false);
      setCallStartedAt(null);
    }
  }

  return (
    <div className="ccr-trainer">
      <div className="ccr-trainer__setup">
        <h1>Practice reps</h1>
        <p className="ccr-muted">Pick a prospect, choose a scenario, hit the phones.</p>

        <div className="ccr-grid2">
          <label>
            Scenario
            <select value={focus} onChange={(e) => setFocus(e.target.value as FocusArea)} disabled={realtime.isConnected}>
              {FOCUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
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
        </div>

        <div className="ccr-panel">
          <h3>Find prospects (Google Maps)</h3>
          <div className="ccr-grid2">
            <input value={mapsQuery} onChange={(e) => setMapsQuery(e.target.value)} placeholder="plumbers" />
            <input value={mapsLocation} onChange={(e) => setMapsLocation(e.target.value)} placeholder="Austin, TX" />
          </div>
          <button type="button" onClick={searchMaps} disabled={busy || realtime.isConnected}>
            Search Maps
          </button>
        </div>

        <div className="ccr-panel">
          <h3>Or paste a website</h3>
          <div className="ccr-row">
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <button type="button" onClick={enrichUrl} disabled={busy || realtime.isConnected}>
              Scrape hooks
            </button>
          </div>
        </div>

        <label>
          Prospect
          <select value={prospectId} onChange={(e) => setProspectId(e.target.value)} disabled={realtime.isConnected}>
            <option value="">Generic (no personalization)</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.companyName}
                {p.city ? ` — ${p.city}` : ''}
                {!p.website ? ' (no site)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="ccr-toggles">
          <label>
            <input type="checkbox" checked={hintMode} onChange={(e) => setHintMode(e.target.checked)} />
            Hint mode (easier transfers)
          </label>
          <label>
            <input type="checkbox" checked={coachOn} onChange={(e) => setCoachOn(e.target.checked)} />
            Live coach
          </label>
        </div>

        {!realtime.isConnected ? (
          <button type="button" className="ccr-primary" onClick={startCall} disabled={busy}>
            Start voice call
          </button>
        ) : (
          <div className="ccr-row">
            <button type="button" onClick={() => realtime.setMicEnabled(!realtime.micEnabled)}>
              Mic {realtime.micEnabled ? 'On' : 'Off'}
            </button>
            <button type="button" className="ccr-danger" onClick={endAndScore} disabled={busy}>
              End & score
            </button>
          </div>
        )}

        {error && <p className="ccr-error">{error}</p>}
      </div>

      <div className="ccr-trainer__live">
        <div className="ccr-status">
          <span className={realtime.isConnected ? 'live' : ''}>{phaseLabel}</span>
          {realtime.isConnected && <span>{formatDuration(durationSecs)}</span>}
          {realtime.isProspectSpeaking && <span className="speaking">Prospect speaking</span>}
        </div>

        <div className="ccr-transcript">
          {realtime.transcript.length === 0 && (
            <p className="ccr-muted">Transcript appears here once the call starts.</p>
          )}
          {realtime.transcript.map((entry) => (
            <div key={`${entry.id}-${entry.seq}`} className={`bubble bubble--${entry.role}`}>
              <strong>{entry.role}</strong>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>

        {coachOn && coach.visible && coach.sayNext && (
          <div className="ccr-coach">
            <strong>Coach whisper</strong>
            <p>{coach.sayNext}</p>
          </div>
        )}

        {scorecard && (
          <div className="ccr-scorecard">
            <h2 style={{ color: scoreColor(scorecard.overallScore) }}>
              {scorecard.overallScore}/100
              {pointsEarned != null && <small> · +{pointsEarned} pts</small>}
            </h2>
            <p>{scorecard.summary}</p>
            <div className="ccr-grid2">
              <div>
                <h4>Strengths</h4>
                <ul>
                  {(scorecard.feedback?.strengths || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Improve</h4>
                <ul>
                  {(scorecard.feedback?.improvements || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <details className="ccr-script">
          <summary>Cheat sheet</summary>
          {scriptSections.map((sec) => (
            <div key={sec.title}>
              <h4>{sec.title}</h4>
              <ul>
                {sec.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </div>
    </div>
  );
}
