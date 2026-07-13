/** Shared SDR vitals types + formatters (safe for client + server). */

export type SdrObjectionSlice = {
  id: string;
  label: string;
  count: number;
};

export type SdrEarningsDay = {
  key: string;
  label: string;
  earnedCents: number;
  cumulativeCents: number;
};

export type SdrRankPoint = {
  key: string;
  label: string;
  rank: number;
};

export type SdrVitals = {
  periodDays: number;
  dials: number;
  connections: number;
  connectionIndex: number | null;
  dialingVelocity: number | null;
  avgTalkSeconds: number | null;
  auditedAppointments: number;
  auditedConversionRate: number | null;
  earningsPaidCents: number;
  earningsPendingCents: number;
  currentRank: number | null;
  earningsSeries: SdrEarningsDay[];
  projectedDailyCents: number;
  objections: SdrObjectionSlice[];
  rankTrack: SdrRankPoint[];
};

export function formatTalkTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function formatVelocity(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}/hr`;
}

export function formatSdrMoney(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(Math.abs(dollars) >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}
