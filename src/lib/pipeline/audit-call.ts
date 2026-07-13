/**
 * AI post-call audit + escrow release (handoff §5).
 * Invoked when CallLog status → APPOINTMENT_SET or via AppointmentClaim.
 */

import { prisma } from '@/lib/prisma';
import { auditAppointmentClaim } from '@/lib/appointment-audit';
import { releaseEscrowOutcome } from '@/lib/escrow';
import { calcPayoutSplit } from '@/lib/campaigns';
import { getStripe } from '@/lib/stripe';

export type AuditCallPayload = { callLogId: string };

export async function flagCallForManualReview(callLogId: string, reason?: string) {
  await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      needsManualReview: true,
      isAudited: true,
      notes: reason
        ? `${reason}`
        : undefined,
    },
  });
}

/**
 * Independent referee: verify appointment legitimacy from transcript/notes,
 * then release escrow + create CampaignPayout when confidence is high.
 */
export async function runAuditCallTask(payload: AuditCallPayload) {
  const callLog = await prisma.callLog.findUnique({ where: { id: payload.callLogId } });
  if (!callLog) return { ok: false as const, error: 'not_found' };

  const transcript = callLog.transcript || callLog.notes;
  if (!transcript || transcript.trim().length < 40) {
    await flagCallForManualReview(callLog.id, 'Insufficient transcript for automated audit');
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        aiAuditResult: JSON.stringify({
          isLegitAppointment: false,
          confidence: 0,
          reasoning: 'No transcript/notes',
        }),
      },
    });
    return { ok: false as const, error: 'no_transcript', needsManualReview: true };
  }

  if (!callLog.campaignId) {
    await flagCallForManualReview(callLog.id, 'No campaign on call log');
    return { ok: false as const, error: 'no_campaign' };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: callLog.campaignId },
  });
  if (!campaign) return { ok: false as const, error: 'campaign_missing' };

  const prospect = callLog.prospectId
    ? await prisma.prospect.findUnique({ where: { id: callLog.prospectId } })
    : null;

  const audit = await auditAppointmentClaim({
    campaignTitle: campaign.title,
    icpText: campaign.icpText,
    goalType: campaign.goalType,
    notes: callLog.notes,
    transcriptSnippet: transcript,
    prospectName: prospect?.ownerName || prospect?.companyName || null,
  });

  const aiAuditResult = {
    isLegitAppointment: audit.passed,
    confidence: audit.score,
    reasoning: audit.reasons.join('; '),
    bant: audit.bant,
  };

  await prisma.callLog.update({
    where: { id: callLog.id },
    data: {
      isAudited: true,
      aiAuditResult: JSON.stringify(aiAuditResult),
      needsManualReview: !(audit.passed && audit.score > 85),
      status: audit.passed ? 'APPOINTMENT_SET' : callLog.status,
      outcome: audit.passed ? 'appointment_set' : callLog.outcome,
    },
  });

  if (!(audit.passed && audit.score > 85)) {
    await flagCallForManualReview(callLog.id, audit.reasons.join('; ') || 'Audit failed');
    return { ok: true as const, passed: false, audit: aiAuditResult, needsManualReview: true };
  }

  // Escrow payout path (mirrors claims route)
  const app = await prisma.campaignApplication.findFirst({
    where: {
      campaignId: campaign.id,
      userId: callLog.userId,
      status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] },
    },
  });

  if (!app) {
    await flagCallForManualReview(callLog.id, 'SDR not on campaign — escrow skipped');
    return { ok: true as const, passed: true, audit: aiAuditResult, escrow: 'skipped_no_app' };
  }

  const claim = await prisma.appointmentClaim.create({
    data: {
      campaignId: campaign.id,
      applicationId: app.id,
      repUserId: callLog.userId,
      callLogId: callLog.id,
      prospectName: prospect?.ownerName || prospect?.companyName || null,
      notes: callLog.notes,
      transcriptSnippet: transcript.slice(0, 12000),
      status: 'PASSED',
      auditJSON: JSON.stringify(audit),
      auditScore: audit.score,
      verifiedAt: new Date(),
    },
  });

  const split = calcPayoutSplit(campaign.payoutCents, campaign.platformFeeBps);
  try {
    await releaseEscrowOutcome({
      brandId: campaign.brandId,
      campaignId: campaign.id,
      amountCents: campaign.payoutCents,
      claimId: claim.id,
    });
  } catch (e) {
    await flagCallForManualReview(
      callLog.id,
      e instanceof Error ? e.message : 'Escrow release failed'
    );
    return {
      ok: false as const,
      error: 'escrow_failed',
      claimId: claim.id,
      audit: aiAuditResult,
    };
  }

  // Mark prospect booked
  if (callLog.prospectId) {
    await prisma.prospect.update({
      where: { id: callLog.prospectId },
      data: { status: 'done' },
    });
  }

  const brandOwner = await prisma.brand.findUnique({
    where: { id: campaign.brandId },
    select: { ownerId: true },
  });
  const brandOwnerId = brandOwner?.ownerId || null;

  let payout = await prisma.campaignPayout.findUnique({
    where: { applicationId: app.id },
  });

  if (!payout && brandOwnerId) {
    payout = await prisma.campaignPayout.create({
      data: {
        campaignId: campaign.id,
        applicationId: app.id,
        brandUserId: brandOwnerId,
        repUserId: callLog.userId,
        grossCents: split.grossCents,
        platformFeeCents: split.platformFeeCents,
        netCents: split.netCents,
        platformFeeBps: split.platformFeeBps,
        status: 'PENDING',
      },
    });
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: callLog.userId },
      select: { stripeConnectAccountId: true, stripeConnectPayoutsEnabled: true },
    });
    if (payout && profile?.stripeConnectAccountId && profile.stripeConnectPayoutsEnabled) {
      const stripe = getStripe();
      const transfer = await stripe.transfers.create({
        amount: split.netCents,
        currency: 'usd',
        destination: profile.stripeConnectAccountId,
        transfer_group: `claim_${claim.id}`,
        metadata: { claimId: claim.id, campaignId: campaign.id, callLogId: callLog.id },
      });
      await prisma.campaignPayout.update({
        where: { id: payout.id },
        data: { status: 'PAID', stripeTransferId: transfer.id, paidAt: new Date() },
      });
      await prisma.appointmentClaim.update({
        where: { id: claim.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
  } catch (e) {
    console.warn('[audit-call] Connect transfer deferred', e);
  }

  return {
    ok: true as const,
    passed: true,
    audit: aiAuditResult,
    claimId: claim.id,
    payoutId: payout?.id,
  };
}
