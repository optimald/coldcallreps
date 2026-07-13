/** Client-safe verified-goal types + labels (no Prisma). */

export type VerifiedGoalKind = 'booking' | 'claim' | 'call';

export type VerifiedGoalRow = {
  id: string;
  kind: VerifiedGoalKind;
  title: string;
  companyName: string;
  repName: string;
  repUserId?: string | null;
  status: string;
  at: string;
  campaignId: string | null;
  campaignTitle?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  brandKey?: string | null;
  payoutCents?: number | null;
  payoutStatus?: string | null;
};

export function goalDisposition(
  status: string,
  kind?: VerifiedGoalKind,
  outcome?: string | null
) {
  const s = (status || '').toLowerCase();
  const o = (outcome || '').toLowerCase();
  if (
    kind === 'booking' ||
    o === 'meeting_booked' ||
    o === 'appointment_set' ||
    s === 'appointment_set' ||
    s === 'booked' ||
    o.includes('book')
  ) {
    return { label: 'Meeting booked', tone: 'good' as const };
  }
  if (s === 'pending_audit') return { label: 'Pending audit', tone: 'warn' as const };
  if (s === 'passed') return { label: 'Audit passed', tone: 'good' as const };
  if (s === 'paid') return { label: 'Paid out', tone: 'good' as const };
  if (o === 'interested' || o.includes('interest') || s === 'qualified') {
    return { label: 'Qualified lead', tone: 'accent' as const };
  }
  if (s === 'callback' || o === 'callback') {
    return { label: 'Callback', tone: 'accent' as const };
  }
  return { label: outcome || status || 'Verified goal', tone: 'muted' as const };
}
