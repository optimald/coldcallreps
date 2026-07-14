import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  calcPayoutSplit,
  formatEarningsPayoutLabel,
  formatPayout,
  isCampaignDialEligible,
  practiceHref,
  resolveClaimPayoutCents,
  serializePayout,
} from '@/lib/campaigns';
import { loadOneCampaignSpend } from '@/lib/campaign-spend';
import { PLATFORM_FEE_CAP_CENTS, PLATFORM_FEE_SUMMARY } from '@/lib/platform-fees';
import { appBaseUrl, getStripe } from '@/lib/stripe';

/**
 * GET — list payouts for a campaign (brand manager) or own earnings on this campaign (SDR).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { ownerId: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const manage = canManageBrand(profile, campaign.brand.ownerId);
    const payouts = await prisma.campaignPayout.findMany({
      where: {
        campaignId: id,
        ...(manage ? {} : { repUserId: profile.id }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    const baselineCents = resolveClaimPayoutCents(campaign, 0);
    const split = calcPayoutSplit(
      baselineCents,
      campaign.platformFeeBps,
      PLATFORM_FEE_CAP_CENTS
    );

    return NextResponse.json({
      canManage: manage,
      feePolicy: PLATFORM_FEE_SUMMARY,
      payoutPerResult: {
        ...split,
        grossLabel: formatPayout(split.grossCents),
        netLabel: formatPayout(split.netCents),
        feeLabel: formatPayout(split.platformFeeCents),
        earningsLabel: formatEarningsPayoutLabel(campaign),
      },
      payouts: payouts.map((p) => ({
        ...serializePayout(p),
        applicationId: p.applicationId,
        claimId: p.claimId,
        applicant: p.application.user
          ? { id: p.application.user.id, displayName: p.application.user.displayName }
          : null,
        applicationStatus: p.application.status,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — brand starts a Connect destination-charge Checkout for an approved application.
 * Body: { applicationId, claimId? }
 *
 * Brand pays the resolved earnings-model rate; ~platformFeeBps stays with the platform;
 * SDR Connect account receives the remainder via transfer_data.destination.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { id: true, slug: true, ownerId: true, name: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body.applicationId || '').trim();
    const claimId = body.claimId ? String(body.claimId).trim() : '';
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }

    const app = await prisma.campaignApplication.findFirst({
      where: { id: applicationId, campaignId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            stripeConnectAccountId: true,
            stripeConnectPayoutsEnabled: true,
          },
        },
        payouts: true,
      },
    });
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    if (app.status === 'REJECTED' || app.status === 'WITHDRAWN' || app.status === 'APPLIED') {
      return NextResponse.json(
        {
          error: 'Accept the rep and mark the outcome complete before paying.',
          code: 'APPLICATION_NOT_READY',
        },
        { status: 400 }
      );
    }

    let claim: { id: string; status: string; payout: { id: string; status: string } | null } | null =
      null;
    if (claimId) {
      claim = await prisma.appointmentClaim.findFirst({
        where: { id: claimId, campaignId: id, applicationId: app.id },
        select: {
          id: true,
          status: true,
          payout: { select: { id: true, status: true } },
        },
      });
      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
      if (claim.payout?.status === 'PAID') {
        return NextResponse.json(
          { error: 'This claim was already paid.', code: 'ALREADY_PAID' },
          { status: 409 }
        );
      }
    } else {
      // Legacy: block only when every prior payout is PAID and no unpaid claim is targeted.
      const hasUnpaidPending = app.payouts.some((p) => p.status === 'PENDING');
      const allPaid =
        app.payouts.length > 0 && app.payouts.every((p) => p.status === 'PAID');
      if (allPaid && !hasUnpaidPending) {
        // Still allow another payout for additional wins (accelerator / multi-claim).
      }
    }

    const rep = app.user;
    if (!rep.stripeConnectAccountId || !rep.stripeConnectPayoutsEnabled) {
      return NextResponse.json(
        {
          error:
            'This SDR has not finished Stripe Connect onboarding. Ask them to connect payouts under Billing.',
          code: 'CONNECT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const priorPaidCount = await prisma.campaignPayout.count({
      where: {
        campaignId: id,
        repUserId: rep.id,
        status: 'PAID',
        kind: 'OUTCOME',
      },
    });
    const grossCents = resolveClaimPayoutCents(campaign, priorPaidCount);

    if (grossCents < 50) {
      return NextResponse.json(
        { error: 'Payout must be at least $0.50 for Stripe Checkout.' },
        { status: 400 }
      );
    }

    const split = calcPayoutSplit(grossCents, campaign.platformFeeBps, PLATFORM_FEE_CAP_CENTS);
    if (split.netCents < 1) {
      return NextResponse.json({ error: 'Net payout after fee is too small.' }, { status: 400 });
    }

    // Spend caps (overall / daily) — pause does not block paying completed work; only caps do.
    const spend = await loadOneCampaignSpend(id);
    const budgetGate = isCampaignDialEligible({
      status: 'OPEN',
      startsAt: null,
      endsAt: null,
      budgetCents: campaign.budgetCents,
      budgetMode: campaign.budgetMode,
      dailyBudgetCents: campaign.dailyBudgetCents,
      spentCents: spend.spentCents,
      spentTodayCents: spend.spentTodayCents,
      nextAwardCents: split.grossCents,
    });
    if (!budgetGate.ok) {
      return NextResponse.json(
        {
          error: budgetGate.reason || 'Budget exhausted',
          code: 'BUDGET_EXCEEDED',
          remainingOverallCents: budgetGate.remainingOverallCents,
          remainingDailyCents: budgetGate.remainingDailyCents,
        },
        { status: 400 }
      );
    }

    if (campaign.maxAwards != null && campaign.maxAwards > 0) {
      const paidCount = await prisma.campaignPayout.count({
        where: { campaignId: id, status: 'PAID' },
      });
      if (paidCount >= campaign.maxAwards) {
        return NextResponse.json(
          { error: 'Max awards reached for this campaign.', code: 'MAX_AWARDS' },
          { status: 400 }
        );
      }
    }

    const existingForClaim = claim?.payout
      ? await prisma.campaignPayout.findUnique({ where: { id: claim.payout.id } })
      : null;

    let payout = existingForClaim
      ? await prisma.campaignPayout.update({
          where: { id: existingForClaim.id },
          data: {
            status: 'PENDING',
            claimId: claim?.id ?? existingForClaim.claimId,
            grossCents: split.grossCents,
            platformFeeCents: split.platformFeeCents,
            netCents: split.netCents,
            platformFeeBps: split.platformFeeBps,
            brandUserId: profile.id,
            failureReason: null,
          },
        })
      : await prisma.campaignPayout.create({
          data: {
            campaignId: id,
            applicationId: app.id,
            claimId: claim?.id ?? null,
            brandUserId: profile.id,
            repUserId: rep.id,
            grossCents: split.grossCents,
            platformFeeCents: split.platformFeeCents,
            netCents: split.netCents,
            platformFeeBps: split.platformFeeBps,
            status: 'PENDING',
          },
        });

    // Ensure application is COMPLETED when paying
    if (app.status !== 'COMPLETED') {
      await prisma.campaignApplication.update({
        where: { id: app.id },
        data: { status: 'COMPLETED' },
      });
    }

    const stripe = getStripe();
    const base = appBaseUrl();

    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || undefined,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: split.grossCents,
            product_data: {
              name: `Campaign payout · ${campaign.title}`,
              description: `${rep.displayName || 'SDR'} · you pay ${formatPayout(split.grossCents)}; SDR receives ${formatPayout(split.netCents)} after ${formatPayout(split.platformFeeCents)} platform fee`,
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: split.platformFeeCents,
        transfer_data: {
          destination: rep.stripeConnectAccountId,
        },
        metadata: {
          kind: 'campaign_payout',
          payoutId: payout.id,
          applicationId: app.id,
          campaignId: id,
          repUserId: rep.id,
          brandUserId: profile.id,
        },
      },
      success_url: `${base}/brands/${campaign.brand.slug || campaign.brand.id}/campaigns/${id}?payout=success&payoutId=${payout.id}`,
      cancel_url: `${base}/brands/${campaign.brand.slug || campaign.brand.id}/campaigns/${id}?payout=cancel&payoutId=${payout.id}`,
      metadata: {
        kind: 'campaign_payout',
        payoutId: payout.id,
        applicationId: app.id,
        campaignId: id,
        userId: profile.id,
        repUserId: rep.id,
      },
    });

    payout = await prisma.campaignPayout.update({
      where: { id: payout.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    const { notifyAsync } = await import('@/lib/notifications');
    notifyAsync({
      event: 'payout.ready',
      recipient: {
        userId: rep.id,
        email: rep.email,
        displayName: rep.displayName,
      },
      brand: {
        id: campaign.brandId,
        name: campaign.brand.name,
        slug: campaign.brand.slug,
      },
      fromUserId: profile.id,
      payload: {
        campaignTitle: campaign.title,
        campaignId: id,
        amountLabel: formatPayout(split.netCents),
        ctaUrl: '/billing',
      },
      idempotencyKey: `payout.ready:${payout.id}`,
    });
    if (!rep.stripeConnectAccountId || !rep.stripeConnectPayoutsEnabled) {
      notifyAsync({
        event: 'connect.required',
        recipient: { userId: rep.id, email: rep.email, displayName: rep.displayName },
        payload: { campaignTitle: campaign.title, ctaUrl: '/billing' },
        idempotencyKey: `connect.required:${rep.id}:${payout.id}`,
      });
    }

    return NextResponse.json({
      url: session.url,
      payout: serializePayout(payout),
      practiceHref: practiceHref(campaign),
      notice: `Checkout ready — ${formatPayout(split.grossCents)} charged; SDR gets ${formatPayout(split.netCents)}.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Campaign payout error:', error);
    return NextResponse.json({ error: error.message || 'Payout failed' }, { status: 500 });
  }
}
