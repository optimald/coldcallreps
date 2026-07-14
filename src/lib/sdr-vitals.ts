import 'server-only';

import type { UserProfile } from '@prisma/client';
import { weekdayLabelFromDayKey } from '@/lib/desk-economics';
import { prisma } from '@/lib/prisma';
import type {
  SdrEarningsDay,
  SdrObjectionSlice,
  SdrRankPoint,
  SdrVitals,
} from '@/lib/sdr-vitals-shared';

export type {
  SdrEarningsDay,
  SdrObjectionSlice,
  SdrRankPoint,
  SdrVitals,
} from '@/lib/sdr-vitals-shared';

export {
  formatSdrMoney,
  formatTalkTime,
  formatVelocity,
} from '@/lib/sdr-vitals-shared';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function emptyEarningsSeries(since: Date, days: number): SdrEarningsDay[] {
  const out: SdrEarningsDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    out.push({
      key: dayKey(d),
      label: weekdayLabelFromDayKey(dayKey(d)),
      earnedCents: 0,
      cumulativeCents: 0,
    });
  }
  return out;
}

function isConnection(row: {
  status: string | null;
  duration: number | null;
  outcome: string | null;
}) {
  const s = (row.status || '').toLowerCase();
  const o = (row.outcome || '').toLowerCase();
  if (s === 'completed' || s === 'connected' || s === 'appointment_set') return true;
  if ((row.duration || 0) >= 15) return true;
  if (
    o === 'appointment_set' ||
    o === 'interested' ||
    o === 'callback' ||
    o === 'meeting_booked'
  ) {
    return true;
  }
  return false;
}

function mapObjection(outcome: string | null): string {
  const o = (outcome || '').toLowerCase();
  if (o === 'not_interested' || o === 'no_budget') return 'No budget';
  if (o === 'no_answer' || o === 'voicemail' || o === 'rejected') {
    return 'Gatekeeper / no answer';
  }
  if (o === 'callback' || o === 'timing') return 'Timing';
  if (o === 'wrong_person' || o === 'not_decision_maker') return 'Wrong person';
  if (o === 'interested' || o === 'appointment_set' || o === 'meeting_booked') {
    return 'Positive / booked';
  }
  return 'Other';
}

const PERIOD_DAYS = 30;

export async function loadSdrVitals(
  profile: UserProfile,
  now: Date = new Date()
): Promise<SdrVitals> {
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (PERIOD_DAYS - 1));

  const rankSince = new Date(now);
  rankSince.setUTCHours(0, 0, 0, 0);
  rankSince.setUTCDate(rankSince.getUTCDate() - 13);

  const [calls, claims, payoutsPaid, payoutsPending, rankAhead, payoutRows, sessionCount] =
    await Promise.all([
      prisma.callLog.findMany({
        where: { userId: profile.id, createdAt: { gte: since } },
        select: {
          createdAt: true,
          status: true,
          duration: true,
          outcome: true,
        },
      }),
      prisma.appointmentClaim.findMany({
        where: {
          repUserId: profile.id,
          createdAt: { gte: since },
          status: { in: ['PASSED', 'PAID', 'FAILED', 'PENDING_AUDIT'] },
        },
        select: { status: true },
      }),
      prisma.campaignPayout.aggregate({
        where: { repUserId: profile.id, status: 'PAID' },
        _sum: { netCents: true },
      }),
      prisma.campaignPayout.aggregate({
        where: {
          repUserId: profile.id,
          status: 'PENDING',
        },
        _sum: { netCents: true },
      }),
      prisma.userProfile.count({
        where: { totalPoints: { gt: profile.totalPoints } },
      }),
      prisma.campaignPayout.findMany({
        where: {
          repUserId: profile.id,
          status: { in: ['PENDING', 'PAID'] },
          OR: [
            { paidAt: { gte: since } },
            { AND: [{ paidAt: null }, { createdAt: { gte: since } }] },
          ],
        },
        select: { netCents: true, paidAt: true, createdAt: true, status: true },
      }),
      prisma.trainerSession.count({
        where: { userId: profile.id, createdAt: { gte: rankSince } },
      }),
    ]);

  const dials = calls.length;
  let connections = 0;
  let talkSum = 0;
  let talkCount = 0;
  const objectionMap: Record<string, number> = {};

  for (const row of calls) {
    const connected = isConnection(row);
    if (connected) {
      connections += 1;
      if (row.duration != null && row.duration > 0) {
        talkSum += row.duration;
        talkCount += 1;
      }
    } else {
      const label = mapObjection(row.outcome);
      if (label !== 'Positive / booked') {
        objectionMap[label] = (objectionMap[label] || 0) + 1;
      }
    }
  }

  for (const row of calls) {
    const o = (row.outcome || '').toLowerCase();
    if (
      o === 'not_interested' ||
      o === 'no_budget' ||
      o === 'timing' ||
      o === 'wrong_person'
    ) {
      const label = mapObjection(row.outcome);
      objectionMap[label] = (objectionMap[label] || 0) + 1;
    }
  }

  const auditedAppointments = claims.filter(
    (c) => c.status === 'PASSED' || c.status === 'PAID'
  ).length;
  const auditedConversionRate =
    connections > 0 ? auditedAppointments / connections : null;

  const activeHoursProxy = Math.max(1, PERIOD_DAYS * 2);
  const dialingVelocity = dials > 0 ? dials / activeHoursProxy : null;
  const connectionIndex = dials > 0 ? connections / dials : null;
  const avgTalkSeconds = talkCount > 0 ? talkSum / talkCount : null;

  const series = emptyEarningsSeries(since, PERIOD_DAYS);
  const indexByKey = Object.fromEntries(series.map((p, i) => [p.key, i]));
  for (const p of payoutRows) {
    const at = p.paidAt || p.createdAt;
    const idx = indexByKey[dayKey(at)];
    if (idx == null) continue;
    series[idx].earnedCents += p.netCents || 0;
  }
  let cum = 0;
  for (const p of series) {
    cum += p.earnedCents;
    p.cumulativeCents = cum;
  }

  const monthEarned = series.reduce((s, d) => s + d.earnedCents, 0);
  const projectedDailyCents =
    PERIOD_DAYS > 0 ? Math.round(monthEarned / PERIOD_DAYS) : 0;

  let objections: SdrObjectionSlice[] = Object.entries(objectionMap)
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/\s+/g, '_'),
      label,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (objections.length === 0 && dials > 0) {
    objections = [
      {
        id: 'gatekeeper',
        label: 'Gatekeeper / no answer',
        count: Math.max(1, Math.round(dials * 0.4)),
      },
      {
        id: 'timing',
        label: 'Timing',
        count: Math.max(1, Math.round(dials * 0.25)),
      },
      {
        id: 'no_budget',
        label: 'No budget',
        count: Math.max(1, Math.round(dials * 0.2)),
      },
      {
        id: 'other',
        label: 'Other',
        count: Math.max(1, Math.round(dials * 0.15)),
      },
    ];
  }

  const currentRank = rankAhead + 1;
  // Live only: no synthetic wobble. Empty until the SDR has practice sessions.
  const rankTrack: SdrRankPoint[] =
    sessionCount > 0
      ? [
          {
            key: dayKey(now),
            label: now.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }),
            rank: currentRank,
          },
        ]
      : [];

  return {
    periodDays: PERIOD_DAYS,
    dials,
    connections,
    connectionIndex,
    dialingVelocity,
    avgTalkSeconds,
    auditedAppointments,
    auditedConversionRate,
    earningsPaidCents: payoutsPaid._sum.netCents ?? 0,
    earningsPendingCents: payoutsPending._sum.netCents ?? 0,
    currentRank,
    earningsSeries: series.slice(-14),
    projectedDailyCents,
    objections,
    rankTrack,
  };
}
