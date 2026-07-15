'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useXaiTrainerRealtime } from '@/hooks/useXaiTrainerRealtime';
import { useLiveCoach } from '@/hooks/useLiveCoach';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import { formatDuration, scoreColor } from '@/lib/trainer/session-utils';
import Toggle from '@/components/ui/Toggle';
import Modal from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PagePrimitives';
import CheatSheetPanel, { type CheatSheetSection } from '@/components/CheatSheetPanel';
import FloatingCallWidget, { type CallDisposition } from '@/components/FloatingCallWidget';
import CallWrapUpPanel from '@/components/CallWrapUpPanel';
import SessionTranscript from '@/components/SessionTranscript';
import { useShell } from '@/components/ShellProvider';
import { parseHooks as parseHooksPayload, resolveProspectIntel, getGrade, formatRelativeReview, scoreTone, healthTone, signalTone } from '@/lib/prospect-intel';
import {
  TRAINER_VOICES,
  trainerVoiceLabel,
  type TrainerVoiceId,
} from '@/lib/trainer/voices';

type Difficulty = 'easy' | 'medium' | 'hard';
type LeadTab = 'training' | 'brand';

const TRAINING_PAGE_SIZE = 8;

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
  enrichmentStatus?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  bookingUrlFound?: string | null;
  outreachReady?: boolean | null;
}

interface Scorecard {
  overallScore: number;
  scores: Record<string, number>;
  feedback: { strengths: string[]; improvements: string[] };
  summary: string;
}

const FOCUS_OPTIONS = Object.entries(FOCUS_LABELS) as [FocusArea, string][];

function parseHooks(hooksJSON?: string | null): string[] {
  return parseHooksPayload(hooksJSON).slice(0, 4);
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
    enrichmentStatus: (raw.enrichmentStatus as string | null) ?? null,
    reviewRating:
      typeof raw.reviewRating === 'number' ? raw.reviewRating : null,
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : null,
    bookingUrlFound: (raw.bookingUrlFound as string | null) ?? null,
    outreachReady:
      typeof raw.outreachReady === 'boolean' ? raw.outreachReady : null,
  };
}

export default function TrainerView() {
  const searchParams = useSearchParams();
  const shell = useShell();
  const [focus, setFocus] = useState<FocusArea>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gatekeeperVoice, setGatekeeperVoice] = useState<TrainerVoiceId>('ara');
  const [bossVoice, setBossVoice] = useState<TrainerVoiceId>('sal');
  const [soloVoice, setSoloVoice] = useState<TrainerVoiceId>('leo');
  const [coachOn, setCoachOn] = useState(true);
  const [trainingLeads, setTrainingLeads] = useState<ProspectRow[]>([]);
  const [trainingHasMore, setTrainingHasMore] = useState(false);
  const [brandLeads, setBrandLeads] = useState<ProspectRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const queueRetryRef = useRef(false);
  const [leadTab, setLeadTab] = useState<LeadTab>('training');
  const [practiceRotate, setPracticeRotate] = useState(0);
  const [contextTab, setContextTab] = useState<'intel' | 'details'>('intel');
  const [detailsDraft, setDetailsDraft] = useState({
    ownerName: '',
    ownerTitle: '',
    phone: '',
    notes: '',
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
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
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(
    () => shell?.metrics.minutesRemaining ?? null
  );
  const [scriptSections, setScriptSections] = useState<CheatSheetSection[]>([]);
  const [cheatProductUrl, setCheatProductUrl] = useState<string | undefined>();
  const [cheatTrainingImages, setCheatTrainingImages] = useState<string[]>([]);
  const [cheatTrainingVideoUrl, setCheatTrainingVideoUrl] = useState<string | undefined>();
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('Ready');
  const [configOpen, setConfigOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [wrapNotes, setWrapNotes] = useState('');
  const [wrapDisposition, setWrapDisposition] = useState<CallDisposition | null>(null);
  const [wrapSaving, setWrapSaving] = useState(false);
  const [wrapDuration, setWrapDuration] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [lastTranscriptText, setLastTranscriptText] = useState('');
  const [mobilePane, setMobilePane] = useState<'queue' | 'dial' | 'intel'>('dial');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingClipId, setRecordingClipId] = useState<string | null>(null);
  const endingCallRef = useRef(false);
  const recordingObjectUrlRef = useRef<string | null>(null);
  const [coachLog, setCoachLog] = useState<
    { atSeconds: number; prospectText: string; suggestion: string }[]
  >([]);

  const onError = useCallback((message: string) => setError(message), []);

  const endAndScoreRef = useRef<() => Promise<void>>(async () => {});

  const realtime = useXaiTrainerRealtime({
    onError,
    onCallEnded: () => {
      setPhaseLabel('Ended');
      if (!endingCallRef.current) {
        void endAndScoreRef.current();
      }
    },
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

  useEffect(() => {
    if (!selected) return;
    setDetailsDraft({
      ownerName: selected.ownerName || '',
      ownerTitle: selected.ownerTitle || '',
      phone: selected.phone || '',
      notes: selected.notes || '',
    });
  }, [selected?.id]);

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
    setQueueLoading(true);
    try {
      const [trainingRes, brandRes] = await Promise.all([
        fetch(
          `/api/prospects?training=1&limit=${TRAINING_PAGE_SIZE}&skip=0&rotate=${practiceRotate}`
        ),
        fetch(`/api/prospects?dialable=1&limit=${TRAINING_PAGE_SIZE}`),
      ]);

      if (trainingRes.ok) {
        const data = await trainingRes.json();
        const rows = (data.prospects || []).map((p: Record<string, unknown>) =>
          mapLead(p, 'training')
        );
        setTrainingLeads(rows);
        setTrainingHasMore(false);
        if (rows[0]?.id) {
          setProspectId((current) =>
            rows.some((r: ProspectRow) => r.id === current) ? current : rows[0].id
          );
        }
      } else {
        const legacy = await fetch('/api/prospects/search');
        if (legacy.ok) {
          const data = await legacy.json();
          const rows = (data.prospects || [])
            .map((p: Record<string, unknown>) => mapLead(p, 'training'))
            .slice(0, TRAINING_PAGE_SIZE);
          setTrainingLeads(rows);
          setTrainingHasMore(false);
        }
      }

      if (brandRes.ok) {
        const data = await brandRes.json();
        const rows = (data.prospects || [])
          .map((p: Record<string, unknown>) => mapLead(p, 'brand'))
          .slice(0, TRAINING_PAGE_SIZE);
        setBrandLeads(rows);
        if (rows.length > 0 && searchParams.get('tab') === 'brand') {
          setLeadTab('brand');
        }
      }
    } finally {
      setQueueLoading(false);
    }
  }, [searchParams, practiceRotate]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  // First visit may seed demos server-side — retry once if the queue is still empty.
  useEffect(() => {
    if (queueLoading || leadTab !== 'training') return;
    if (trainingLeads.length > 0 || queueRetryRef.current) return;
    queueRetryRef.current = true;
    const t = window.setTimeout(() => {
      void loadLeads();
    }, 900);
    return () => window.clearTimeout(t);
  }, [queueLoading, leadTab, trainingLeads.length, loadLeads]);

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

  const filteredPlaybooks = selectedBrandId
    ? playbooks.filter((p) => p.brandId === selectedBrandId)
    : playbooks;

  function pickPlaybookForBrand(brandId: string | null | undefined, preferredId?: string) {
    const pool = brandId
      ? playbooks.filter((p) => p.brandId === brandId)
      : playbooks.filter((p) => !p.brandId);
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
      return selectedBrandId ? p.brandId === selectedBrandId : true;
    });
    if (allowed) return;
    const preferred = selectedPack?.playbookId;
    const pool = selectedBrandId
      ? playbooks.filter((p) => p.brandId === selectedBrandId)
      : playbooks;
    const next =
      preferred && pool.some((p) => p.id === preferred) ? preferred : pool[0]?.id || '';
    setPlaybookId(next);
  }, [selectedBrandId, playbooks, playbookId, selectedPack?.playbookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trainer/script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focus,
            difficulty,
            prospectId: prospectId || undefined,
            playbookId: playbookId || undefined,
          }),
        });
        const d = await res.json();
        if (cancelled) return;

        setScriptSections(d.sections || []);
        let productUrl = typeof d.productUrl === 'string' ? d.productUrl : undefined;
        let trainingImages = Array.isArray(d.trainingImages)
          ? d.trainingImages.map(String)
          : [];
        let trainingVideoUrl =
          typeof d.trainingVideoUrl === 'string' ? d.trainingVideoUrl : undefined;

        // Fallback from playbook GET if script omitted product media.
        if (
          playbookId &&
          (!productUrl || !trainingImages.length || !trainingVideoUrl)
        ) {
          try {
            const pbRes = await fetch(`/api/playbooks/${playbookId}`);
            if (pbRes.ok) {
              const pbData = await pbRes.json();
              const content = JSON.parse(pbData?.playbook?.contentJSON || '{}');
              if (!productUrl && typeof content.productUrl === 'string') {
                productUrl = content.productUrl;
              }
              if (!trainingImages.length && Array.isArray(content.trainingImages)) {
                trainingImages = content.trainingImages.map(String);
              }
              if (!trainingVideoUrl && typeof content.trainingVideoUrl === 'string') {
                trainingVideoUrl = content.trainingVideoUrl;
              }
            }
          } catch {
            /* ignore fallback */
          }
        }

        if (cancelled) return;
        setCheatProductUrl(productUrl);
        setCheatTrainingImages(trainingImages);
        setCheatTrainingVideoUrl(trainingVideoUrl);
      } catch {
        if (!cancelled) {
          setScriptSections([]);
          setCheatProductUrl(undefined);
          setCheatTrainingImages([]);
          setCheatTrainingVideoUrl(undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
    setRecapOpen(false);
    setWrapOpen(false);
    setWrapDisposition(null);
    setWrapNotes('');
    setScoring(false);
    setPointsEarned(null);
    setEarnedBadge(null);
    setSessionId(null);
    setCoachLog([]);
    setLastTranscriptText('');
    setRecordingClipId(null);
    if (recordingObjectUrlRef.current) {
      URL.revokeObjectURL(recordingObjectUrlRef.current);
      recordingObjectUrlRef.current = null;
    }
    setRecordingUrl(null);

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
      voice: focus === 'standard' || focus === 'budget_500' ? gatekeeperVoice : soloVoice,
      gatekeeperVoice,
      bossVoice: focus === 'pen_pitch' ? 'rex' : bossVoice,
      brandId: selectedPack?.brandId,
      packId: selectedPack?.packId || undefined,
      playbookId: playbookId || undefined,
      userId: userId || undefined,
      orgId: orgId || undefined,
      gateToken,
      // Always send selected lead so training prospects (platform-owned) still drive persona
      prospectOverride: selected
        ? {
            companyName: selected.companyName,
            industry: selected.industry || undefined,
            city: selected.city || undefined,
            state: selected.state || undefined,
            ownerName: selected.ownerName || undefined,
            ownerTitle: selected.ownerTitle || undefined,
            hooks: parseHooks(selected.hooksJSON),
            hasWebsite: Boolean(selected.website),
          }
        : undefined,
    });
    if (!ok) {
      setPhaseLabel('Ready');
      setCallStartedAt(null);
    }
  }

  async function endAndScore() {
    if (endingCallRef.current) return;
    endingCallRef.current = true;

    const transcriptSnapshot = realtime.transcript;
    const transcriptText = transcriptSnapshot
      .map((e) => `${e.role.toUpperCase()}: ${e.text}`)
      .join('\n');
    const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : 0;
    const coachLogSnapshot = [...coachLog];

    // Show wrap-up immediately — don't wait on scoring.
    setLastTranscriptText(transcriptText);
    setWrapDuration(duration);
    setWrapNotes('');
    setWrapOpen(true);
    setRecapOpen(false);
    setScorecard(null);
    setPointsEarned(null);
    setEarnedBadge(null);
    setEarnedCert(null);
    setBountiesCleared([]);
    setSessionId(null);
    setRecordingClipId(null);
    if (recordingObjectUrlRef.current) {
      URL.revokeObjectURL(recordingObjectUrlRef.current);
      recordingObjectUrlRef.current = null;
    }
    setRecordingUrl(null);
    setPhaseLabel('Scoring…');
    setScoring(true);
    setCallStartedAt(null);

    const audioBlob = await realtime.stopRecording();
    realtime.disconnect();

    if (audioBlob && audioBlob.size > 1000) {
      const objUrl = URL.createObjectURL(audioBlob);
      recordingObjectUrlRef.current = objUrl;
      setRecordingUrl(objUrl);
    }

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
          coachLog: coachLogSnapshot,
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
      if (data.notice) setError(null);
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
          if (up.ok && upData.uploadUrl) {
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
                setRecordingClipId(upData.clipId);
                setRecordingUrl(`/api/clips/media?clipId=${encodeURIComponent(upData.clipId)}`);
                if (recordingObjectUrlRef.current) {
                  URL.revokeObjectURL(recordingObjectUrlRef.current);
                  recordingObjectUrlRef.current = null;
                }
                setPhaseLabel('Scored · recording saved');
              } else {
                setPhaseLabel('Scored');
              }
            } else {
              setPhaseLabel('Scored');
            }
          } else {
            setPhaseLabel('Scored');
          }
        } catch {
          setPhaseLabel('Scored');
        }
      } else {
        setPhaseLabel('Scored');
      }
    } catch (e: any) {
      setError(e.message);
      setPhaseLabel('Ready');
    } finally {
      setScoring(false);
      setBusy(false);
      endingCallRef.current = false;
    }
  }

  endAndScoreRef.current = endAndScore;

  function applyLeadPatch(next: {
    id: string;
    companyName: string;
    ownerName?: string | null;
    ownerTitle?: string | null;
    phone?: string | null;
    website?: string | null;
    industry?: string | null;
    city?: string | null;
    state?: string | null;
    notes?: string | null;
  }) {
    const patch = (rows: ProspectRow[]) =>
      rows.map((r) =>
        r.id === next.id
          ? {
              ...r,
              companyName: next.companyName,
              ownerName: next.ownerName,
              ownerTitle: next.ownerTitle,
              phone: next.phone,
              website: next.website,
              industry: next.industry,
              city: next.city,
              state: next.state,
              notes: next.notes,
            }
          : r
      );
    setTrainingLeads(patch);
    setBrandLeads(patch);
  }

  function openLeadRecord() {
    setContextTab('details');
  }

  function advanceToNextLead() {
    if (!queue.length) return;
    const idx = queue.findIndex((p) => p.id === prospectId);
    const atEnd = idx < 0 || idx >= queue.length - 1;
    if (atEnd && leadTab === 'training') {
      // Finished this window of 8 — rotate into the next slice of the ~100 catalog.
      setPracticeRotate((r) => r + 1);
      return;
    }
    const next = atEnd ? queue[0] : queue[idx + 1];
    if (next) {
      setProspectId(next.id);
      setContextTab('intel');
    }
  }

  async function saveLeadDetailsInline() {
    if (!selected) return;
    setDetailsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: detailsDraft.ownerName.trim() || null,
          ownerTitle: detailsDraft.ownerTitle.trim() || null,
          phone: detailsDraft.phone.trim() || null,
          notes: detailsDraft.notes.trim() || null,
          source: 'practice_details',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save lead details');
      applyLeadPatch({
        id: selected.id,
        companyName: selected.companyName,
        ownerName: detailsDraft.ownerName.trim() || null,
        ownerTitle: detailsDraft.ownerTitle.trim() || null,
        phone: detailsDraft.phone.trim() || null,
        website: selected.website,
        industry: selected.industry,
        city: selected.city,
        state: selected.state,
        notes: detailsDraft.notes.trim() || null,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save lead details');
    } finally {
      setDetailsSaving(false);
    }
  }

  async function savePracticeWrap() {
    if (!wrapDisposition) return;
    setWrapSaving(true);
    try {
      if (sessionId) {
        await fetch(`/api/trainer/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: wrapDisposition,
            wrapNotes: wrapNotes.trim() || null,
          }),
        });
      }
      if (prospectId) {
        const noteLine = `[${wrapDisposition.replace(/_/g, ' ')}] ${wrapNotes.trim()}`.trim();
        const baseNotes = selected?.notes || '';
        const mergedNotes = [baseNotes, noteLine].filter(Boolean).join('\n').slice(0, 4000);
        const res = await fetch(`/api/prospects/${prospectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: mergedNotes || null,
            source: 'practice_wrap',
            ...(leadTab === 'brand'
              ? {
                  disposition: wrapDisposition,
                  applyQueueFollowUp: true,
                }
              : {}),
          }),
        });
        if (res.ok && selected) {
          applyLeadPatch({
            id: selected.id,
            companyName: selected.companyName,
            ownerName: selected.ownerName,
            ownerTitle: selected.ownerTitle,
            phone: selected.phone,
            website: selected.website,
            industry: selected.industry,
            city: selected.city,
            state: selected.state,
            notes: mergedNotes,
          });
        }
      }
      setWrapOpen(false);
      setWrapDisposition(null);
      setRecapOpen(true);
      advanceToNextLead();
      if (leadTab === 'brand') {
        void loadLeads();
      }
    } catch (e: any) {
      setError(e.message || 'Could not save wrap-up');
    } finally {
      setWrapSaving(false);
    }
  }

  function skipPracticeWrap() {
    setWrapOpen(false);
    setWrapDisposition(null);
    setRecapOpen(true);
    advanceToNextLead();
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
  const intel = selected
    ? resolveProspectIntel(selected.hooksJSON, {
        purpose: selected.purpose,
        companyName: selected.companyName,
        website: selected.website,
        phone: selected.phone,
      })
    : null;
  const webGrade = getGrade(intel?.webEvoScore);
  const lastReview = formatRelativeReview(intel?.lastReviewAt);
  const liveOnLead = realtime.isConnected && selected?.id === prospectId;
  const focusLabel = FOCUS_LABELS[focus] || focus;
  const voiceSummary =
    focus === 'standard' || focus === 'budget_500'
      ? `${trainerVoiceLabel(gatekeeperVoice)} → ${trainerVoiceLabel(bossVoice)}`
      : trainerVoiceLabel(soloVoice);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = transcriptScrollRef.current;
    const end = transcriptEndRef.current;
    if (!scroller || !end) return;
    // Reserve space below the latest bubble so it lands above the coach margin.
    const top = end.offsetTop - scroller.clientHeight + end.offsetHeight + 72;
    scroller.scrollTop = Math.max(0, top);
  }, [realtime.transcript.length]);

  return (
    <div className="app-page app-page--desk">
      <PageHeader
        compact
        eyebrow="Intelligence"
        title="Cold Call Trainer"
        description="AI-powered practice simulator — configure a scenario, pick a lead, then call."
        actions={
          <>
            <Link href="/sessions" className="btn-ghost">
              Past calls
            </Link>
            <Link href="/cold_calls" className="btn-ghost">
              Cold Call
            </Link>
            <Link href="/subscribe/sdr" className="btn-ghost">
              Minutes
            </Link>
          </>
        }
      />

      <div className="cc-desk-config-bar" aria-label="Session summary">
        <div className="cc-desk-config-bar__summary">
          <span className="cc-desk-config-bar__chip">
            <em>Difficulty</em> {difficulty}
          </span>
          <span className="cc-desk-config-bar__chip">
            <em>Scenario</em> {focusLabel}
          </span>
          <span className="cc-desk-config-bar__chip">
            <em>Voices</em> {voiceSummary}
          </span>
          {selectedPack ? (
            <span className="cc-desk-config-bar__chip">
              <em>Pack</em> {selectedPack.brandName}
            </span>
          ) : null}
          <button
            type="button"
            className={`cc-desk-config-bar__toggle cc-desk-config-bar__toggle--coach${coachOn ? ' is-on' : ' is-off'}`}
            aria-pressed={coachOn}
            title={
              coachOn
                ? 'Live coach on — say-next tips during the call'
                : 'Live coach off — no in-call tips'
            }
            onClick={() => setCoachOn((v) => !v)}
          >
            <span className="cc-desk-config-bar__toggle-dot" aria-hidden />
            <span className="cc-desk-config-bar__toggle-label">Coach</span>
            <span className="cc-desk-config-bar__toggle-state">{coachOn ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            className="cc-desk-config-bar__tag"
            onClick={() => setCheatSheetOpen(true)}
          >
            Playbook
          </button>
          {selected ? (
            <span className="cc-desk-config-bar__context">
              Context · <strong>{selected.companyName}</strong>
            </span>
          ) : (
            <span className="cc-desk-config-bar__context muted">Select a lead to personalize</span>
          )}
        </div>
        <div className="cc-desk-config-bar__actions">
          <button
            type="button"
            className="btn-ghost cc-desk-config-bar__btn"
            onClick={() => setConfigOpen(true)}
            disabled={realtime.isConnected}
          >
            Configure practice
          </button>
        </div>
      </div>

      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure practice"
        description="Difficulty, scenario, and voice cast for this session."
        wide
      >
        <div className="cc-desk-config cc-desk-config--modal" aria-label="Session config">
          <div className="cc-desk-config__row">
            <div className="cc-desk-config__group">
              <span className="cc-desk-config__label">Difficulty</span>
              <div className="cc-desk-pills" role="group" aria-label="Difficulty">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`cc-desk-pill${difficulty === level ? ' is-active' : ''}`}
                    onClick={() => setDifficulty(level)}
                    disabled={realtime.isConnected}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <label className="cc-desk-config__field cc-desk-config__field--grow">
              <span>Scenario focus</span>
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
              <span>Brand / pack</span>
              <select
                value={packKey}
                onChange={(e) => onPackKeyChange(e.target.value)}
                disabled={realtime.isConnected}
              >
                <option value="">None — generic practice</option>
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
                    {p.brandName ? `${p.brandName} · ${p.title}` : p.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="cc-desk-config__toggles">
              <Toggle
                compact
                inline
                checked={coachOn}
                onChange={setCoachOn}
                label="Live coach (say-next tips)"
              />
            </div>
          </div>

          <div className="cc-desk-config__voices">
            <span className="cc-desk-config__label">
              {focus === 'standard' || focus === 'budget_500'
                ? 'Voice cast'
                : 'Voice persona'}
            </span>
            {focus === 'standard' || focus === 'budget_500' ? (
              <div className="cc-desk-voice-cast">
                <div className="cc-desk-voice-cast__col">
                  <span className="cc-desk-voice-cast__role">Gatekeeper</span>
                  <div className="cc-desk-voices" role="group" aria-label="Gatekeeper voice">
                    {TRAINER_VOICES.map((v) => (
                      <button
                        key={`gk-${v.id}`}
                        type="button"
                        className={`cc-desk-voice${gatekeeperVoice === v.id ? ' is-active' : ''}`}
                        onClick={() => setGatekeeperVoice(v.id)}
                        disabled={realtime.isConnected}
                        title={`${v.label} (${v.hint})`}
                      >
                        <strong>{v.label}</strong>
                        <span>{v.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cc-desk-voice-cast__col">
                  <span className="cc-desk-voice-cast__role">Decision maker</span>
                  <div className="cc-desk-voices" role="group" aria-label="Decision maker voice">
                    {TRAINER_VOICES.map((v) => (
                      <button
                        key={`boss-${v.id}`}
                        type="button"
                        className={`cc-desk-voice${bossVoice === v.id ? ' is-active' : ''}`}
                        onClick={() => setBossVoice(v.id)}
                        disabled={realtime.isConnected}
                        title={`${v.label} (${v.hint})`}
                      >
                        <strong>{v.label}</strong>
                        <span>{v.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cc-desk-voices" role="group" aria-label="Voice persona">
                {TRAINER_VOICES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`cc-desk-voice${soloVoice === v.id ? ' is-active' : ''}`}
                    onClick={() => setSoloVoice(v.id)}
                    disabled={realtime.isConnected}
                    title={`${v.label} (${v.hint})`}
                  >
                    <strong>{v.label}</strong>
                    <span>{v.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <p className="cc-desk-config__context-ok">
              Context loaded — <strong>{selected.companyName}</strong> will drive the prospect persona.
            </p>
          )}

          <div className="cc-desk-config__footer">
            <button type="button" className="btn" onClick={() => setConfigOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      <div className="cc-desk" data-mobile-pane={mobilePane}>
        <div className="cc-desk__mobile-tabs" role="tablist" aria-label="Practice panels">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'queue'}
            className={`cc-desk__mobile-tab${mobilePane === 'queue' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('queue')}
          >
            Queue
            <span className="cc-desk__mobile-tab-count">
              {leadTab === 'brand' ? brandLeads.length : trainingLeads.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'dial'}
            className={`cc-desk__mobile-tab${mobilePane === 'dial' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('dial')}
          >
            Practice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'intel'}
            className={`cc-desk__mobile-tab${mobilePane === 'intel' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('intel')}
          >
            Intel
          </button>
        </div>

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
                  Practice
                  <span className="cc-desk__tab-count">
                    {trainingLeads.length}
                    {trainingHasMore ? '+' : ''}
                  </span>
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
                <strong>Call queue</strong>
                <span className="cc-desk__tab-count">{queue.length}</span>
              </>
            )}
          </div>

          <div className="cc-desk__col-body">
            {queue.length === 0 ? (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">
                  {leadTab === 'brand'
                    ? 'No brand leads'
                    : queueLoading
                      ? 'Loading practice leads'
                      : 'No practice leads'}
                </p>
                <p className="cc-desk__gate-desc">
                  {leadTab === 'brand'
                    ? 'Accepted campaign leads appear here for AI practice personalization.'
                    : queueLoading
                      ? 'Preparing your practice queue…'
                      : 'Practice leads did not load. Try again, or pick a brand playbook under Configure practice.'}
                </p>
                {leadTab === 'brand' ? (
                  <Link href="/gigs" className="btn-ghost">
                    Browse brand deals →
                  </Link>
                ) : queueLoading ? null : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn" onClick={() => void loadLeads()}>
                      Try again
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setConfigOpen(true)}
                    >
                      Configure practice
                    </button>
                  </div>
                )}
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
                        onClick={() => {
                          if (realtime.isConnected) return;
                          setProspectId(p.id);
                          setMobilePane('dial');
                        }}
                        disabled={realtime.isConnected && !isSelected}
                      >
                        <span className="cc-desk__row-main">
                          <span className="cc-desk__row-name">{p.companyName}</span>
                          <span className="cc-desk__row-meta">
                            {p.ownerName || p.industry || '—'}
                            {p.city ? ` · ${p.city}` : ''}
                          </span>
                          {p.brandName ? (
                            <span className="cc-desk__row-phone">
                              {p.purpose === 'training'
                                ? `Sell · ${p.brandName.replace(/^Demo ·\s*/i, '')}`
                                : p.brandName}
                            </span>
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
        </section>
        {/* Center: transcript / wrap-up */}
        <section className="cc-desk__col cc-desk__dialer" aria-label="AI voice session">
          <div className="cc-desk__col-head">
            <strong>Practice simulator</strong>
            <span className="cc-desk__status muted">
              {wrapOpen
                ? 'Wrap-up'
                : phaseLabel}
              {realtime.isConnected ? ` · ${formatDuration(durationSecs)}` : ''}
            </span>
          </div>

          <div className="cc-desk__col-body cc-desk__dialer-body">
            {error && (
              <p className="cc-desk__error" role="alert">
                {error}
                {error.toLowerCase().includes('minute') && (
                  <>
                    {' '}
                    <Link href="/subscribe/sdr">Upgrade →</Link>
                  </>
                )}
              </p>
            )}

            {wrapOpen ? (
              <CallWrapUpPanel
                companyName={selected?.companyName || 'Practice call'}
                durationSecs={wrapDuration}
                scorePending={scoring}
                notes={wrapNotes}
                onNotesChange={setWrapNotes}
                disposition={wrapDisposition}
                onDisposition={setWrapDisposition}
                onSave={() => void savePracticeWrap()}
                onSkip={skipPracticeWrap}
                onEditLead={selected ? openLeadRecord : undefined}
                saving={wrapSaving}
                mode="practice"
              />
            ) : (
              <>
                {!realtime.isConnected && selected ? (
                  <div className="cc-desk__start-strip">
                    {minutesRemaining != null && minutesRemaining <= 0 ? (
                      <Link href="/subscribe/sdr" className="btn cc-desk__call-btn">
                        Upgrade minutes
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn cc-desk__call-btn"
                        onClick={() => void startCall()}
                        disabled={busy}
                      >
                        Start practice call
                      </button>
                    )}
                  </div>
                ) : null}

                {!selected && !realtime.isConnected ? (
                  <div className="cc-desk__idle">
                    <p className="cc-desk__gate-title">Select a lead</p>
                    <p className="cc-desk__gate-desc">
                      Pick a practice or brand lead from the queue, then start the call.
                    </p>
                  </div>
                ) : null}

                <div className="cc-desk__dialer-live">
                  <div
                    className="cc-desk__transcript"
                    aria-live="polite"
                    ref={transcriptScrollRef}
                  >
                    {realtime.transcript.length === 0 ? (
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                        {realtime.isConnected
                          ? 'Listening… transcript appears as you talk.'
                          : 'Transcript appears here once the call starts.'}
                      </p>
                    ) : (
                      realtime.transcript.map((entry) => {
                        const isUser = entry.role === 'user';
                        return (
                          <div
                            key={`${entry.id}-${entry.seq}`}
                            className={`bubble bubble--${entry.role}${isUser ? ' bubble--right' : ' bubble--left'}`}
                          >
                            <strong>{entry.role.replace(/_/g, ' ')}</strong>
                            <span>{entry.text}</span>
                          </div>
                        );
                      })
                    )}
                    <div ref={transcriptEndRef} className="cc-desk__transcript-end" aria-hidden />
                    <div className="cc-desk__transcript-pad" aria-hidden />
                  </div>

                  <div className="cc-desk__coach-slot">
                    {coachOn && coach.visible && coach.sayNext ? (
                      <div className="cc-desk__coach" role="status">
                        <strong>
                          Coach whisper
                          {coach.source === 'llm'
                            ? ' · AI'
                            : coach.source === 'instant'
                              ? ' · quick tip'
                              : ''}
                        </strong>
                        <p>{coach.sayNext}</p>
                      </div>
                    ) : (
                      <div className="cc-desk__coach is-empty" aria-hidden />
                    )}
                  </div>
                </div>

                {scorecard && !recapOpen && !realtime.isConnected && !wrapOpen ? (
                  <div className="cc-desk__recap-actions">
                    <button type="button" className="btn-ghost" onClick={() => setRecapOpen(true)}>
                      View call recap
                    </button>
                    <Link href="/sessions" className="btn-ghost">
                      Past calls
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* Right: context */}
        <section className="cc-desk__col cc-desk__context" aria-label="Lead context">
          <div className="cc-desk__col-head">
            <strong>{contextTab === 'details' ? 'Lead details' : 'Lead intel'}</strong>
            {selected ? (
              <div className="cc-desk__ctx-tabs" role="tablist" aria-label="Lead panels">
                <button
                  type="button"
                  role="tab"
                  aria-selected={contextTab === 'intel'}
                  className={`cc-desk__ctx-tab${contextTab === 'intel' ? ' is-active' : ''}`}
                  onClick={() => setContextTab('intel')}
                >
                  Intel
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={contextTab === 'details'}
                  className={`cc-desk__ctx-tab${contextTab === 'details' ? ' is-active' : ''}`}
                  onClick={() => setContextTab('details')}
                >
                  Details
                </button>
              </div>
            ) : null}
          </div>
          <div className="cc-desk__col-body">
            {selected && contextTab === 'details' ? (
              <div className="cc-desk__details-form">
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                  Edit without leaving the call — practice state stays live.
                </p>
                <label>
                  Contact
                  <input
                    value={detailsDraft.ownerName}
                    onChange={(e) =>
                      setDetailsDraft((d) => ({ ...d, ownerName: e.target.value }))
                    }
                    placeholder="Name"
                  />
                </label>
                <label>
                  Title
                  <input
                    value={detailsDraft.ownerTitle}
                    onChange={(e) =>
                      setDetailsDraft((d) => ({ ...d, ownerTitle: e.target.value }))
                    }
                    placeholder="CRO, Owner…"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={detailsDraft.phone}
                    onChange={(e) =>
                      setDetailsDraft((d) => ({ ...d, phone: e.target.value }))
                    }
                    placeholder="+1…"
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={detailsDraft.notes}
                    onChange={(e) =>
                      setDetailsDraft((d) => ({ ...d, notes: e.target.value }))
                    }
                    placeholder="Gatekeeper, best time, follow-up…"
                  />
                </label>
                <div className="cc-desk__details-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={detailsSaving}
                    onClick={() => void saveLeadDetailsInline()}
                  >
                    {detailsSaving ? 'Saving…' : 'Save details'}
                  </button>
                  <Link
                    href={`/leads/${selected.id}?from=practice`}
                    className="soft-link"
                    onClick={(e) => {
                      if (realtime.isConnected) {
                        e.preventDefault();
                        setError('End the call before opening the full lead page.');
                      }
                    }}
                  >
                    Full lead page →
                  </Link>
                </div>
              </div>
            ) : selected ? (
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
                      <dt>Phone</dt>
                      <dd>{selected.phone || intel?.googlePhone || '—'}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        {[selected.city, selected.state].filter(Boolean).join(', ') ||
                          intel?.address ||
                          '—'}
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

                {intel ? (
                  <div className="cc-desk__ctx-block">
                    <h4 className="cc-desk__ctx-label">Enrichment</h4>
                    <div className="cc-desk__enrich-scores" aria-label="Enrichment scores">
                      <div
                        className={`cc-desk__enrich-chip cc-desk__enrich-chip--${scoreTone(intel.score)}`}
                      >
                        <span>Trojan</span>
                        <strong>
                          {intel.score != null ? Math.round(intel.score) : '—'}
                        </strong>
                      </div>
                      <div
                        className={`cc-desk__enrich-chip cc-desk__enrich-chip--${healthTone(intel.health)}`}
                      >
                        <span>Health</span>
                        <strong>
                          {intel.health != null ? Math.round(intel.health) : '—'}
                        </strong>
                      </div>
                      <div
                        className={`cc-desk__enrich-chip cc-desk__enrich-chip--${webGrade.tone === 'warn' ? 'mid' : webGrade.tone}`}
                      >
                        <span>Site</span>
                        <strong>
                          {intel.webEvoScore != null
                            ? `${webGrade.grade} ${Math.round(intel.webEvoScore)}`
                            : '—'}
                        </strong>
                      </div>
                    </div>
                    <dl className="cc-desk__ctx-dl cc-desk__ctx-dl--dense">
                      {intel.cms ? (
                        <div>
                          <dt>CMS</dt>
                          <dd>{intel.cms}</dd>
                        </div>
                      ) : null}
                      {intel.copyrightYear ? (
                        <div>
                          <dt>© Year</dt>
                          <dd>{intel.copyrightYear}</dd>
                        </div>
                      ) : null}
                      {(selected.reviewRating != null || selected.reviewCount != null) && (
                        <div>
                          <dt>Reviews</dt>
                          <dd>
                            {selected.reviewRating != null
                              ? `${selected.reviewRating.toFixed(1)}★`
                              : '—'}
                            {selected.reviewCount != null
                              ? ` · ${selected.reviewCount}`
                              : ''}
                            {lastReview ? ` · ${lastReview}` : ''}
                          </dd>
                        </div>
                      )}
                      {!selected.reviewRating && lastReview ? (
                        <div>
                          <dt>Last review</dt>
                          <dd>{lastReview}</dd>
                        </div>
                      ) : null}
                      {(intel.bookingSystem || selected.bookingUrlFound) && (
                        <div>
                          <dt>Booking</dt>
                          <dd>{intel.bookingSystem || 'Link found'}</dd>
                        </div>
                      )}
                      {selected.enrichmentStatus ? (
                        <div>
                          <dt>Status</dt>
                          <dd>{selected.enrichmentStatus}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {intel.signals && intel.signals.length > 0 ? (
                      <div className="cc-desk__signals">
                        {intel.signals.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className={`cc-desk__signal cc-desk__signal--${signalTone(s)}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
              </>
            ) : (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">No lead selected</p>
                <p className="cc-desk__gate-desc">
                  Select a queue row to see enrichment vitals and hooks.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        title="Call recap"
        description={
          scoring
            ? 'Scoring your call…'
            : 'Score, transcript, and recording for this practice session.'
        }
        wide
      >
        <div className="cc-desk__scorecard">
          {scoring && !scorecard ? (
            <p className="muted" style={{ margin: 0 }}>
              Scoring in progress…
            </p>
          ) : null}

          {scorecard ? (
            <>
              <h2 style={{ color: scoreColor(scorecard.overallScore) }}>
                {scorecard.overallScore}/100
                {pointsEarned != null && <small> · +{pointsEarned} pts</small>}
              </h2>
              {earnedBadge && (
                <p style={{ color: 'var(--accent-2)', fontWeight: 600, margin: 0 }}>
                  Badge unlocked: {earnedBadge}
                </p>
              )}
              {earnedCert && (
                <p style={{ color: 'var(--accent-2)', fontWeight: 600, margin: 0 }}>
                  Certification: {earnedCert}
                </p>
              )}
              {bountiesCleared.length > 0 && (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                  Bounty cleared: {bountiesCleared.join(', ')}
                </p>
              )}
              <p style={{ margin: '0.35rem 0 0' }}>{scorecard.summary}</p>
              <div className="cc-desk__scorecard-grid">
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
            </>
          ) : !scoring ? (
            <p className="muted" style={{ margin: 0 }}>
              Score unavailable for this call.
            </p>
          ) : null}

          {recordingUrl ? (
            <div className="cc-desk__recap-audio">
              <h4>Recording</h4>
              <audio controls preload="metadata" src={recordingUrl} style={{ width: '100%' }}>
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : scoring ? (
            <p className="muted" style={{ fontSize: '0.82rem', margin: '0.5rem 0 0' }}>
              Recording will appear when ready.
            </p>
          ) : null}

          {lastTranscriptText ? (
            <div className="cc-desk__recap-transcript">
              <h4>Transcript</h4>
              <SessionTranscript transcript={lastTranscriptText} />
            </div>
          ) : null}

          <div className="cc-desk__scorecard-links">
            {sessionId && (
              <Link
                href={`/sessions/${sessionId}`}
                style={{ fontWeight: 600, color: 'var(--accent-2)' }}
              >
                View full session →
              </Link>
            )}
            {sessionId && scorecard && scorecard.overallScore >= 70 && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void createClipDraft()}
                disabled={busy}
              >
                Create clip draft
              </button>
            )}
            <Link href="/sessions" className="btn-ghost">
              Past calls
            </Link>
            <button type="button" className="btn" onClick={() => setRecapOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      <FloatingCallWidget
        open={realtime.isConnected && !wrapOpen}
        title={selected?.companyName || 'Practice call'}
        subtitle={
          selected
            ? [selected.ownerName, selected.ownerTitle].filter(Boolean).join(' · ')
            : undefined
        }
        statusLabel={
          realtime.isProspectSpeaking
            ? 'Prospect speaking'
            : realtime.isUserSpeaking
              ? 'You speaking'
              : phaseLabel
        }
        durationSecs={durationSecs}
        onEnd={() => void endAndScore()}
        endLabel="End & score"
        micEnabled={realtime.micEnabled}
        onToggleMic={() => realtime.setMicEnabled(!realtime.micEnabled)}
        dispositions
        onQuickDisposition={(id) => {
          setWrapDisposition(id);
          void endAndScore();
        }}
      />

      <CheatSheetPanel
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
        sections={scriptSections}
        productUrl={cheatProductUrl}
        trainingImages={cheatTrainingImages}
        trainingVideoUrl={cheatTrainingVideoUrl}
      />
    </div>
  );
}
