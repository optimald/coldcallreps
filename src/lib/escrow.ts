import { prisma } from '@/lib/prisma';

export async function getOrCreateBrandWallet(brandId: string) {
  return prisma.brandWallet.upsert({
    where: { brandId },
    create: { brandId, balanceCents: 0 },
    update: {},
  });
}

export async function creditWallet(opts: {
  brandId: string;
  amountCents: number;
  type: 'FUND' | 'ESCROW_REFUND' | 'ADJUSTMENT';
  note?: string;
  campaignId?: string;
  stripeSessionId?: string;
}) {
  const amount = Math.max(0, Math.round(opts.amountCents));
  if (amount <= 0) throw new Error('amountCents must be positive');

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.brandWallet.upsert({
      where: { brandId: opts.brandId },
      create: { brandId: opts.brandId, balanceCents: 0 },
      update: {},
    });
    const balanceAfter = wallet.balanceCents + amount;
    await tx.brandWallet.update({
      where: { id: wallet.id },
      data: { balanceCents: balanceAfter },
    });
    await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        type: opts.type,
        amountCents: amount,
        balanceAfter,
        campaignId: opts.campaignId || null,
        stripeSessionId: opts.stripeSessionId || null,
        note: opts.note || null,
      },
    });
    return balanceAfter;
  });
}

/** Lock capital from wallet into campaign escrow when opening. */
export async function lockEscrowForCampaign(opts: {
  brandId: string;
  campaignId: string;
  amountCents: number;
}) {
  const amount = Math.max(0, Math.round(opts.amountCents));
  if (amount <= 0) return { locked: 0 };

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.brandWallet.upsert({
      where: { brandId: opts.brandId },
      create: { brandId: opts.brandId, balanceCents: 0 },
      update: {},
    });
    if (wallet.balanceCents < amount) {
      throw new Error(
        `Insufficient wallet balance. Need $${(amount / 100).toFixed(0)}, have $${(wallet.balanceCents / 100).toFixed(0)}. Fund the brand wallet first.`
      );
    }
    const balanceAfter = wallet.balanceCents - amount;
    await tx.brandWallet.update({
      where: { id: wallet.id },
      data: { balanceCents: balanceAfter },
    });
    await tx.campaign.update({
      where: { id: opts.campaignId },
      data: { escrowLockedCents: { increment: amount } },
    });
    await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        type: 'ESCROW_LOCK',
        amountCents: -amount,
        balanceAfter,
        campaignId: opts.campaignId,
        note: 'Escrow lock for open campaign',
      },
    });
    return { locked: amount, balanceAfter };
  });
}

/** Release one outcome from campaign escrow (after verified appointment). Idempotent per claimId. */
export async function releaseEscrowOutcome(opts: {
  brandId: string;
  campaignId: string;
  amountCents: number;
  claimId?: string;
}) {
  const amount = Math.max(0, Math.round(opts.amountCents));
  return prisma.$transaction(async (tx) => {
    if (opts.claimId) {
      const prior = await tx.walletLedger.findFirst({
        where: { claimId: opts.claimId, type: 'ESCROW_RELEASE' },
        select: { id: true },
      });
      if (prior) {
        return { released: 0, alreadyReleased: true as const };
      }
    }

    const campaign = await tx.campaign.findUnique({ where: { id: opts.campaignId } });
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.escrowLockedCents < amount) {
      throw new Error('Insufficient escrow locked on campaign');
    }
    await tx.campaign.update({
      where: { id: opts.campaignId },
      data: { escrowLockedCents: { decrement: amount } },
    });
    const wallet = await tx.brandWallet.findUnique({ where: { brandId: opts.brandId } });
    if (wallet) {
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: 'ESCROW_RELEASE',
          amountCents: -amount,
          balanceAfter: wallet.balanceCents,
          campaignId: opts.campaignId,
          claimId: opts.claimId || null,
          note: 'Escrow released to SDR payout',
        },
      });
    }
    return { released: amount, alreadyReleased: false as const };
  });
}
