import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  formatPayout,
  isBudgetMode,
  isCampaignGoalType,
  isCampaignStatus,
  parseOptionalDate,
  serializeCampaign,
} from '@/lib/campaigns';
import { shouldAutoDeactivate, statusWhenActivating } from '@/lib/campaign-schedule';
import { loadOneCampaignSpend } from '@/lib/campaign-spend';
import { lockEscrowForCampaign } from '@/lib/escrow';
import { notifyAsync, notifyCampaignSdrs } from '@/lib/notifications';

const campaignInclude = {
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  pack: { select: { id: true, name: true } },
  playbook: { select: { id: true, title: true } },
  _count: { select: { applications: true } },
} as const;

async function applyEndDateAutoPause<T extends {
  id: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
}>(campaign: T): Promise<T> {
  if (!shouldAutoDeactivate(campaign.status, campaign)) return campaign;
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'PAUSED' },
  });
  return { ...campaign, status: updated.status };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    let campaign = await prisma.campaign.findUnique({
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

    campaign = await applyEndDateAutoPause(campaign);

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

    const spend = await loadOneCampaignSpend(campaign.id);
    const { applications, brand, ...rest } = campaign;
    return NextResponse.json({
      campaign: serializeCampaign({
        ...rest,
        ...spend,
        brand: { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl },
        myApplication: applications[0] || null,
      }),
      canManage: manage,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      include: {
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, existing.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    const configKeys = [
      'title',
      'description',
      'icpText',
      'goalType',
      'payoutCents',
      'platformFeeBps',
      'minScore',
      'requireCertification',
      'budgetCents',
      'budgetMode',
      'dailyBudgetCents',
      'startsAt',
      'endsAt',
      'bookingLink',
      'meetingDurationMinutes',
      'qualifiedPayoutCents',
      'targetVertical',
      'targetLocation',
      'maxAwards',
      'playbookId',
      'packId',
    ] as const;
    const isConfigEdit = configKeys.some((k) => body[k] !== undefined);
    const deactivating =
      body.activateOn === false ||
      body.status === 'PAUSED' ||
      body.status === 'DRAFT' ||
      body.status === 'CLOSED';
    if (
      isConfigEdit &&
      existing.status === 'OPEN' &&
      !deactivating &&
      body.activateOn !== true
    ) {
      return NextResponse.json(
        {
          error: 'Deactivate the campaign before editing schedule, targeting, or budget.',
          code: 'CAMPAIGN_ACTIVE_LOCKED',
        },
        { status: 400 }
      );
    }

    if (body.title != null) data.title = String(body.title).trim().slice(0, 160);
    if (body.description != null) data.description = String(body.description).trim().slice(0, 8000);
    if (body.icpText !== undefined) {
      data.icpText = body.icpText ? String(body.icpText).slice(0, 4000) : null;
    }
    if (isCampaignGoalType(body.goalType)) data.goalType = body.goalType;
    if (isCampaignStatus(body.status)) {
      if (existing.status === 'CLOSED' && body.status !== 'CLOSED') {
        return NextResponse.json(
          { error: 'Closed campaigns cannot be reactivated.', code: 'CAMPAIGN_CLOSED' },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    // Activate: ON follows schedule (OPEN unless end already passed). OFF = PAUSED.
    if (typeof body.activateOn === 'boolean') {
      if (existing.status === 'CLOSED') {
        return NextResponse.json(
          { error: 'Closed campaigns cannot be toggled.', code: 'CAMPAIGN_CLOSED' },
          { status: 400 }
        );
      }
      if (body.activateOn) {
        const nextStarts =
          body.startsAt !== undefined
            ? parseOptionalDate(body.startsAt) ?? null
            : existing.startsAt;
        const nextEnds =
          body.endsAt !== undefined
            ? parseOptionalDate(body.endsAt) ?? null
            : existing.endsAt;
        data.status = statusWhenActivating({
          startsAt: nextStarts === undefined ? existing.startsAt : nextStarts,
          endsAt: nextEnds === undefined ? existing.endsAt : nextEnds,
        });
        if (data.status === 'PAUSED') {
          return NextResponse.json(
            {
              error: 'End date has already passed — update the schedule before activating.',
              code: 'SCHEDULE_ENDED',
            },
            { status: 400 }
          );
        }
      } else if (
        existing.status === 'OPEN' ||
        existing.status === 'DRAFT' ||
        existing.status === 'PAUSED'
      ) {
        data.status = 'PAUSED';
      }
    }

    const opening =
      data.status === 'OPEN' && existing.status !== 'OPEN';
    if (opening) {
      const nextPlaybookId =
        (data.playbookId as string | null | undefined) ?? existing.playbookId;
      if (!nextPlaybookId) {
        return NextResponse.json(
          {
            error: 'Attach a playbook before activating this campaign.',
            code: 'PLAYBOOK_REQUIRED',
          },
          { status: 400 }
        );
      }

      const meeting =
        (data.payoutCents as number | undefined) ?? existing.payoutCents ?? 0;
      const qualified =
        (data.qualifiedPayoutCents as number | null | undefined) ??
        (existing as { qualifiedPayoutCents?: number | null }).qualifiedPayoutCents ??
        0;
      const minPayout = Math.max(meeting, qualified || 0, 0);
      if (minPayout > 0) {
        const { getOrCreateBrandWallet } = await import('@/lib/escrow');
        const wallet = await getOrCreateBrandWallet(existing.brandId);
        const available = wallet.balanceCents + (existing.escrowLockedCents || 0);
        if (available < minPayout) {
          return NextResponse.json(
            {
              error: `Wallet needs at least $${(minPayout / 100).toFixed(0)} (one highest goal payout) before activating.`,
              code: 'ACTIVATE_BALANCE_INSUFFICIENT',
              requiredCents: minPayout,
              availableCents: available,
            },
            { status: 400 }
          );
        }
      }

      const poolCount = await prisma.brandPhoneNumber.count({
        where: { brandId: existing.brandId, isActive: true },
      });
      const brandPhones = await prisma.brand.findUnique({
        where: { id: existing.brandId },
        select: { twilioPhoneE164: true },
      });
      if (poolCount === 0 && !brandPhones?.twilioPhoneE164?.trim()) {
        notifyAsync({
          event: 'brand.phone_pool.empty',
          recipient: { userId: profile.id },
          brand: {
            id: existing.brand.id,
            name: existing.brand.name,
            slug: existing.brand.slug,
            logoUrl: existing.brand.logoUrl,
          },
          payload: {
            campaignTitle: existing.title,
            campaignId: id,
            ctaUrl: `/brands/${existing.brand.slug}/settings`,
            forAudience: 'brand',
          },
          idempotencyKey: `brand.phone_pool.empty:${existing.brandId}:${id}`,
        });
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

    const spend = await loadOneCampaignSpend(id);

    if (body.budgetCents !== undefined) {
      if (body.budgetCents == null || body.budgetCents === '') {
        data.budgetCents = null;
      } else {
        let next = Math.max(0, Math.round(Number(body.budgetCents)));
        if (next < spend.spentCents) {
          next = spend.spentCents;
        }
        data.budgetCents = next;
      }
    }
    if (isBudgetMode(body.budgetMode)) {
      data.budgetMode = body.budgetMode;
    }
    if (body.dailyBudgetCents !== undefined) {
      if (body.dailyBudgetCents == null || body.dailyBudgetCents === '') {
        data.dailyBudgetCents = null;
      } else {
        let next = Math.max(0, Math.round(Number(body.dailyBudgetCents)));
        if (next < spend.spentTodayCents) {
          next = spend.spentTodayCents;
        }
        data.dailyBudgetCents = next;
      }
    }

    const nextMode = (data.budgetMode as string) || existing.budgetMode || 'OVERALL';
    const nextDaily =
      data.dailyBudgetCents !== undefined
        ? (data.dailyBudgetCents as number | null)
        : existing.dailyBudgetCents;
    if (nextMode === 'DAILY' && (nextDaily == null || nextDaily <= 0)) {
      return NextResponse.json(
        { error: 'dailyBudgetCents required when budgetMode is DAILY', code: 'DAILY_BUDGET_REQUIRED' },
        { status: 400 }
      );
    }
    if (nextMode === 'OVERALL' && data.budgetMode === 'OVERALL') {
      // leave daily as-is unless cleared
    }

    if (body.startsAt !== undefined) {
      const parsed = parseOptionalDate(body.startsAt);
      if (body.startsAt !== null && body.startsAt !== '' && parsed === undefined) {
        return NextResponse.json({ error: 'Invalid startsAt' }, { status: 400 });
      }
      data.startsAt = parsed === undefined ? null : parsed;
    }
    if (body.endsAt !== undefined) {
      const parsed = parseOptionalDate(body.endsAt);
      if (body.endsAt !== null && body.endsAt !== '' && parsed === undefined) {
        return NextResponse.json({ error: 'Invalid endsAt' }, { status: 400 });
      }
      data.endsAt = parsed === undefined ? null : parsed;
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
    if (body.meetingDurationMinutes !== undefined) {
      data.meetingDurationMinutes =
        body.meetingDurationMinutes == null || body.meetingDurationMinutes === ''
          ? null
          : Math.max(5, Math.min(180, Math.round(Number(body.meetingDurationMinutes))));
    }
    if (body.qualifiedPayoutCents !== undefined) {
      data.qualifiedPayoutCents =
        body.qualifiedPayoutCents == null || body.qualifiedPayoutCents === ''
          ? null
          : Math.max(0, Math.round(Number(body.qualifiedPayoutCents)));
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

    // First activate from DRAFT (or reopen with no escrow yet): lock escrow. Pause never hangs up calls.
    if (opening && existing.escrowLockedCents <= 0) {
      const amount =
        (data.budgetCents as number | null | undefined) ?? existing.budgetCents ?? existing.payoutCents;
      try {
        await lockEscrowForCampaign({
          brandId: existing.brandId,
          campaignId: id,
          amountCents: Math.max(0, amount || 0),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Escrow lock failed';
        notifyAsync({
          event: 'brand.escrow.insufficient',
          recipient: { userId: profile.id },
          brand: {
            id: existing.brand.id,
            name: existing.brand.name,
            slug: existing.brand.slug,
            logoUrl: existing.brand.logoUrl,
          },
          payload: {
            campaignTitle: existing.title,
            campaignId: id,
            reason: msg,
            amountLabel: amount ? formatPayout(amount) : undefined,
            ctaUrl: '/billing',
            forAudience: 'brand',
          },
          idempotencyKey: `brand.escrow.insufficient:${id}:${profile.id}`,
        });
        return NextResponse.json({ error: msg, code: 'ESCROW_INSUFFICIENT' }, { status: 400 });
      }
      if (!existing.startsAt && data.startsAt === undefined) {
        data.startsAt = new Date();
      }
    } else if (opening && !existing.startsAt && data.startsAt === undefined) {
      data.startsAt = new Date();
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      include: campaignInclude,
    });

    const brandCtx = {
      id: existing.brand.id,
      name: existing.brand.name,
      slug: existing.brand.slug,
      logoUrl: existing.brand.logoUrl,
    };
    const prevStatus = existing.status;
    const nextStatus = campaign.status;

    if (nextStatus === 'OPEN' && prevStatus !== 'OPEN') {
      void notifyCampaignSdrs({
        campaignId: id,
        event: 'campaign.opened',
        brand: brandCtx,
        fromUserId: profile.id,
        payload: {
          campaignTitle: campaign.title,
          campaignId: id,
          ctaUrl: '/cold_calls',
        },
      });
      if (opening && existing.brand.ownerId) {
        notifyAsync({
          event: 'escrow.locked',
          recipient: { userId: existing.brand.ownerId },
          brand: brandCtx,
          payload: {
            campaignTitle: campaign.title,
            campaignId: id,
            amountLabel: campaign.escrowLockedCents
              ? formatPayout(campaign.escrowLockedCents)
              : undefined,
            ctaUrl: '/billing',
          },
          idempotencyKey: `escrow.locked:${id}:${campaign.updatedAt.toISOString()}`,
        });
      }
    } else if (nextStatus === 'PAUSED' && prevStatus === 'OPEN') {
      void notifyCampaignSdrs({
        campaignId: id,
        event: 'campaign.paused',
        brand: brandCtx,
        fromUserId: profile.id,
        payload: {
          campaignTitle: campaign.title,
          campaignId: id,
          ctaUrl: '/gigs',
        },
      });
    } else if (nextStatus === 'CLOSED' && prevStatus !== 'CLOSED') {
      void notifyCampaignSdrs({
        campaignId: id,
        event: 'campaign.ended',
        brand: brandCtx,
        fromUserId: profile.id,
        payload: {
          campaignTitle: campaign.title,
          campaignId: id,
          ctaUrl: '/gigs',
        },
      });
    }

    const freshSpend = await loadOneCampaignSpend(id);
    const serialized = serializeCampaign({ ...campaign, ...freshSpend });
    if (
      serialized.remainingOverallCents != null &&
      serialized.budgetCents &&
      serialized.remainingOverallCents <= serialized.budgetCents * 0.15 &&
      serialized.remainingOverallCents > 0 &&
      existing.brand.ownerId
    ) {
      notifyAsync({
        event: 'campaign.budget.low',
        recipient: { userId: existing.brand.ownerId },
        brand: brandCtx,
        payload: {
          campaignTitle: campaign.title,
          campaignId: id,
          amountLabel: `${formatPayout(serialized.remainingOverallCents)} left`,
          ctaUrl: `/brands/${existing.brand.slug}/campaigns/${id}`,
        },
        idempotencyKey: `campaign.budget.low:${id}:${Math.floor(serialized.remainingOverallCents / 1000)}`,
      });
    }
    if (
      (serialized.remainingOverallCents === 0 || serialized.remainingDailyCents === 0) &&
      existing.brand.ownerId &&
      nextStatus === 'OPEN'
    ) {
      notifyAsync({
        event: 'campaign.budget.exhausted',
        recipient: { userId: existing.brand.ownerId },
        brand: brandCtx,
        payload: {
          campaignTitle: campaign.title,
          campaignId: id,
          ctaUrl: `/brands/${existing.brand.slug}/campaigns/${id}`,
        },
        idempotencyKey: `campaign.budget.exhausted:${id}:${serialized.budgetMode}:${new Date().toISOString().slice(0, 10)}`,
      });
    }

    return NextResponse.json({
      campaign: serialized,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
