/**
 * Client-safe dial-queue constants and pure helpers (no Prisma / Twilio).
 */

export const CHECKOUT_MINUTES = 10;
export const MAX_DIAL_ATTEMPTS = 5;
export const DIAL_QUEUE_SIZE = 6;

const COOLING_DISPOSITIONS = new Set([
  'no_answer',
  'gatekeeper_blocked',
  'voicemail',
  'callback',
]);

const TERMINAL_DISPOSITIONS = new Set([
  'not_interested',
  'appointment_set',
  'interested', // legacy
]);

export function isCoolingDisposition(outcome: string | null | undefined): boolean {
  return Boolean(outcome && COOLING_DISPOSITIONS.has(outcome));
}

export function isTerminalDisposition(outcome: string | null | undefined): boolean {
  return Boolean(outcome && TERMINAL_DISPOSITIONS.has(outcome));
}

/**
 * Velocity ladder — shift to a different daypart on later attempts.
 * attemptCount is the count AFTER this dial (1..MAX).
 */
export function computeNextCallAt(attemptCount: number, from = new Date()): Date {
  const base = new Date(from);
  const ladders: { addDays: number; hour: number; minute: number }[] = [
    { addDays: 0, hour: 15, minute: 30 }, // later same day / next if past
    { addDays: 2, hour: 10, minute: 0 },
    { addDays: 2, hour: 16, minute: 0 },
    { addDays: 3, hour: 11, minute: 30 },
    { addDays: 4, hour: 14, minute: 0 },
  ];
  const step = ladders[Math.min(Math.max(attemptCount, 1), ladders.length) - 1];
  const next = new Date(base);
  next.setDate(next.getDate() + step.addDays);
  next.setHours(step.hour, step.minute, 0, 0);
  if (next.getTime() <= from.getTime() + 30 * 60 * 1000) {
    next.setDate(next.getDate() + 1);
    next.setHours(step.hour, step.minute, 0, 0);
  }
  return next;
}
