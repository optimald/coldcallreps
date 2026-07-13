import { parseHooks } from '@/lib/prospect-intel';
import { isLeadOutreachReady, prospectToQcRecord } from '@/lib/enrichment-qc';

/** Founder-facing Match Progress states (abstracts enrichment + pipeline). */
export type MatchState = 'prepping' | 'dialing' | 'booked' | 'failed';

export type MatchLeadInput = {
  enrichmentStatus?: string | null;
  status?: string | null;
  hooksJSON?: string | null;
  source?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  outreachReady?: boolean | null;
};

export const MATCH_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'prepping', label: 'Prepping' },
  { value: 'dialing', label: 'Dialing' },
  { value: 'booked', label: 'Meeting Booked' },
] as const;

export function isLeadEnriched(lead: MatchLeadInput): boolean {
  if (lead.outreachReady) return true;
  if (lead.qualifyPhase3 && (lead.enrichmentStatus === 'done' || lead.enrichmentStatus === 'Completed')) {
    return true;
  }
  if (lead.enrichmentStatus === 'done') return true;
  return parseHooks(lead.hooksJSON).length > 0;
}

function isPipelineFailed(lead: MatchLeadInput): boolean {
  return (
    lead.enrichmentStatus === 'failed' ||
    lead.scrapeStatus === 'failed' ||
    (lead.webScanStatus === 'failed' && lead.enrichmentStatus === 'failed')
  );
}

function isStillPrepping(lead: MatchLeadInput): boolean {
  if (lead.outreachReady || isLeadEnriched(lead)) return false;
  const scrapeBusy =
    !lead.scrapeStatus ||
    lead.scrapeStatus === 'not_started' ||
    lead.scrapeStatus === 'queued' ||
    lead.scrapeStatus === 'in_progress';
  const webBusy =
    lead.webScanStatus === 'queued' ||
    lead.webScanStatus === 'in_progress' ||
    lead.enrichmentStatus === 'pending' ||
    lead.enrichmentStatus === 'none';
  return scrapeBusy || webBusy || !lead.qualifyPhase3;
}

/**
 * Map Prospect phase fields into founder labels.
 * Prepping = Phases 1–3 still running / not dial-ready.
 * Dialing = outreach-ready (or enriched) and in SDR queue.
 * Meeting Booked = terminal success (status done).
 */
export function matchStateOf(lead: MatchLeadInput): MatchState {
  if (lead.status === 'done') return 'booked';
  if (isPipelineFailed(lead)) return 'failed';

  const ready =
    lead.outreachReady === true ||
    isLeadOutreachReady(prospectToQcRecord(lead)) ||
    (isLeadEnriched(lead) && lead.qualifyPhase3 !== false);

  if (ready) return 'dialing';
  if (isStillPrepping(lead) || !isLeadEnriched(lead)) return 'prepping';
  return 'dialing';
}

export function matchLabel(state: MatchState): string {
  switch (state) {
    case 'prepping':
      return 'Prepping';
    case 'dialing':
      return 'Dialing';
    case 'booked':
      return 'Meeting Booked';
    case 'failed':
      return 'Needs attention';
  }
}

export type MatchProgressKpis = {
  targeting: number;
  conditioning: number;
  dialingActive: number;
  dialingReady: number;
  booked: number;
  failed: number;
  total: number;
};

/**
 * Targeting = scrape / raw. Conditioning = webscan+enrich in flight.
 * Active dialing = warming|dialing. Booked = done.
 */
export function matchProgressOf(leads: MatchLeadInput[]): MatchProgressKpis {
  let targeting = 0;
  let conditioning = 0;
  let dialingActive = 0;
  let dialingReady = 0;
  let booked = 0;
  let failed = 0;

  for (const lead of leads) {
    const state = matchStateOf(lead);
    if (state === 'booked') {
      booked += 1;
      continue;
    }
    if (state === 'failed') {
      failed += 1;
      continue;
    }
    if (state === 'prepping') {
      const scrapeDone = lead.scrapeStatus === 'completed' || lead.scrapeStatus === 'skipped';
      if (!scrapeDone && lead.enrichmentStatus !== 'pending') targeting += 1;
      else conditioning += 1;
      continue;
    }
    dialingReady += 1;
    const s = lead.status || 'new';
    if (s === 'warming' || s === 'dialing') dialingActive += 1;
  }

  return {
    targeting,
    conditioning,
    dialingActive,
    dialingReady,
    booked,
    failed,
    total: leads.length,
  };
}

export function activeMatchStage(
  kpis: MatchProgressKpis
): 'targeting' | 'conditioning' | 'ring' {
  if (kpis.targeting > 0 && kpis.dialingReady === 0 && kpis.booked === 0) return 'targeting';
  if (kpis.conditioning > 0 && kpis.dialingActive === 0) return 'conditioning';
  if (kpis.dialingActive > 0 || kpis.booked > 0 || kpis.dialingReady > 0) return 'ring';
  if (kpis.targeting > 0) return 'targeting';
  return 'conditioning';
}

export function matchStageCopy(stage: 'targeting' | 'conditioning' | 'ring'): string {
  switch (stage) {
    case 'targeting':
      return 'Scouting target leads matching your profile criteria…';
    case 'conditioning':
      return 'Validating mobile lines and mapping direct decision-makers. Optimizing for phone deliverability.';
    case 'ring':
      return 'Reps dialing · appointments locking to your calendar.';
  }
}
