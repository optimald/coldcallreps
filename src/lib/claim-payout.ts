import 'server-only';

import { prisma } from '@/lib/prisma';
import { releaseEscrowOutcome } from '@/lib/escrow';
import { calcPayoutSplit } from '@/lib/campaigns';
import { getStripe } from '@/lib/stripe';

/**
 * Release escrow + attempt Connect transfer for a PASSED appointment claim.
 * Idempotent when already PAID or escrow already released for this claimId.
 * One paid payout per application — blocks multi-claim escrow drain.
 */
export async function releaseAppointmentClaimPayout(claimId: string): Promise<{
  ok: true;
  claimStatus: string;
  payoutStatus: string;
} | {
  ok: false;
  error: string;
  code: string;
  status: number;
}> {
  const claimed = await prisma.appointmentClaim.findUnique({
    where: { id: claimId },
    include: {
      campaign: {
        select: {
          id: true,
          payoutCents: true,
          platformFeeBps: true,
          brandId: true,
          brand: { select: { ownerId: true } },
        },
      },
    },
  });
  const claim = claimed;
  if (!claim) {
    return { ok: false, error: 'Claim not found', code: 'NOT_FOUND', status: 404 };
  }
  if (claim.status === 'PAID') {
    return { ok: true, claimStatus: 'PAID', payoutStatus: 'PAID' };
  }
  if (claim.status !== 'PASSED') {
    return {
      ok: false,
      error: 'Claim must be PASSED before payout',
      code: 'NOT_PASSED',
      status: 400,
    };
  }

  // One successful payout per campaign application
  const existingPaid = await prisma.campaignPayout.findFirst({
    where: { applicationId: claim.applicationId, status: 'PAID' },
    select: { id: true },
  });
  if (existingPaid) {
    return {
      ok: false,
      error: 'This application already has a paid payout',
      code: 'ALREADY_PAID',
      status: 409,
    };
  }

  const split = calcPayoutSplit(
    claim.campaign.payoutCents,
    claim.campaign.platformFeeBps
  );

  try {
    await releaseEscrowOutcome({
      brandId: claim.campaign.brandId,
      campaignId: claim.campaignId,
      amountCents: claim.campaign.payoutCents,
      claimId: claim.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Escrow release failed';
    return { ok: false, error: msg, code: 'ESCROW_RELEASE_FAILED', status: 400 };
  }

  const brandOwnerId = claim.campaign.brand.ownerId;
  if (!brandOwnerId) {
    return { ok: false, error: 'Brand has no owner', code: 'NO_OWNER', status: 400 };
  }

  let payout = await prisma.campaignPayout.findUnique({
    where: { applicationId: claim.applicationId },
  });
  if (!payout) {
    payout = await prisma.campaignPayout.create({
      data: {
        campaignId: claim.campaignId,
        applicationId: claim.applicationId,
        brandUserId: brandOwnerId,
        repUserId: claim.repUserId,
        grossCents: split.grossCents,
        platformFeeCents: split.platformFeeCents,
        netCents: split.netCents,
        platformFeeBps: split.platformFeeBps,
        status: 'PENDING',
      },
    });
  }

  if (payout.status === 'PAID') {
    return { ok: true, claimStatus: claim.status, payoutStatus: 'PAID' };
  }

  if (payout.status === 'HELD' || payout.status === 'DISPUTED' || payout.status === 'CANCELED') {
    return {
      ok: false,
      error: `Payout is ${payout.status} — ops must release before transfer`,
      code: 'PAYOUT_HELD',
      status: 409,
    };
  }

  // Block payouts to suspended/banned reps
  const repStatus = await prisma.userProfile.findUnique({
    where: { id: claim.repUserId },
    select: { accountStatus: true },
  });
  if (repStatus?.accountStatus === 'SUSPENDED' || repStatus?.accountStatus === 'BANNED') {
    return {
      ok: false,
      error: 'Rep account is restricted',
      code: 'ACCOUNT_RESTRICTED',
      status: 403,
    };
  }

  const rep = await prisma.userProfile.findUnique({
    where: { id: claim.repUserId },
    select: {
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
    },
  });

  if (rep?.stripeConnectAccountId && rep.stripeConnectPayoutsEnabled) {
    try {
      const stripe = getStripe();
      const transfer = await stripe.transfers.create({
        amount: split.netCents,
        currency: 'usd',
        destination: rep.stripeConnectAccountId,
        transfer_group: `claim_${claim.id}`,
        metadata: {
          campaignId: claim.campaignId,
          claimId: claim.id,
          applicationId: claim.applicationId,
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
      await prisma.appointmentClaim.update({
        where: { id: claim.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return { ok: true, claimStatus: 'PAID', payoutStatus: 'PAID' };
    } catch (e) {
      console.warn('[claim-payout] Connect transfer failed — payout stays PENDING', e);
    }
  }

  return { ok: true, claimStatus: 'PASSED', payoutStatus: payout.status };
}
