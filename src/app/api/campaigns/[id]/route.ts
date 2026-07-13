import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  isCampaignGoalType,
  isCampaignStatus,
  serializeCampaign,
} from '@/lib/campaigns';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
        pack: { select: { id: true, name: true } },
        playbook: { select: { id: true, title: true } },
        _count: { select: { applications: true } },
        applications: {
          where: { userId: profile.id },
          take: 1,
          select: { id: true, status: true },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const manage = canManageBrand(profile, campaign.brand.ownerId);
    const hasApplication = campaign.applications.length > 0;
    if (
      campaign.status !== 'OPEN' &&
      !manage &&
      !hasApplication &&
      campaign.createdByUserId !== profile.id
    ) {
      // Non-managers only see OPEN, or campaigns they already applied to
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { applications, brand, ...rest } = campaign;
    return NextResponse.json({
      campaign: serializeCampaign({
        ...rest,
        brand: { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl },
        myApplication: applications[0] || null,
      }),
      canManage: manage,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const existing = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { ownerId: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, existing.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title != null) data.title = String(body.title).trim().slice(0, 160);
    if (body.description != null) data.description = String(body.description).trim().slice(0, 8000);
    if (body.icpText !== undefined) {
      data.icpText = body.icpText ? String(body.icpText).slice(0, 4000) : null;
    }
    if (isCampaignGoalType(body.goalType)) data.goalType = body.goalType;
    if (isCampaignStatus(body.status)) data.status = body.status;

    if (data.status === 'OPEN') {
      const poolCount = await prisma.brandPhoneNumber.count({
        where: { brandId: existing.brandId, isActive: true },
      });
      const brandPhones = await prisma.brand.findUnique({
        where: { id: existing.brandId },
        select: { twilioPhoneE164: true },
      });
      if (poolCount === 0 && !brandPhones?.twilioPhoneE164?.trim()) {
        return NextResponse.json(
          {
            error:
              'Add local numbers to the brand phone pool before opening this campaign.',
            code: 'PHONE_POOL_EMPTY',
          },
          { status: 400 }
        );
      }
    }

    if (body.payoutCents != null) {
      const payout = Math.max(0, Math.round(Number(body.payoutCents)));
      if (payout < 100) {
        return NextResponse.json({ error: 'payoutCents must be at least 100' }, { status: 400 });
      }
      data.payoutCents = payout;
    }
    if (typeof body.platformFeeBps === 'number') {
      data.platformFeeBps = Math.min(10000, Math.max(0, Math.round(body.platformFeeBps)));
    }
    if (body.minScore !== undefined) {
      data.minScore =
        body.minScore == null || body.minScore === ''
          ? null
          : Math.min(100, Math.max(0, Math.round(Number(body.minScore))));
    }
    if (typeof body.requireCertification === 'boolean') {
      data.requireCertification = body.requireCertification;
    }
    if (body.budgetCents !== undefined) {
      data.budgetCents =
        body.budgetCents == null || body.budgetCents === ''
          ? null
          : Math.max(0, Math.round(Number(body.budgetCents)));
    }
    if (body.maxAwards !== undefined) {
      data.maxAwards =
        body.maxAwards == null || body.maxAwards === ''
          ? null
          : Math.max(1, Math.round(Number(body.maxAwards)));
    }
    if (body.bookingLink !== undefined) {
      data.bookingLink = body.bookingLink
        ? String(body.bookingLink).trim().slice(0, 500)
        : null;
    }
    if (body.targetVertical !== undefined) {
      data.targetVertical = body.targetVertical
        ? String(body.targetVertical).trim().slice(0, 160)
        : null;
    }
    if (body.targetLocation !== undefined) {
      data.targetLocation = body.targetLocation
        ? String(body.targetLocation).trim().slice(0, 160)
        : null;
    }

    if (body.packId !== undefined) {
      const packId = body.packId ? String(body.packId) : null;
      if (packId) {
        const pack = await prisma.productPack.findFirst({
          where: { id: packId, brandId: existing.brandId },
        });
        if (!pack) return NextResponse.json({ error: 'Pack not found on brand' }, { status: 400 });
      }
      data.packId = packId;
    }
    if (body.playbookId !== undefined) {
      const playbookId = body.playbookId ? String(body.playbookId) : null;
      if (playbookId) {
        const pb = await prisma.playbook.findFirst({
          where: { id: playbookId, brandId: existing.brandId },
        });
        if (!pb) return NextResponse.json({ error: 'Playbook not found on brand' }, { status: 400 });
      }
      data.playbookId = playbookId;
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        pack: { select: { id: true, name: true } },
        playbook: { select: { id: true, title: true } },
        _count: { select: { applications: true } },
      },
    });

    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
