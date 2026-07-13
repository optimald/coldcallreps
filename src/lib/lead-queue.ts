/**
 * Hot-potato campaign queue: checkout locks, attempt ladder, time-shifted follow-ups.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CALLBACK_LOCK_HOURS, setCallbackLock } from '@/lib/brand-phone';

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

/** Prisma where: leads this SDR may see in their 6-slot queue. */
export function eligibleQueueWhere(opts: {
  campaignIds: string[];
  brandIds?: string[];
  userId: string;
  now?: Date;
}): Prisma.ProspectWhereInput {
  const now = opts.now ?? new Date();
  const campaignOrBrand: Prisma.ProspectWhereInput =
    opts.brandIds?.length
      ? {
          OR: [
            { campaignId: { in: opts.campaignIds } },
            { brandId: { in: opts.brandIds }, campaignId: null },
          ],
        }
      : { campaignId: { in: opts.campaignIds } };

  return {
    AND: [
      campaignOrBrand,
      { outreachReady: true },
      { phone: { not: null } },
      { NOT: { phone: '' } },
      { attemptCount: { lt: MAX_DIAL_ATTEMPTS } },
      { status: { not: 'done' } },
      {
        OR: [{ nextCallAt: null }, { nextCallAt: { lte: now } }],
      },
      {
        OR: [
          { checkedOutUntil: null },
          { checkedOutUntil: { lte: now } },
          { checkedOutByUserId: opts.userId },
        ],
      },
      {
        OR: [
          { callbackLockedUntil: null },
          { callbackLockedUntil: { lte: now } },
          { callbackLockedByUserId: opts.userId },
        ],
      },
      {
        NOT: { source: 'training' },
      },
    ],
  };
}

export async function listQueueLeads(opts: {
  campaignIds: string[];
  brandIds?: string[];
  userId: string;
  take?: number;
}) {
  const take = opts.take ?? DIAL_QUEUE_SIZE;
  const now = new Date();
  // Prefer leads already checked out to this SDR, then affinity, then oldest nextCallAt
  return prisma.prospect
    .findMany({
      where: eligibleQueueWhere({ ...opts, now }),
      orderBy: [{ nextCallAt: 'asc' }, { updatedAt: 'asc' }],
      take: take * 3,
      select: {
        id: true,
        companyName: true,
        phone: true,
        ownerName: true,
        ownerTitle: true,
        city: true,
        status: true,
        website: true,
        hooksJSON: true,
        notes: true,
        attemptCount: true,
        nextCallAt: true,
        lastDisposition: true,
        checkedOutByUserId: true,
        checkedOutUntil: true,
        callbackLockedByUserId: true,
        callbackLockedUntil: true,
        updatedAt: true,
        brand: { select: { name: true, slug: true } },
        campaignId: true,
      },
    })
    .then((rows) => {
      const scored = rows.map((r) => {
        let score = 0;
        if (
          r.checkedOutByUserId === opts.userId &&
          r.checkedOutUntil &&
          r.checkedOutUntil > now
        ) {
          score += 100;
        }
        if (
          r.callbackLockedByUserId === opts.userId &&
          r.callbackLockedUntil &&
          r.callbackLockedUntil > now
        ) {
          score += 50;
        }
        return { r, score };
      });
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const an = a.r.nextCallAt?.getTime() ?? 0;
        const bn = b.r.nextCallAt?.getTime() ?? 0;
        if (an !== bn) return an - bn;
        return a.r.updatedAt.getTime() - b.r.updatedAt.getTime();
      });
      return scored.slice(0, take).map((s) => s.r);
    });
}

/** Soft-reserve a lead for CHECKOUT_MINUTES. */
export async function checkoutLead(prospectId: string, userId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + CHECKOUT_MINUTES * 60 * 1000);

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      checkedOutByUserId: true,
      checkedOutUntil: true,
      callbackLockedByUserId: true,
      callbackLockedUntil: true,
      attemptCount: true,
      status: true,
      nextCallAt: true,
      outreachReady: true,
      phone: true,
    },
  });
  if (!prospect) return { ok: false as const, error: 'Lead not found', status: 404 };
  if (!prospect.outreachReady || !prospect.phone) {
    return { ok: false as const, error: 'Lead is not outreach-ready', status: 400 };
  }
  if (prospect.status === 'done' || prospect.attemptCount >= MAX_DIAL_ATTEMPTS) {
    return { ok: false as const, error: 'Lead is archived / max attempts reached', status: 409 };
  }
  if (prospect.nextCallAt && prospect.nextCallAt.getTime() > now.getTime()) {
    return {
      ok: false as const,
      error: `Lead cooling until ${prospect.nextCallAt.toLocaleString()}`,
      status: 409,
    };
  }
  if (
    prospect.callbackLockedUntil &&
    prospect.callbackLockedUntil.getTime() > now.getTime() &&
    prospect.callbackLockedByUserId &&
    prospect.callbackLockedByUserId !== userId
  ) {
    return {
      ok: false as const,
      error: 'Lead is affinity-locked to another rep (48h)',
      status: 409,
    };
  }
  if (
    prospect.checkedOutUntil &&
    prospect.checkedOutUntil.getTime() > now.getTime() &&
    prospect.checkedOutByUserId &&
    prospect.checkedOutByUserId !== userId
  ) {
    return {
      ok: false as const,
      error: 'Lead is checked out by another rep',
      status: 409,
    };
  }

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      checkedOutByUserId: userId,
      checkedOutUntil: until,
      status: 'dialing',
    } satisfies Prisma.ProspectUncheckedUpdateInput,
  });
  return { ok: true as const, prospect: updated, checkedOutUntil: until };
}

export async function releaseCheckout(prospectId: string, userId: string) {
  const p = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { checkedOutByUserId: true },
  });
  if (!p || p.checkedOutByUserId !== userId) return;
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      checkedOutByUserId: null,
      checkedOutUntil: null,
    } satisfies Prisma.ProspectUncheckedUpdateInput,
  });
}

/**
 * Apply wrap disposition: attempts, cooling schedule, affinity, archive.
 */
export async function applyDispositionFollowUp(opts: {
  prospectId: string;
  userId: string;
  outcome: string;
  campaignId?: string | null;
}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: opts.prospectId },
    select: { attemptCount: true, status: true },
  });
  if (!prospect) return null;

  const nextAttempt = prospect.attemptCount + 1;

  if (isTerminalDisposition(opts.outcome)) {
    return prisma.prospect.update({
      where: { id: opts.prospectId },
      data: {
        attemptCount: nextAttempt,
        lastDisposition: opts.outcome,
        status: 'done',
        nextCallAt: null,
        checkedOutByUserId: null,
        checkedOutUntil: null,
      } satisfies Prisma.ProspectUncheckedUpdateInput,
    });
  }

  if (isCoolingDisposition(opts.outcome)) {
    if (nextAttempt >= MAX_DIAL_ATTEMPTS) {
      return prisma.prospect.update({
        where: { id: opts.prospectId },
        data: {
          attemptCount: nextAttempt,
          lastDisposition: opts.outcome,
          status: 'done',
          nextCallAt: null,
          checkedOutByUserId: null,
          checkedOutUntil: null,
        } satisfies Prisma.ProspectUncheckedUpdateInput,
      });
    }

    const nextCallAt = computeNextCallAt(nextAttempt);
    const updated = await prisma.prospect.update({
      where: { id: opts.prospectId },
      data: {
        attemptCount: nextAttempt,
        lastDisposition: opts.outcome,
        status: 'warming',
        nextCallAt,
        checkedOutByUserId: null,
        checkedOutUntil: null,
      } satisfies Prisma.ProspectUncheckedUpdateInput,
    });

    if (opts.campaignId) {
      await setCallbackLock(opts.prospectId, opts.userId);
    }

    return updated;
  }

  // Unknown outcome — clear checkout, keep warming
  return prisma.prospect.update({
    where: { id: opts.prospectId },
    data: {
      lastDisposition: opts.outcome,
      checkedOutByUserId: null,
      checkedOutUntil: null,
      status: 'warming',
    } satisfies Prisma.ProspectUncheckedUpdateInput,
  });
}

export { CALLBACK_LOCK_HOURS };
