/**
 * AI post-call audit (handoff §5).
 * Verifies appointment legitimacy from transcript/notes and flags for brand review.
 * Does NOT release escrow or transfer funds — brand confirms via claim pay endpoint.
 */

import { prisma } from '@/lib/prisma';
import { auditAppointmentClaim } from '@/lib/appointment-audit';

export type AuditCallPayload = { callLogId: string };

export async function flagCallForManualReview(callLogId: string, reason?: string) {
  await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      needsManualReview: true,
      isAudited: true,
      notes: reason ? `${reason}` : undefined,
    },
  });
}

/**
 * Independent referee: verify appointment legitimacy from transcript/notes.
 * Creates/updates a PASSED claim for brand confirmation — never moves money.
 */
export async function runAuditCallTask(payload: AuditCallPayload) {
  const callLog = await prisma.callLog.findUnique({ where: { id: payload.callLogId } });
  if (!callLog) return { ok: false as const, error: 'not_found' };

  // Idempotent: existing claim for this call log means we already audited.
  const existingClaim = await prisma.appointmentClaim.findFirst({
    where: {
      callLogId: callLog.id,
      status: { in: ['PASSED', 'PAID', 'PENDING_AUDIT', 'FAILED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  if (existingClaim && (existingClaim.status === 'PASSED' || existingClaim.status === 'PAID')) {
    return {
      ok: true as const,
      passed: true,
      claimId: existingClaim.id,
      skipped: 'already_claimed',
    };
  }

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

  const app = await prisma.campaignApplication.findFirst({
    where: {
      campaignId: campaign.id,
      userId: callLog.userId,
      status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] },
    },
  });

  if (!app) {
    await flagCallForManualReview(callLog.id, 'SDR not on campaign — claim skipped');
    return { ok: true as const, passed: true, audit: aiAuditResult, claim: 'skipped_no_app' };
  }

  let claimId = existingClaim?.id;
  if (!claimId) {
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
    claimId = claim.id;
  }

  if (callLog.prospectId) {
    await prisma.prospect.update({
      where: { id: callLog.prospectId },
      data: { status: 'done' },
    }).catch(() => null);
  }

  const brand = await prisma.brand.findUnique({
    where: { id: campaign.brandId },
    select: { ownerId: true, name: true, slug: true, id: true },
  });
  if (brand?.ownerId) {
    const { notifyAsync } = await import('@/lib/notifications');
    notifyAsync({
      event: 'appointment.booked',
      recipient: { userId: brand.ownerId },
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      payload: {
        campaignTitle: campaign.title,
        campaignId: campaign.id,
        prospectName: prospect?.ownerName || prospect?.companyName || undefined,
        ctaUrl: `/brands/${brand.slug}/sdrs/payouts`,
        forAudience: 'brand',
      },
      idempotencyKey: `appointment.audit:brand:${claimId}`,
    });
  }

  return {
    ok: true as const,
    passed: true,
    audit: aiAuditResult,
    claimId,
    code: 'PAYOUT_PENDING_BRAND_CONFIRM',
  };
}
