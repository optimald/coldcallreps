/**
 * Campaign daily calling hours — clock-of-day gate (separate from startsAt/endsAt calendar window).
 * Minutes are from midnight in the campaign's IANA timezone (0–1439).
 * Overnight windows (e.g. 22:00–06:00) are supported when start > end.
 */

export const CALLING_TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
] as const;

export const DEFAULT_CALLING_TIMEZONE = 'America/Los_Angeles';

export type CallingHoursInput = {
  callingHoursStartMin?: number | null;
  callingHoursEndMin?: number | null;
  callingTimezone?: string | null;
};

/** Parse "HH:mm" or "H:mm" → minutes from midnight, or null if empty/invalid. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes from midnight → "HH:mm". */
export function minutesToTime(mins: number | null | undefined): string {
  if (mins == null || !Number.isFinite(mins)) return '';
  const clamped = Math.max(0, Math.min(1439, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function normalizeCallingHoursMinutes(
  value: unknown
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string' && value.includes(':')) {
    return parseTimeToMinutes(value);
  }
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 1439) return null;
  return n;
}

export function hasCallingHoursConfigured(hours: CallingHoursInput): boolean {
  return (
    hours.callingHoursStartMin != null &&
    hours.callingHoursEndMin != null &&
    Number.isFinite(hours.callingHoursStartMin) &&
    Number.isFinite(hours.callingHoursEndMin)
  );
}

/** Local minutes-from-midnight in an IANA timezone. Falls back to UTC on invalid tz. */
export function localMinutesInTimezone(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    }
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

/**
 * Whether `now` falls inside the daily calling window.
 * Missing/incomplete hours → always true (no daily gate).
 */
export function isWithinCampaignCallingHours(
  hours: CallingHoursInput,
  now: Date = new Date()
): boolean {
  if (!hasCallingHoursConfigured(hours)) return true;
  const start = hours.callingHoursStartMin!;
  const end = hours.callingHoursEndMin!;
  const tz = (hours.callingTimezone || DEFAULT_CALLING_TIMEZONE).trim() || DEFAULT_CALLING_TIMEZONE;
  const local = localMinutesInTimezone(now, tz);

  if (start === end) {
    // Same start/end = full day (brand set identical times) — treat as always open.
    return true;
  }
  if (start < end) {
    return local >= start && local < end;
  }
  // Overnight wrap: e.g. 22:00–06:00
  return local >= start || local < end;
}

export function formatCallingHoursLabel(hours: CallingHoursInput): string | null {
  if (!hasCallingHoursConfigured(hours)) return null;
  const start = minutesToTime(hours.callingHoursStartMin);
  const end = minutesToTime(hours.callingHoursEndMin);
  const tz = hours.callingTimezone || DEFAULT_CALLING_TIMEZONE;
  const shortTz = tz.replace(/^America\//, '').replace(/_/g, ' ');
  return `${start}–${end} ${shortTz}`;
}

/**
 * Validate API body for calling hours. Returns error message or parsed values.
 * Passing only one of start/end is an error. Empty/null clears the gate.
 */
export function parseCallingHoursBody(body: {
  callingHoursStartMin?: unknown;
  callingHoursEndMin?: unknown;
  callingHoursStart?: unknown;
  callingHoursEnd?: unknown;
  callingTimezone?: unknown;
}):
  | { ok: true; startMin: number | null; endMin: number | null; timezone: string | null }
  | { ok: false; error: string } {
  const startRaw =
    body.callingHoursStartMin !== undefined
      ? body.callingHoursStartMin
      : body.callingHoursStart;
  const endRaw =
    body.callingHoursEndMin !== undefined
      ? body.callingHoursEndMin
      : body.callingHoursEnd;

  const startProvided = startRaw !== undefined;
  const endProvided = endRaw !== undefined;
  const tzProvided = body.callingTimezone !== undefined;

  if (!startProvided && !endProvided && !tzProvided) {
    return { ok: true, startMin: null, endMin: null, timezone: null };
  }

  const startMin = startProvided ? normalizeCallingHoursMinutes(startRaw) ?? null : null;
  const endMin = endProvided ? normalizeCallingHoursMinutes(endRaw) ?? null : null;

  if (startProvided && startRaw !== null && startRaw !== '' && startMin == null) {
    return { ok: false, error: 'Invalid callingHoursStart' };
  }
  if (endProvided && endRaw !== null && endRaw !== '' && endMin == null) {
    return { ok: false, error: 'Invalid callingHoursEnd' };
  }

  const oneSet = startMin != null || endMin != null;
  if (oneSet && (startMin == null || endMin == null)) {
    return {
      ok: false,
      error: 'Both calling hours start and end are required, or clear both for anytime dialing',
    };
  }

  let timezone: string | null = null;
  if (tzProvided) {
    if (body.callingTimezone == null || body.callingTimezone === '') {
      timezone = null;
    } else {
      timezone = String(body.callingTimezone).trim().slice(0, 80);
      if (!timezone) timezone = null;
      else {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch {
          return { ok: false, error: 'Invalid callingTimezone' };
        }
      }
    }
  }

  if (startMin != null && endMin != null && !timezone) {
    timezone = DEFAULT_CALLING_TIMEZONE;
  }
  if (startMin == null && endMin == null) {
    timezone = null;
  }

  return { ok: true, startMin, endMin, timezone };
}
