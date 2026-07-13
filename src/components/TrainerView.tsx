'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { parseHooks as parseHooksPayload } from '@/lib/prospect-intel';
import {
  TRAINER_VOICES,
  trainerVoiceLabel,
  type TrainerVoiceId,
} from '@/lib/trainer/voices';

type Difficulty = 'easy' | 'medium' | 'hard';
type LeadTab = 'training' | 'brand';

const TRAINING_PAGE_SIZE = 20;

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
  };
}

export default function TrainerView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [focus, setFocus] = useState<FocusArea>('budget_500');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gatekeeperVoice, setGatekeeperVoice] = useState<TrainerVoiceId>('ara');
  const [bossVoice, setBossVoice] = useState<TrainerVoiceId>('sal');
  const [soloVoice, setSoloVoice] = useState<TrainerVoiceId>('leo');
  const [coachOn, setCoachOn] = useState(true);
  const [trainingLeads, setTrainingLeads] = useState<ProspectRow[]>([]);
  const [trainingHasMore, setTrainingHasMore] = useState(false);
  const [trainingTotal, setTrainingTotal] = useState<number | null>(null);
  const [trainingLoadingMore, setTrainingLoadingMore] = useState(false);
  const [brandLeads, setBrandLeads] = useState<ProspectRow[]>([]);
  const [leadTab, setLeadTab] = useState<LeadTab>('training');
  const [prospectId, setProspectId] = useState<string>('');
  const trainingSentinelRef = useRef<HTMLLIElement | null>(null);
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
      fetch(`/api/prospects?training=1&limit=${TRAINING_PAGE_SIZE}&skip=0`),
      fetch('/api/prospects?dialable=1&limit=80'),
    ]);

    if (trainingRes.ok) {
      const data = await trainingRes.json();
      setTrainingLeads(
        (data.prospects || []).map((p: Record<string, unknown>) => mapLead(p, 'training'))
      );
      setTrainingHasMore(Boolean(data.hasMore));
      setTrainingTotal(typeof data.total === 'number' ? data.total : null);
    } else {
      const legacy = await fetch('/api/prospects/search');
      if (legacy.ok) {
        const data = await legacy.json();
        const rows = (data.prospects || []).map((p: Record<string, unknown>) =>
          mapLead(p, 'training')
        );
        setTrainingLeads(rows);
        setTrainingHasMore(false);
        setTrainingTotal(rows.length);
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

  const loadMoreTrainingLeads = useCallback(async () => {
    if (trainingLoadingMore || !trainingHasMore) return;
    setTrainingLoadingMore(true);
    try {
      const skip = trainingLeads.length;
      const res = await fetch(
        `/api/prospects?training=1&limit=${TRAINING_PAGE_SIZE}&skip=${skip}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const next = (data.prospects || []).map((p: Record<string, unknown>) =>
        mapLead(p, 'training')
      ) as ProspectRow[];
      setTrainingLeads((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setTrainingHasMore(Boolean(data.hasMore));
      if (typeof data.total === 'number') setTrainingTotal(data.total);
    } finally {
      setTrainingLoadingMore(false);
    }
  }, [trainingHasMore, trainingLoadingMore, trainingLeads.length]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (leadTab !== 'training' || !trainingHasMore) return;
    const node = trainingSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreTrainingLeads();
        }
      },
      { root: node.closest('.cc-desk__col-body'), rootMargin: '80px', threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [leadTab, trainingHasMore, trainingLeads.length, loadMoreTrainingLeads]);

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
    if (!selected) return;
    // Always use the shared lead page from Practice — brand-scoped URLs
    // redirect non-managers back to /practice (looks like a flash).
    router.push(`/leads/${selected.id}?from=practice`);
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
  const focusLabel = FOCUS_LABELS[focus] || focus;
  const voiceSummary =
    focus === 'standard' || focus === 'budget_500'
      ? `${trainerVoiceLabel(gatekeeperVoice)} → ${trainerVoiceLabel(bossVoice)}`
      : trainerVoiceLabel(soloVoice);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [realtime.transcript.length, coach.visible, coach.sayNext]);

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
            <Link href="/billing" className="btn-ghost">
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
              <span>Brand pack</span>
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
                  Practice
                  <span className="cc-desk__tab-count">
                    {trainingTotal ?? trainingLeads.length}
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
                <span className="cc-desk__tab-count">
                  {trainingTotal ?? trainingLeads.length}
                </span>
              </>
            )}
          </div>

          <div className="cc-desk__col-body">
            {queue.length === 0 ? (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">
                  {leadTab === 'brand' ? 'No brand leads' : 'No practice leads'}
                </p>
                <p className="cc-desk__gate-desc">
                  {leadTab === 'brand'
                    ? 'Accepted campaign leads appear here for AI practice personalization.'
                    : 'Seed demo practice leads, then refresh — or browse brand deals for practice packs.'}
                </p>
                {leadTab === 'brand' ? (
                  <Link href="/gigs" className="btn-ghost">
                    Browse brand deals →
                  </Link>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link href="/gigs" className="btn-ghost">
                      Browse brand deals →
                    </Link>
                    <button type="button" className="btn-ghost" onClick={() => void loadLeads()}>
                      Refresh
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
                {leadTab === 'training' && trainingHasMore ? (
                  <li
                    ref={trainingSentinelRef}
                    className="cc-desk__load-more muted"
                    aria-hidden={!trainingLoadingMore}
                  >
                    {trainingLoadingMore ? 'Loading more…' : '\u00a0'}
                  </li>
                ) : null}
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
                    <Link href="/billing">Upgrade →</Link>
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

                <div className="cc-desk__transcript" aria-live="polite">
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
                  <div ref={transcriptEndRef} aria-hidden />
                </div>

                {coachOn && coach.visible && coach.sayNext && (
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
                )}

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
        <section className="cc-desk__col cc-desk__context" aria-label="Lead intel">
          <div className="cc-desk__col-head">
            <strong>Lead intel</strong>
            {selected ? (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                onClick={openLeadRecord}
              >
                Open record
              </button>
            ) : null}
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
              </>
            ) : (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">No lead selected</p>
                <p className="cc-desk__gate-desc">
                  Select a queue row to see contact details and hooks.
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
