/**
 * Meeting booking attribution helpers — wrap brand Calendly/Cal.com links
 * so CCR learns meetingAt without dual entry or founder webhooks.
 */

export type BookingProvider = 'calendly' | 'calcom' | 'google' | 'other';

export function detectBookingProvider(url: string): BookingProvider {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('calendly.com')) return 'calendly';
    if (host.includes('cal.com') || host.includes('cal.dev')) return 'calcom';
    if (host.includes('calendar.google.com') || host.includes('appointments')) return 'google';
  } catch {
    /* ignore */
  }
  return 'other';
}

export function campaignAllowsMeetings(goalType: string | null | undefined): boolean {
  return goalType === 'BOOKED_MEETING' || goalType === 'BOTH';
}

export function campaignAllowsQualified(goalType: string | null | undefined): boolean {
  return goalType === 'QUALIFIED_LEAD' || goalType === 'BOTH';
}

/** Build provider URL with CCR success redirect when possible. */
export function buildAttributionBookingUrl(opts: {
  bookingLink: string;
  doneUrl: string;
  prospectName?: string | null;
  prospectEmail?: string | null;
}): { embedUrl: string; provider: BookingProvider } {
  const provider = detectBookingProvider(opts.bookingLink);
  let url: URL;
  try {
    url = new URL(opts.bookingLink);
  } catch {
    return { embedUrl: opts.bookingLink, provider };
  }

  if (provider === 'calendly') {
    // Calendly invitee success redirect (works for many account types).
    url.searchParams.set('redirect_url', opts.doneUrl);
    if (opts.prospectName) {
      const parts = opts.prospectName.trim().split(/\s+/);
      if (parts[0]) url.searchParams.set('name', opts.prospectName);
      if (parts[0]) url.searchParams.set('first_name', parts[0]);
      if (parts.length > 1) url.searchParams.set('last_name', parts.slice(1).join(' '));
    }
    if (opts.prospectEmail) url.searchParams.set('email', opts.prospectEmail);
  } else if (provider === 'calcom') {
    url.searchParams.set('redirect', opts.doneUrl);
    url.searchParams.set('successRedirectUrl', opts.doneUrl);
    if (opts.prospectName) url.searchParams.set('name', opts.prospectName);
    if (opts.prospectEmail) url.searchParams.set('email', opts.prospectEmail);
  }

  return { embedUrl: url.toString(), provider };
}

/** Parse meeting start from Calendly/Cal.com redirect query or postMessage payload. */
export function parseMeetingAtFromParams(
  params: URLSearchParams | Record<string, string | undefined>
): Date | null {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) : params[k] ?? null;

  const candidates = [
    get('event_start_time'),
    get('start_time'),
    get('startTime'),
    get('meetingAt'),
    get('assigned_to'),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseMeetingAtFromCalendlyPayload(payload: unknown): Date | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const event = p.event as Record<string, unknown> | undefined;
  const start =
    (typeof event?.start_time === 'string' && event.start_time) ||
    (typeof p.start_time === 'string' && p.start_time) ||
    (typeof p.startTime === 'string' && p.startTime) ||
    null;
  if (!start) return null;
  const d = new Date(start);
  return Number.isNaN(d.getTime()) ? null : d;
}
