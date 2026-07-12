import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { isApplicationStatus, practiceHref } from '@/lib/campaigns';
import type { CampaignApplicationStatus } from '@prisma/client';

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
        payout: true,
      },
    });

    return NextResponse.json({
      applications: applications.map((a) => ({
        id: a.id,
        status: a.status,
        message: a.message,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        payout: a.payout
          ? {
              id: a.payout.id,
              status: a.payout.status,
              grossCents: a.payout.grossCents,
              netCents: a.payout.netCents,
              platformFeeCents: a.payout.platformFeeCents,
              paidAt: a.payout.paidAt,
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
      })),
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH — brand accepts / rejects / activates applicant.
 * Body: { applicationId, status }
 * Accepting APPLIED → ACCEPTED or ACTIVE (ACTIVE is the “go work” state).
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
      include: { brand: { select: { ownerId: true } } },
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

    // Brand-driven transitions: prefer ACTIVE when accepting
    if (status === 'ACCEPTED') status = 'ACTIVE';

    const app = await prisma.campaignApplication.findFirst({
      where: { id: applicationId, campaignId: id },
    });
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const updated = await prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { status },
    });

    return NextResponse.json({
      application: updated,
      practiceHref: practiceHref(campaign),
      notice:
        status === 'ACTIVE'
          ? 'Applicant activated — they can practice the brand pack and start the gig.'
          : `Marked ${status}.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
