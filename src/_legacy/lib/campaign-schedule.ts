/**
 * Campaign schedule → status.
 * - End date passed → auto-deactivate (PAUSED)
 * - Activate before start → OPEN (dials gated until start via eligibility)
 * - Within window on activate → OPEN immediately
 */

export type ScheduleWindow = {
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export function parseScheduleDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when now is inside [startsAt, endsAt] (open-ended if endsAt null). */
export function isWithinScheduleWindow(
  schedule: ScheduleWindow,
  now: Date = new Date()
): boolean {
  const startsAt = parseScheduleDate(schedule.startsAt);
  const endsAt = parseScheduleDate(schedule.endsAt);
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Whether an OPEN campaign should be forced PAUSED because the end date passed. */
export function shouldAutoDeactivate(
  status: string,
  schedule: ScheduleWindow,
  now: Date = new Date()
): boolean {
  if (status !== 'OPEN') return false;
  const endsAt = parseScheduleDate(schedule.endsAt);
  return Boolean(endsAt && endsAt.getTime() <= now.getTime());
}

/**
 * Desired status when the brand arms (activateOn=true) the campaign.
 * Future start → still OPEN so dials auto-unlock at start; past end → PAUSED.
 */
export function statusWhenActivating(
  schedule: ScheduleWindow,
  now: Date = new Date()
): 'OPEN' | 'PAUSED' {
  const endsAt = parseScheduleDate(schedule.endsAt);
  if (endsAt && endsAt.getTime() <= now.getTime()) return 'PAUSED';
  return 'OPEN';
}

export function scheduleStatusHint(
  schedule: ScheduleWindow,
  status: string,
  now: Date = new Date()
): string | null {
  const startsAt = parseScheduleDate(schedule.startsAt);
  const endsAt = parseScheduleDate(schedule.endsAt);
  if (status === 'CLOSED') return null;
  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return 'End date passed — campaign auto-deactivated.';
  }
  if (status === 'OPEN' && startsAt && startsAt.getTime() > now.getTime()) {
    return `Armed — dials unlock ${startsAt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}.`;
  }
  if (status === 'OPEN' && endsAt) {
    return `Active until ${endsAt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}.`;
  }
  return null;
}
