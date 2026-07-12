import { prisma } from '@/lib/prisma';
import type { UserProfile, Prisma } from '@prisma/client';

export type MinuteSource = 'personal' | 'org_pool';

export type MinuteBalance = {
  personal: number;
  orgPool: number | null;
  orgId: string | null;
  /** Prefer org pool when available, else personal. Held minutes already subtracted. */
  available: number;
  held: number;
  source: MinuteSource;
};

async function activeHeldMinutes(userId: string, tx?: Prisma.TransactionClient): Promise<number> {
  const db = tx || prisma;
  const now = new Date();
  const holds = await db.minuteHold.findMany({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    select: { minutes: true },
  });
  return holds.reduce((sum, h) => sum + h.minutes, 0);
}

/** Resolve spendable minutes: Team org pool first, then personal. Subtracts active holds. */
export async function getMinuteBalance(
  profile: UserProfile,
  tx?: Prisma.TransactionClient
): Promise<MinuteBalance> {
  const db = tx || prisma;
  let orgPool: number | null = null;
  if (profile.orgId) {
    const member = await db.academyMember.findFirst({
      where: { userId: profile.id, academy: { orgId: profile.orgId } },
      select: { id: true },
    });
    if (member) {
      const pool = await db.orgMinutePool.findUnique({
        where: { orgId: profile.orgId },
        select: { minutesRemaining: true },
      });
      if (pool) orgPool = pool.minutesRemaining;
    }
  }

  const held = await activeHeldMinutes(profile.id, tx);
  const personal = profile.minutesRemaining;

  if (orgPool != null && orgPool > 0) {
    return {
      personal,
      orgPool,
      orgId: profile.orgId,
      available: Math.max(0, orgPool - held),
      held,
      source: 'org_pool',
    };
  }
  return {
    personal,
    orgPool,
    orgId: profile.orgId,
    available: Math.max(0, personal - held),
    held,
    source: 'personal',
  };
}

/**
 * Soft-reserve minutes for a gate token so concurrent starts can't overdraw.
 * Returns null if insufficient available balance.
 */
export async function createMinuteHold(opts: {
  jti: string;
  userId: string;
  minutes?: number;
  brandId?: string | null;
  packId?: string | null;
  ttlMs?: number;
}): Promise<{ ok: true; holdId: string; available: number } | { ok: false; error: string; available: number }> {
  const minutes = Math.max(1, opts.minutes ?? 1);
  const ttlMs = opts.ttlMs ?? 5 * 60_000;

  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.findUnique({ where: { id: opts.userId } });
    if (!profile) return { ok: false as const, error: 'Profile not found', available: 0 };

    const balance = await getMinuteBalance(profile, tx);
    if (balance.available < minutes) {
      return {
        ok: false as const,
        error: 'Not enough practice minutes. Upgrade, buy a pack, or ask your team manager.',
        available: balance.available,
      };
    }

    await tx.minuteHold.create({
      data: {
        id: opts.jti,
        userId: opts.userId,
        minutes,
        brandId: opts.brandId || null,
        packId: opts.packId || null,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return {
      ok: true as const,
      holdId: opts.jti,
      available: balance.available - minutes,
    };
  });
}

/** Mark hold as started on first worker verify (single-use start). */
export async function markHoldStarted(jti: string): Promise<boolean> {
  const hold = await prisma.minuteHold.findUnique({ where: { id: jti } });
  if (!hold) return false;
  if (hold.consumedAt) return false;
  if (hold.expiresAt.getTime() < Date.now()) return false;
  if (!hold.startedAt) {
    await prisma.minuteHold.update({
      where: { id: jti },
      data: { startedAt: new Date() },
    });
  }
  return true;
}

/**
 * Atomically deduct minutes with a WHERE check so balance can't go negative.
 * Optionally consumes a MinuteHold in the same transaction.
 */
export async function deductMinutes(
  profile: UserProfile,
  minutes: number,
  opts?: { holdId?: string | null; tx?: Prisma.TransactionClient }
): Promise<{ ok: true; remaining: number; source: MinuteSource } | { ok: false; error: string }> {
  const run = async (tx: Prisma.TransactionClient) => {
    // Refresh profile inside tx for accurate personal balance
    const fresh = await tx.userProfile.findUnique({ where: { id: profile.id } });
    if (!fresh) return { ok: false as const, error: 'Profile not found' };

    if (opts?.holdId) {
      const hold = await tx.minuteHold.findUnique({ where: { id: opts.holdId } });
      if (hold && hold.userId === profile.id && !hold.consumedAt) {
        await tx.minuteHold.update({
          where: { id: hold.id },
          data: { consumedAt: new Date() },
        });
      }
    }

    const balance = await getMinuteBalance(fresh, tx);
    // After consuming hold, available includes those minutes again — check raw pool/personal
    let rawAvailable = balance.source === 'org_pool' ? (balance.orgPool ?? 0) : fresh.minutesRemaining;
    // Recompute held excluding the hold we just consumed
    const held = await activeHeldMinutes(profile.id, tx);
    rawAvailable = Math.max(0, rawAvailable - held);

    if (rawAvailable < minutes && balance.source === 'org_pool') {
      // Fall through to personal if org can't cover after hold accounting
    }

    if (balance.source === 'org_pool' && balance.orgId) {
      const updated = await tx.orgMinutePool.updateMany({
        where: { orgId: balance.orgId, minutesRemaining: { gte: minutes } },
        data: {
          minutesRemaining: { decrement: minutes },
          minutesUsed: { increment: minutes },
        },
      });
      if (updated.count === 0) {
        // Try personal as fallback
        const personalOk = await tx.userProfile.updateMany({
          where: { id: profile.id, minutesRemaining: { gte: minutes } },
          data: {
            minutesRemaining: { decrement: minutes },
            minutesUsed: { increment: minutes },
          },
        });
        if (personalOk.count === 0) {
          return {
            ok: false as const,
            error: 'Not enough practice minutes. Upgrade, buy a pack, or ask your team manager.',
          };
        }
        const p = await tx.userProfile.findUnique({ where: { id: profile.id } });
        return { ok: true as const, remaining: p?.minutesRemaining ?? 0, source: 'personal' as MinuteSource };
      }
      await tx.userProfile.update({
        where: { id: profile.id },
        data: { minutesUsed: { increment: minutes } },
      });
      const pool = await tx.orgMinutePool.findUnique({ where: { orgId: balance.orgId } });
      return {
        ok: true as const,
        remaining: pool?.minutesRemaining ?? 0,
        source: 'org_pool' as MinuteSource,
      };
    }

    const updated = await tx.userProfile.updateMany({
      where: { id: profile.id, minutesRemaining: { gte: minutes } },
      data: {
        minutesRemaining: { decrement: minutes },
        minutesUsed: { increment: minutes },
      },
    });
    if (updated.count === 0) {
      return {
        ok: false as const,
        error: 'Not enough practice minutes. Upgrade, buy a pack, or ask your team manager.',
      };
    }
    const p = await tx.userProfile.findUnique({ where: { id: profile.id } });
    return { ok: true as const, remaining: p?.minutesRemaining ?? 0, source: 'personal' as MinuteSource };
  };

  if (opts?.tx) return run(opts.tx);
  return prisma.$transaction(run);
}

/** Top up org pool when Team plan renews / purchases. */
export async function topUpOrgPool(orgId: string, minutes: number) {
  return prisma.orgMinutePool.upsert({
    where: { orgId },
    create: {
      orgId,
      minutesRemaining: minutes,
      minutesUsed: 0,
      lastTopUpAt: new Date(),
    },
    update: {
      minutesRemaining: minutes,
      lastTopUpAt: new Date(),
    },
  });
}

/** Add personal minutes (packs, referrals, admin). */
export async function creditPersonalMinutes(userId: string, minutes: number) {
  return prisma.userProfile.update({
    where: { id: userId },
    data: { minutesRemaining: { increment: minutes } },
  });
}
