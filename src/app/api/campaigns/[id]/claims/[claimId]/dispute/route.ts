import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { writeAudit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string; claimId: string }> };

function safeJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * POST /api/campaigns/[id]/claims/[claimId]/dispute
 * Brand: dispute an AI-passed / paid claim payout (ops reviews clawback).
 * SDR: dispute an AI rejection (lands in admin review queue).
 * Body: { reason }
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: campaignId, claimId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();
    if (reason.length < 8) {
      return NextResponse.json(
        { error: 'reason required (min 8 characters)' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brand: { select: { ownerId: true, id: true, name: true, slug: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const claim = await prisma.appointmentClaim.findFirst({
      where: { id: claimId, campaignId },
    });
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    const manage = canManageBrand(profile, campaign.brand.ownerId);
    const isRep = claim.repUserId === profile.id;

    if (manage) {
      if (claim.status !== 'PASSED' && claim.status !== 'PAID') {
        return NextResponse.json(
          { error: 'Only passed or paid claims can be disputed by the brand' },
          { status: 400 }
        );
      }

      let payout = await prisma.campaignPayout.findUnique({
        where: { applicationId: claim.applicationId },
      });
      if (!payout) {
        const { calcPayoutSplit } = await import('@/lib/campaigns');
        const split = calcPayoutSplit(campaign.payoutCents, campaign.platformFeeBps);
        const brandOwnerId = campaign.brand.ownerId;
        if (!brandOwnerId) {
          return NextResponse.json({ error: 'Brand has no owner' }, { status: 400 });
        }
        payout = await prisma.campaignPayout.create({
          data: {
            campaignId,
            applicationId: claim.applicationId,
            brandUserId: brandOwnerId,
            repUserId: claim.repUserId,
            grossCents: split.grossCents,
            platformFeeCents: split.platformFeeCents,
            netCents: split.netCents,
            platformFeeBps: split.platformFeeBps,
            status: 'DISPUTED',
            disputeReason: reason,
            disputedAt: new Date(),
          },
        });
      } else if (payout.status === 'DISPUTED') {
        return NextResponse.json(
          { error: 'Payout is already disputed', payout },
          { status: 409 }
        );
      } else if (payout.status === 'CANCELED') {
        return NextResponse.json(
          { error: 'Cannot dispute a canceled payout' },
          { status: 400 }
        );
      } else {
        payout = await prisma.campaignPayout.update({
          where: { id: payout.id },
          data: {
            status: 'DISPUTED',
            disputeReason: reason,
            disputedAt: new Date(),
          },
        });
      }

      await writeAudit({
        actorId: profile.id,
        action: 'brand.payout.dispute',
        targetType: 'CampaignPayout',
        targetId: payout.id,
        meta: {
          claimId: claim.id,
          campaignId,
          reason,
          priorClaimStatus: claim.status,
          stripeTransferId: payout.stripeTransferId,
        },
      });

      const { notifyAsync } = await import('@/lib/notifications');
      notifyAsync({
        event: 'appointment.failed_audit',
        recipient: { userId: claim.repUserId },
        brand: {
          id: campaign.brand.id,
          name: campaign.brand.name,
          slug: campaign.brand.slug,
        },
        payload: {
          campaignTitle: campaign.title,
          campaignId,
          reason: `Brand disputed payout: ${reason}`,
          ctaUrl: '/gigs',
          forAudience: 'sdr',
        },
        idempotencyKey: `claim.dispute:brand:${claim.id}`,
      });

      return NextResponse.json({
        ok: true,
        kind: 'brand_payout_dispute',
        payout,
        notice:
          'Dispute filed. Ops will review — Connect transfers already sent are not auto-reversed.',
      });
    }

    if (isRep) {
      if (claim.status !== 'FAILED') {
        return NextResponse.json(
          { error: 'Only AI-rejected claims can be disputed by the SDR' },
          { status: 400 }
        );
      }

      const prior = safeJson(claim.auditJSON);
      if (prior.sdrDispute) {
        return NextResponse.json(
          { error: 'You already disputed this rejection', claim },
          { status: 409 }
        );
      }

      const updated = await prisma.appointmentClaim.update({
        where: { id: claim.id },
        data: {
          auditJSON: JSON.stringify({
            ...prior,
            sdrDispute: {
              reason,
              at: new Date().toISOString(),
              by: profile.id,
            },
          }),
          failureReason: `[SDR disputed] ${reason}${
            claim.failureReason ? ` · prior: ${claim.failureReason}` : ''
          }`.slice(0, 500),
        },
      });

      if (claim.callLogId) {
        await prisma.callLog
          .update({
            where: { id: claim.callLogId },
            data: { needsManualReview: true },
          })
          .catch(() => null);
      }

      await writeAudit({
        actorId: profile.id,
        action: 'sdr.claim.dispute_rejection',
        targetType: 'appointmentClaim',
        targetId: claim.id,
        meta: { campaignId, reason },
      });

      if (campaign.brand.ownerId) {
        const { notifyAsync } = await import('@/lib/notifications');
        notifyAsync({
          event: 'appointment.failed_audit',
          recipient: { userId: campaign.brand.ownerId },
          brand: {
            id: campaign.brand.id,
            name: campaign.brand.name,
            slug: campaign.brand.slug,
          },
          payload: {
            campaignTitle: campaign.title,
            campaignId,
            reason: `SDR disputed AI rejection: ${reason}`,
            ctaUrl: `/brands/${campaign.brand.slug}/sdrs/payouts`,
            forAudience: 'brand',
          },
          idempotencyKey: `claim.dispute:sdr:${claim.id}`,
        });
      }

      return NextResponse.json({
        ok: true,
        kind: 'sdr_rejection_dispute',
        claim: updated,
        notice: 'Dispute filed — platform review will re-check the AI rejection.',
      });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[claims/dispute]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
