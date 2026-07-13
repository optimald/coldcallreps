/**
 * Phone-only enrichment QC gates for ColdCallReps.
 * A lead is dial-ready when Phases 1–3 pass (no WebEvo / secret-shop / email cannon).
 */

export const ENRICHMENT_PHASE_CRITERIA = {
  phase1: {
    required: ['companyName', 'phone', 'city'],
    desired: ['state', 'website', 'reviewRating', 'mapsPlaceId'],
  },
  phase2: {
    required: ['webScanStatus:completed'],
    desired: ['bookingUrlFound', 'phone', 'hooksJSON'],
  },
  phase3: {
    // Accept either Completed (Trojan) or done (CCR legacy)
    required: ['enrichmentStatus:CompletedOrDone', 'qualifyPhase3:true'],
    desired: ['ownerName', 'ownerTitle', 'outreachReady:true'],
  },
} as const;

export type EnrichmentPhase = keyof typeof ENRICHMENT_PHASE_CRITERIA;

export interface PhaseCheckResult {
  phase: EnrichmentPhase;
  pass: boolean;
  requiredMet: number;
  requiredTotal: number;
  failedRequired: string[];
  desiredMet: number;
  desiredTotal: number;
}

function checkField(lead: Record<string, unknown>, spec: string): { met: boolean; value: unknown } {
  const parts = spec.split(':');
  const field = parts[0];
  const condition = parts[1];
  const val = lead[field];

  if (condition === 'hasData') {
    if (Array.isArray(val)) return { met: val.length > 0, value: `[${val.length} items]` };
    if (typeof val === 'object' && val !== null) {
      return { met: Object.keys(val).length > 0, value: `{${Object.keys(val).length} keys}` };
    }
    return { met: val != null && val !== '', value: val };
  }

  if (condition === 'Completed') {
    const normalized = typeof val === 'string' ? val.toLowerCase() : val;
    return { met: normalized === 'completed', value: val };
  }

  if (condition === 'CompletedOrDone') {
    const normalized = typeof val === 'string' ? val.toLowerCase() : '';
    return { met: normalized === 'completed' || normalized === 'done', value: val };
  }

  if (condition === 'true') {
    return { met: val === true, value: val };
  }

  if (condition === 'completed') {
    const normalized = typeof val === 'string' ? val.toLowerCase() : val;
    return { met: normalized === 'completed', value: val };
  }

  if (condition) {
    return { met: val === condition, value: val };
  }

  return { met: val != null && val !== '' && val !== 0, value: val };
}

export function checkLeadPhase(lead: Record<string, unknown>, phase: EnrichmentPhase): PhaseCheckResult {
  const criteria = ENRICHMENT_PHASE_CRITERIA[phase];
  const failedRequired: string[] = [];
  let requiredMet = 0;

  for (const spec of criteria.required) {
    const { met, value } = checkField(lead, spec);
    if (met) requiredMet++;
    else failedRequired.push(`${spec.split(':')[0]}=${value ?? 'null'}`);
  }

  let desiredMet = 0;
  for (const spec of criteria.desired) {
    const { met } = checkField(lead, spec);
    if (met) desiredMet++;
  }

  return {
    phase,
    pass: failedRequired.length === 0,
    requiredMet,
    requiredTotal: criteria.required.length,
    failedRequired,
    desiredMet,
    desiredTotal: criteria.desired.length,
  };
}

export function checkLeadAllPhases(lead: Record<string, unknown>): PhaseCheckResult[] {
  return (Object.keys(ENRICHMENT_PHASE_CRITERIA) as EnrichmentPhase[]).map((phase) =>
    checkLeadPhase(lead, phase)
  );
}

/**
 * Dial-ready gate: Phases 1–3 only (phone marketplace).
 * Phase 4 WebEvo and Phase 5 Secret Shop are frozen/out of scope.
 */
export function isLeadOutreachReady(lead: Record<string, unknown>): boolean {
  if (lead.outreachReady === true) return true;
  if (lead.qualifyPhase3 === true && (lead.enrichmentStatus === 'done' || lead.enrichmentStatus === 'Completed')) {
    return checkLeadPhase(lead, 'phase1').pass;
  }
  return checkLeadAllPhases(lead).every((p) => p.pass);
}

/** Normalize Prospect row into QC-friendly record. */
export function prospectToQcRecord(p: {
  companyName?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  reviewRating?: number | null;
  mapsPlaceId?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  enrichmentStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  outreachReady?: boolean | null;
  bookingUrlFound?: string | null;
  hooksJSON?: string | null;
  ownerName?: string | null;
  ownerTitle?: string | null;
}): Record<string, unknown> {
  return { ...p };
}
