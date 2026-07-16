import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { isApplicationStatus, practiceHref, primaryPayout } from '@/lib/campaigns';
import type { CampaignApplicationStatus } from '@prisma/client';
import {
  defaultAcceptMessage,
  defaultRejectMessage,
  notifyAsync,
  parseBrandDefaults,
} from '@/lib/notifications';
import { trackEvent } from '@/lib/posthog/analytics';

/** Brand manager lists applicants. */
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
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const applications = await prisma.campaignApplication.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            totalPoints: true,
            currentStreak: true,
            badges: true,
            stripeConnectPayoutsEnabled: true,
            stripeConnectAccountId: true,
            repProfile: { select: { slug: true, verified: true } },
          },
        },
        payouts: true,
      },
    });

    return NextResponse.json({
      applications: applications.map((a) => {
        const payout = primaryPayout(a.payouts);
        return {
        id: a.id,
        status: a.status,
        message: a.message,
        brandDecisionMessage: a.brandDecisionMessage,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        payout: payout
          ? {
              id: payout.id,
              status: payout.status,
              grossCents: payout.grossCents,
              netCents: payout.netCents,
              platformFeeCents: payout.platformFeeCents,
              paidAt: payout.paidAt,
            }
          : null,
        applicant: {
          id: a.user.id,
          displayName: a.user.displayName,
          totalPoints: a.user.totalPoints,
          streak: a.user.currentStreak,
          verified: a.user.repProfile?.verified || false,
          profileSlug: a.user.repProfile?.slug || null,
          connectReady: Boolean(
            a.user.stripeConnectAccountId && a.user.stripeConnectPayoutsEnabled
          ),
        },
      };
      }),
      practiceHref: practiceHref(campaign),
      payoutPerResult: {
        payoutCents: campaign.payoutCents,
        platformFeeBps: campaign.platformFeeBps,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH — brand accepts / rejects / activates applicant.
 * Body: { applicationId, status, message?, sendEmail?, saveAsDefault? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            logoUrl: true,
            notificationDefaultsJSON: true,
          },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const applicationId = String(body.applicationId || '').trim();
    let status = body.status as CampaignApplicationStatus;
    if (!applicationId || !isApplicationStatus(status)) {
      return NextResponse.json(
        { error: 'applicationId and valid status required' },
        { status: 400 }
      );
    }

    if (status === 'ACCEPTED') status = 'ACTIVE';

    const app = await prisma.campaignApplication.findFirst({
      where: { id: applicationId, campaignId: id },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const defaults = parseBrandDefaults(campaign.brand.notificationDefaultsJSON);
    let decisionMessage =
      body.message != null ? String(body.message).slice(0, 4000) : null;

    if (status === 'ACTIVE' && !decisionMessage?.trim()) {
      decisionMessage =
        defaults.acceptMessage ||
        defaultAcceptMessage({
          brandName: campaign.brand.name,
          campaignTitle: campaign.title,
        });
    }
    if (status === 'REJECTED' && !decisionMessage?.trim()) {
      decisionMessage =
        defaults.rejectMessage ||
        defaultRejectMessage({
          brandName: campaign.brand.name,
          campaignTitle: campaign.title,
        });
    }

    if (body.saveAsDefault && decisionMessage && (status === 'ACTIVE' || status === 'REJECTED')) {
      const nextDefaults = {
        ...defaults,
        ...(status === 'ACTIVE'
          ? { acceptMessage: decisionMessage }
          : { rejectMessage: decisionMessage }),
      };
      await prisma.brand.update({
        where: { id: campaign.brand.id },
        data: { notificationDefaultsJSON: JSON.stringify(nextDefaults) },
      });
    }

    const wasAlreadyActive =
      app.status === 'ACTIVE' || app.status === 'ACCEPTED' || app.status === 'COMPLETED';

    const updated = await prisma.campaignApplication.update({
      where: { id: applicationId },
      data: {
        status,
        ...(status === 'ACTIVE' || status === 'REJECTED'
          ? {
              brandDecisionMessage: decisionMessage,
              brandDecidedAt: new Date(),
            }
          : {}),
      },
    });

    const sendEmail = body.sendEmail !== false;
    const brandCtx = {
      id: campaign.brand.id,
      name: campaign.brand.name,
      slug: campaign.brand.slug,
      logoUrl: campaign.brand.logoUrl,
    };

    if (status === 'ACTIVE' && !wasAlreadyActive) {
      trackEvent(app.user.id, 'campaign_accepted', {
        role: 'REP',
        campaignId: campaign.id,
        brandId: campaign.brand.id,
        applicationId: app.id,
      });
      trackEvent(profile.id, 'sdr_application_accepted', {
        role: 'BRAND',
        campaignId: campaign.id,
        brandId: campaign.brand.id,
        applicationId: app.id,
        sdrUserId: app.user.id,
      });
    }

    if (sendEmail && status === 'ACTIVE') {
      notifyAsync({
        event: 'campaign.application.accepted',
        recipient: {
          userId: app.user.id,
          email: app.user.email,
          displayName: app.user.displayName,
        },
        brand: brandCtx,
        fromUserId: profile.id,
        payload: {
          campaignTitle: campaign.title,
          campaignId: campaign.id,
          applicationId: app.id,
          customMessage: decisionMessage || undefined,
          ctaUrl: '/gigs',
        },
        idempotencyKey: `campaign.application.accepted:${app.id}:${updated.updatedAt.toISOString()}`,
      });
    }

    if (sendEmail && status === 'REJECTED') {
      notifyAsync({
        event: 'campaign.application.rejected',
        recipient: {
          userId: app.user.id,
          email: app.user.email,
          displayName: app.user.displayName,
        },
        brand: brandCtx,
        fromUserId: profile.id,
        payload: {
          campaignTitle: campaign.title,
          campaignId: campaign.id,
          applicationId: app.id,
          customMessage: decisionMessage || undefined,
          ctaUrl: '/gigs',
        },
        idempotencyKey: `campaign.application.rejected:${app.id}:${updated.updatedAt.toISOString()}`,
      });
    }

    return NextResponse.json({
      application: updated,
      practiceHref: practiceHref(campaign),
      notice:
        status === 'ACTIVE'
          ? 'Applicant activated — email notification queued.'
          : status === 'REJECTED'
            ? 'Applicant rejected — email notification queued.'
            : `Marked ${status}.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
