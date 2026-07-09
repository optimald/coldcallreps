export interface TrainerCoachLogEntry {
  atSeconds: number;
  prospectEntryId?: number;
  prospectText: string;
  suggestion: string;
  source?: string;
}

export interface TrainerSessionSummary {
  id: string;
  userId: string;
  prospectId: string | null;
  scenarioType: string;
  focusArea: string;
  overallScore: number;
  duration: number;
  createdAt: string;
  leadCompany?: string | null;
}

export interface TrainerSessionDetail extends TrainerSessionSummary {
  transcript: string;
  scorecard: Record<string, unknown> | null;
  coachLog: TrainerCoachLogEntry[];
}

const COACH_LOG_MARKER = '\n\n--- COACH LOG ---\n';

export function parseCoachLogFromTranscript(transcript: string): {
  callTranscript: string;
  coachLog: TrainerCoachLogEntry[];
} {
  const idx = transcript.indexOf(COACH_LOG_MARKER);
  if (idx < 0) {
    return { callTranscript: transcript, coachLog: [] };
  }

  const callTranscript = transcript.slice(0, idx).trim();
  const coachSection = transcript.slice(idx + COACH_LOG_MARKER.length);
  const coachLog: TrainerCoachLogEntry[] = [];

  for (const line of coachSection.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\[(\d+)s\]\s+After\s+"(.*)"\s+→\s+(.*)$/);
    if (match) {
      coachLog.push({
        atSeconds: parseInt(match[1], 10),
        prospectText: match[2],
        suggestion: match[3],
      });
    }
  }

  return { callTranscript, coachLog };
}

export function extractCoachLog(
  coachLogJSON: string | null | undefined,
  transcript: string
): TrainerCoachLogEntry[] {
  if (coachLogJSON) {
    try {
      const parsed = JSON.parse(coachLogJSON);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return parseCoachLogFromTranscript(transcript).coachLog;
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}
