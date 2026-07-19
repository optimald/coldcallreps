import 'server-only';

import { prisma } from '@/lib/prisma';
import { releaseEscrowBase } from '@/lib/escrow';
import { calcPayoutSplit } from '@/lib/campaigns';
import {
  baseFeeCapCents,
  isBasePayCadence,
  type BasePayCadence,
} from '@/lib/platform-fees';
import { getStripe } from '@/lib/stripe';

/** Fixed UTC Monday epoch for bi-weekly alignment (2024-01-01 was a Monday). */
const BIWEEK_EPOCH_UTC = Date.UTC(2024, 0, 1);

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcMondayOf(d: Date): Date {
  const day = utcDay(d);
  const dow = day.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  day.setUTCDate(day.getUTCDate() + offset);
  return day;
}

function isoWeekKey(d: Date): string {
  // ISO week: Thursday-based year, week starting Monday
  const date = utcDay(d);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7
    );
  const year = date.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function biweekPeriodStart(d: Date): Date {
  const monday = utcMondayOf(d);
  const days = Math.floor((monday.getTime() - BIWEEK_EPOCH_UTC) / 86400000);
  const biweekIndex = Math.floor(days / 14);
  return new Date(BIWEEK_EPOCH_UTC + biweekIndex * 14 * 86400000);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function periodKeyFor(
  cadence: BasePayCadence | string,
  date: Date = new Date()
): string {
  const c = isBasePayCadence(cadence) ? cadence : 'MONTHLY';
  if (c === 'WEEKLY') return isoWeekKey(date);
  if (c === 'BIWEEKLY') return ymd(biweekPeriodStart(date));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** True when `date` is on/after the period start (always true for current period). */
export function isPeriodDue(
  cadence: BasePayCadence | string,
  date: Date = new Date()
): boolean {
  const c = isBasePayCadence(cadence) ? cadence : 'MONTHLY';
  if (c === 'MONTHLY') return date.getUTCDate() >= 1;
  if (c === 'WEEKLY') {
    // Due once the week has started (any day in the week)
    return true;
  }
  // Bi-weekly: due any day within the current bi-week block
  return true;
}

export type BasePayResult = {
  applicationId: string;
  repUserId: string;
  ok: boolean;
  status?: string;
  error?: string;
  payoutId?: string;
};

/**
 * Pay base for all ACTIVE applications on an OPEN campaign for a cadence period.
 * Idempotent per (applicationId, BASE, periodKey).
 */
export async function payBaseForCampaign(
  campaignId: string,
  periodKey?: string
): Promise<{
  ok: boolean;
  periodKey: string;
  results: BasePayResult[];
  error?: string;
}> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { select: { id: true, ownerId: true, name: true, slug: true } },
    },
  });
  if (!campaign) {
    return { ok: false, periodKey: periodKey || '', results: [], error: 'Campaign not found' };
  }
  if (!campaign.basePayCents || campaign.basePayCents <= 0 || !campaign.basePayCadence) {
    return {
      ok: false,
      periodKey: periodKey || '',
      results: [],
      error: 'Campaign has no base pay configured',
    };
  }
  if (campaign.status !== 'OPEN') {
    return {
      ok: false,
      periodKey: periodKey || '',
      results: [],
      error: 'Campaign must be OPEN to pay base',
    };
  }

  const cadence = isBasePayCadence(campaign.basePayCadence)
    ? campaign.basePayCadence
    : 'MONTHLY';
  const key = periodKey || periodKeyFor(cadence);
  const feeCap = baseFeeCapCents(cadence);
  const split = calcPayoutSplit(campaign.basePayCents, campaign.platformFeeBps, feeCap);
  const brandOwnerId = campaign.brand.ownerId;
  if (!brandOwnerId) {
    return { ok: false, periodKey: key, results: [], error: 'Brand has no owner' };
  }

  const apps = await prisma.campaignApplication.findMany({
    where: { campaignId, status: 'ACTIVE' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          accountStatus: true,
          stripeConnectAccountId: true,
          stripeConnectPayoutsEnabled: true,
        },
      },
    },
  });

  const results: BasePayResult[] = [];

  for (const app of apps) {
    const existing = await prisma.campaignPayout.findFirst({
      where: {
        applicationId: app.id,
        kind: 'BASE',
        periodKey: key,
      },
    });
    if (existing?.status === 'PAID') {
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: true,
        status: 'PAID',
        payoutId: existing.id,
      });
      continue;
    }
    if (
      existing &&
      (existing.status === 'HELD' ||
        existing.status === 'DISPUTED' ||
        existing.status === 'CANCELED')
    ) {
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: false,
        status: existing.status,
        error: `Payout is ${existing.status}`,
        payoutId: existing.id,
      });
      continue;
    }

    if (
      app.user.accountStatus === 'SUSPENDED' ||
      app.user.accountStatus === 'BANNED'
    ) {
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: false,
        error: 'Rep account restricted',
      });
      continue;
    }

    let payout = existing;
    if (!payout) {
      try {
        await releaseEscrowBase({
          brandId: campaign.brandId,
          campaignId: campaign.id,
          amountCents: split.grossCents,
          applicationId: app.id,
          periodKey: key,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Escrow release failed';
        results.push({
          applicationId: app.id,
          repUserId: app.userId,
          ok: false,
          error: msg,
        });
        continue;
      }

      payout = await prisma.campaignPayout.create({
        data: {
          campaignId: campaign.id,
          applicationId: app.id,
          kind: 'BASE',
          periodKey: key,
          brandUserId: brandOwnerId,
          repUserId: app.userId,
          grossCents: split.grossCents,
          platformFeeCents: split.platformFeeCents,
          netCents: split.netCents,
          platformFeeBps: split.platformFeeBps,
          status: 'PENDING',
        },
      });
    }

    const connectReady =
      app.user.stripeConnectAccountId && app.user.stripeConnectPayoutsEnabled;
    if (!connectReady) {
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: true,
        status: 'PENDING',
        payoutId: payout.id,
        error: 'Connect not ready — base held PENDING',
      });
      continue;
    }

    try {
      const stripe = getStripe();
      const transfer = await stripe.transfers.create({
        amount: split.netCents,
        currency: 'usd',
        destination: app.user.stripeConnectAccountId!,
        transfer_group: `base_${campaign.id}_${key}_${app.id}`,
        metadata: {
          kind: 'BASE',
          campaignId: campaign.id,
          applicationId: app.id,
          periodKey: key,
          cadence,
        },
      });
      await prisma.campaignPayout.update({
        where: { id: payout.id },
        data: {
          status: 'PAID',
          stripeTransferId: transfer.id,
          paidAt: new Date(),
        },
      });
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: true,
        status: 'PAID',
        payoutId: payout.id,
      });
    } catch (e) {
      console.warn('[base-payout] Connect transfer failed', e);
      results.push({
        applicationId: app.id,
        repUserId: app.userId,
        ok: true,
        status: 'PENDING',
        payoutId: payout.id,
        error: 'Transfer failed — payout stays PENDING',
      });
    }
  }

  return { ok: true, periodKey: key, results };
}

/** Pay base for every OPEN campaign that has base pay configured (current period). */
export async function payBaseForAllOpenCampaigns(now: Date = new Date()): Promise<{
  campaigns: number;
  paid: number;
  pending: number;
  failed: number;
  details: { campaignId: string; periodKey: string; results: BasePayResult[] }[];
}> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'OPEN',
      basePayCents: { gt: 0 },
      basePayCadence: { not: null },
    },
    select: { id: true, basePayCadence: true },
  });

  let paid = 0;
  let pending = 0;
  let failed = 0;
  const details: { campaignId: string; periodKey: string; results: BasePayResult[] }[] = [];

  for (const c of campaigns) {
    const cadence = isBasePayCadence(c.basePayCadence) ? c.basePayCadence : 'MONTHLY';
    if (!isPeriodDue(cadence, now)) continue;
    const key = periodKeyFor(cadence, now);
    const result = await payBaseForCampaign(c.id, key);
    details.push({ campaignId: c.id, periodKey: result.periodKey, results: result.results });
    for (const r of result.results) {
      if (r.status === 'PAID') paid += 1;
      else if (r.status === 'PENDING') pending += 1;
      else if (!r.ok) failed += 1;
    }
  }

  return { campaigns: campaigns.length, paid, pending, failed, details };
}
