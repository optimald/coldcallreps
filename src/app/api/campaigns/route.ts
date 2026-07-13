import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, effectiveRole } from '@/lib/roles';
import {
  isBudgetMode,
  isCampaignGoalType,
  isCampaignStatus,
  parseOptionalDate,
  serializeCampaign,
} from '@/lib/campaigns';
import { loadCampaignSpendStats } from '@/lib/campaign-spend';
import {
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
  resolvePayoutCents,
} from '@/lib/campaign-tiers';
import { lockEscrowForCampaign } from '@/lib/escrow';

async function serializeWithSpend<T extends { id: string }>(
  campaigns: T[],
  mapFn: (c: T & { spentCents: number; spentTodayCents: number }) => ReturnType<typeof serializeCampaign>
) {
  const spend = await loadCampaignSpendStats(campaigns.map((c) => c.id));
  return campaigns.map((c) => {
    const s = spend.get(c.id) || { spentCents: 0, spentTodayCents: 0 };
    return mapFn({ ...c, ...s });
  });
}

/**
 * GET — authenticated list.
 * - Default: OPEN campaigns (gig marketplace)
 * - ?mine=1: applications for current user
 * - ?brandId=: campaigns for a brand (owner/superadmin see all statuses; others OPEN only)
 */
export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === '1';
    const brandId = searchParams.get('brandId')?.trim() || null;

    if (mine) {
      const applications = await prisma.campaignApplication.findMany({
        where: { userId: profile.id },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: {
          payout: true,
          campaign: {
            include: {
              brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
              pack: { select: { id: true, name: true } },
              playbook: { select: { id: true, title: true } },
            },
          },
        },
      });
      const spend = await loadCampaignSpendStats(applications.map((a) => a.campaign.id));
      return NextResponse.json({
        applications: applications.map((a) => {
          const s = spend.get(a.campaign.id) || { spentCents: 0, spentTodayCents: 0 };
          return {
            id: a.id,
            status: a.status,
            message: a.message,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            payout: a.payout
              ? {
                  id: a.payout.id,
                  status: a.payout.status,
                  netCents: a.payout.netCents,
                  grossCents: a.payout.grossCents,
                  paidAt: a.payout.paidAt,
                }
              : null,
            campaign: serializeCampaign({
              ...a.campaign,
              ...s,
              myApplication: { id: a.id, status: a.status },
            }),
          };
        }),
      });
    }

    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      const manage = canManageBrand(profile, brand.ownerId);
      const campaigns = await prisma.campaign.findMany({
        where: {
          brandId,
          ...(manage ? {} : { status: 'OPEN' }),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          pack: { select: { id: true, name: true } },
          playbook: { select: { id: true, title: true } },
          _count: { select: { applications: true } },
        },
      });
      return NextResponse.json({
        campaigns: await serializeWithSpend(campaigns, (c) => serializeCampaign(c)),
        canManage: manage,
      });
    }

    // Marketplace: OPEN campaigns + attach my application if any
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
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

    const spend = await loadCampaignSpendStats(campaigns.map((c) => c.id));
    return NextResponse.json({
      campaigns: campaigns
        .map((c) => {
          const { applications, ...rest } = c;
          const s = spend.get(c.id) || { spentCents: 0, spentTodayCents: 0 };
          return serializeCampaign({
            ...rest,
            ...s,
            myApplication: applications[0] || null,
          });
        })
        .filter((c) => c.dialEligible),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST — brand owner creates a campaign for their brand. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);
    if (role !== 'BRAND' && role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only Brand accounts can create campaigns.', code: 'ROLE_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const brandId = String(body.brandId || '').trim();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!brandId || !title || !description) {
      return NextResponse.json(
        { error: 'brandId, title, and description required' },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tierId, payoutCents } = resolvePayoutCents({
      tierId: body.pricingTier || body.tierId,
      payoutCents: body.payoutCents != null ? Math.round(Number(body.payoutCents)) : null,
    });

    const goalType = isCampaignGoalType(body.goalType) ? body.goalType : 'BOOKED_MEETING';
    const status = isCampaignStatus(body.status) ? body.status : 'DRAFT';
    const wantsMeeting = goalType === 'BOOKED_MEETING' || goalType === 'BOTH';
    const bookingLink = body.bookingLink ? String(body.bookingLink).trim().slice(0, 500) : null;
    const meetingDurationMinutes =
      body.meetingDurationMinutes != null && body.meetingDurationMinutes !== ''
        ? Math.max(5, Math.min(180, Math.round(Number(body.meetingDurationMinutes))))
        : null;
    const qualifiedPayoutCents =
      body.qualifiedPayoutCents != null
        ? Math.max(0, Math.round(Number(body.qualifiedPayoutCents)))
        : null;

    if (wantsMeeting && !bookingLink) {
      return NextResponse.json(
        {
          error: 'Meeting campaigns require a Cal.com / Calendly / Google Appointment link',
          code: 'BOOKING_LINK_REQUIRED',
        },
        { status: 400 }
      );
    }
    if (wantsMeeting && !meetingDurationMinutes) {
      return NextResponse.json(
        { error: 'Meeting campaigns require meetingDurationMinutes', code: 'DURATION_REQUIRED' },
        { status: 400 }
      );
    }

    if (status === 'OPEN') {
      const poolCount = await prisma.brandPhoneNumber.count({
        where: { brandId, isActive: true },
      });
      const legacy = brand.twilioPhoneE164?.trim();
      if (poolCount === 0 && !legacy) {
        return NextResponse.json(
          {
            error:
              'Add local numbers to the brand phone pool before opening a campaign. SDRs dial with brand caller ID — not personal phones.',
            code: 'PHONE_POOL_EMPTY',
          },
          { status: 400 }
        );
      }
    }

    let packId: string | null = body.packId ? String(body.packId) : null;
    let playbookId: string | null = body.playbookId ? String(body.playbookId) : null;

    if (packId) {
      const pack = await prisma.productPack.findFirst({
        where: { id: packId, brandId },
      });
      if (!pack) return NextResponse.json({ error: 'Pack not found on brand' }, { status: 400 });
    }
    if (playbookId) {
      const pb = await prisma.playbook.findFirst({
        where: { id: playbookId, brandId },
      });
      if (!pb) return NextResponse.json({ error: 'Playbook not found on brand' }, { status: 400 });
    }

    const maxAwards =
      body.maxAwards != null && body.maxAwards !== ''
        ? Math.max(1, Math.round(Number(body.maxAwards)))
        : 10;
    const budgetCents =
      body.budgetCents != null && body.budgetCents !== ''
        ? Math.max(0, Math.round(Number(body.budgetCents)))
        : payoutCents * maxAwards;
    const budgetMode = isBudgetMode(body.budgetMode) ? body.budgetMode : 'OVERALL';
    const dailyBudgetCents =
      body.dailyBudgetCents != null && body.dailyBudgetCents !== ''
        ? Math.max(0, Math.round(Number(body.dailyBudgetCents)))
        : null;
    if (budgetMode === 'DAILY' && (dailyBudgetCents == null || dailyBudgetCents <= 0)) {
      return NextResponse.json(
        { error: 'dailyBudgetCents required when budgetMode is DAILY', code: 'DAILY_BUDGET_REQUIRED' },
        { status: 400 }
      );
    }

    const startsAtParsed = parseOptionalDate(body.startsAt);
    if (body.startsAt !== undefined && startsAtParsed === undefined) {
      return NextResponse.json({ error: 'Invalid startsAt' }, { status: 400 });
    }
    const endsAtParsed = parseOptionalDate(body.endsAt);
    if (body.endsAt !== undefined && endsAtParsed === undefined) {
      return NextResponse.json({ error: 'Invalid endsAt' }, { status: 400 });
    }
    const startsAt =
      startsAtParsed !== undefined
        ? startsAtParsed
        : status === 'OPEN'
          ? new Date()
          : null;
    const endsAt = endsAtParsed !== undefined ? endsAtParsed : null;

    const minScore =
      body.minScore != null && body.minScore !== ''
        ? Math.min(100, Math.max(0, Math.round(Number(body.minScore))))
        : DEFAULT_CAMPAIGN_MIN_SCORE;
    const requireCertification =
      body.requireCertification === undefined
        ? DEFAULT_REQUIRE_CERTIFICATION
        : Boolean(body.requireCertification);
    const minPracticeSessions =
      body.minPracticeSessions != null && body.minPracticeSessions !== ''
        ? Math.max(0, Math.round(Number(body.minPracticeSessions)))
        : DEFAULT_MIN_PRACTICE_SESSIONS;

    const campaign = await prisma.campaign.create({
      data: {
        brandId,
        createdByUserId: profile.id,
        title: title.slice(0, 160),
        description: description.slice(0, 8000),
        icpText: body.icpText ? String(body.icpText).slice(0, 4000) : null,
        goalType,
        payoutCents,
        pricingTier: tierId,
        platformFeeBps:
          typeof body.platformFeeBps === 'number'
            ? Math.min(10000, Math.max(0, Math.round(body.platformFeeBps)))
            : 2000,
        status: status === 'OPEN' ? 'DRAFT' : status, // open after escrow lock
        minScore,
        requireCertification,
        minPracticeSessions,
        packId,
        playbookId,
        budgetCents,
        budgetMode,
        dailyBudgetCents: budgetMode === 'DAILY' ? dailyBudgetCents : null,
        startsAt,
        endsAt,
        maxAwards,
        bookingLink,
        meetingDurationMinutes: wantsMeeting ? meetingDurationMinutes : null,
        qualifiedPayoutCents:
          goalType === 'BOTH' || goalType === 'QUALIFIED_LEAD'
            ? qualifiedPayoutCents ?? (goalType === 'QUALIFIED_LEAD' ? payoutCents : null)
            : null,
        targetVertical: body.targetVertical
          ? String(body.targetVertical).trim().slice(0, 160)
          : body.query
            ? String(body.query).trim().slice(0, 160)
            : null,
        targetLocation: body.targetLocation
          ? String(body.targetLocation).trim().slice(0, 160)
          : body.location
            ? String(body.location).trim().slice(0, 160)
            : null,
      },
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        pack: { select: { id: true, name: true } },
        playbook: { select: { id: true, title: true } },
        _count: { select: { applications: true } },
      },
    });

    if (status === 'OPEN') {
      try {
        await lockEscrowForCampaign({
          brandId,
          campaignId: campaign.id,
          amountCents: budgetCents,
        });
        const opened = await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'OPEN',
            startsAt: campaign.startsAt || new Date(),
          },
          include: {
            brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
            pack: { select: { id: true, name: true } },
            playbook: { select: { id: true, title: true } },
            _count: { select: { applications: true } },
          },
        });
        return NextResponse.json({
          campaign: serializeCampaign({
            ...opened,
            spentCents: 0,
            spentTodayCents: 0,
          }),
        });
      } catch (e: unknown) {
        await prisma.campaign.delete({ where: { id: campaign.id } }).catch(() => {});
        const msg = e instanceof Error ? e.message : 'Escrow lock failed';
        return NextResponse.json({ error: msg, code: 'ESCROW_INSUFFICIENT' }, { status: 400 });
      }
    }

    return NextResponse.json({
      campaign: serializeCampaign({
        ...campaign,
        spentCents: 0,
        spentTodayCents: 0,
      }),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
