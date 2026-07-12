/** Sessions with these flags are excluded from public talent signal. */
export const BLOCKING_INTEGRITY_CODES = new Set([
  'short_duration',
  'thin_transcript',
  'no_prospect_speech',
  'high_score_short_call',
  'talk_ratio_skew',
  'repeated_user_turns',
  'inflated_score_thin_call',
]);

export function parseIntegrityFlags(raw: string | null | undefined): { code: string; detail: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasBlockingIntegrity(raw: string | null | undefined): boolean {
  return parseIntegrityFlags(raw).some((f) => BLOCKING_INTEGRITY_CODES.has(f.code));
}

/** Auto-verify threshold: clean session at this score+ qualifies for verified review queue. */
export const VERIFY_SCORE_THRESHOLD = 85;
