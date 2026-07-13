import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { canManageBrand } from '@/lib/roles';
import { getMinuteBalance } from '@/lib/minutes';
import { PLAN, type PlanKey } from '@/lib/product';
import { billablePracticeMinutes } from '@/lib/trainer/session-utils';
import { getStripe } from '@/lib/stripe';

function parseSince(raw: string | null): Date | null {
  if (!raw) return null;
  const preset = raw.trim().toLowerCase();
  const now = Date.now();
  if (preset === '7d' || preset === 'week') return new Date(now - 7 * 86400_000);
  if (preset === '30d' || preset === 'month') return new Date(now - 30 * 86400_000);
  if (preset === '90d') return new Date(now - 90 * 86400_000);
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const brandId = searchParams.get('brandId')?.trim() || '';
    const repId = searchParams.get('repId')?.trim() || '';
    const since = parseSince(searchParams.get('since'));
    const includeCampaign = searchParams.get('includeCampaign') === '1' || !brandId;

    let where: Record<string, unknown> = { userId: profile.id };
    if (since) where = { ...where, createdAt: { gte: since } };

    if (brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: brandId },
        select: { id: true, ownerId: true },
      });
      if (!brand || !canManageBrand(profile, brand.ownerId)) {
        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      }
      where = { brandId: brand.id, ...(since ? { createdAt: { gte: since } } : {}) };
      if (repId) where = { ...where, userId: repId };
    }

    const sessions = await prisma.trainerSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        prospectId: true,
        brandId: true,
        packId: true,
        scenarioType: true,
        focusArea: true,
        difficulty: true,
        overallScore: true,
        pointsEarned: true,
        duration: true,
        outcome: true,
        createdAt: true,
        prospect: { select: { companyName: true } },
        user: { select: { displayName: true, email: true } },
        clips: {
          where: { status: 'ready' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    const brandIds = [
      ...new Set(sessions.map((s) => s.brandId).filter((id): id is string => Boolean(id))),
    ];
    const brands = brandIds.length
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

    const packIds = [
      ...new Set(sessions.map((s) => s.packId).filter((id): id is string => Boolean(id))),
    ];
    const playbooks = packIds.length
      ? await prisma.playbook.findMany({
          where: { id: { in: packIds } },
          select: { id: true, title: true },
        })
      : [];
    const packNameById = new Map(playbooks.map((p) => [p.id, p.title]));

    let featuredClipIds: string[] = [];
    if (!brandId) {
      const rep = await prisma.repProfile.findUnique({
        where: { userId: profile.id },
        select: { featuredClipIdsJSON: true },
      });
      try {
        featuredClipIds = JSON.parse(rep?.featuredClipIdsJSON || '[]');
      } catch {
        featuredClipIds = [];
      }
    }
    const featuredSet = new Set(Array.isArray(featuredClipIds) ? featuredClipIds : []);

    type PastCallRow = {
      id: string;
      kind: 'training' | 'campaign';
      userId: string;
      prospectId: string | null;
      brandId: string | null;
      packId: string | null;
      scenarioType: string;
      focusArea: string;
      difficulty: string | null;
      overallScore: number | null;
      pointsEarned: number;
      duration: number;
      minutesCharged: number;
      outcome: string | null;
      disposition: string | null;
      goalMet: boolean;
      valueCents: number | null;
      createdAt: string;
      leadCompany: string | null;
      brandName: string | null;
      packName: string | null;
      campaignTitle: string | null;
      repName: string;
      hasRecording: boolean;
      clipId: string | null;
      isFeatured: boolean;
      href: string;
    };

    const trainingRows: PastCallRow[] = sessions.map((s) => {
      const clipId = s.clips[0]?.id || null;
      const minutesCharged = billablePracticeMinutes(s.duration);
      const goalMet = s.outcome === 'appointment_set';
      return {
        id: s.id,
        kind: 'training',
        userId: s.userId,
        prospectId: s.prospectId,
        brandId: s.brandId,
        packId: s.packId,
        scenarioType: s.scenarioType,
        focusArea: s.focusArea,
        difficulty: s.difficulty,
        overallScore: s.overallScore,
        pointsEarned: s.pointsEarned,
        duration: s.duration,
        minutesCharged,
        outcome: s.outcome,
        disposition: s.outcome,
        goalMet,
        valueCents: null,
        createdAt: s.createdAt.toISOString(),
        leadCompany: s.prospect?.companyName || null,
        brandName: s.brandId ? brandNameById.get(s.brandId) || null : null,
        packName: s.packId ? packNameById.get(s.packId) || null : null,
        campaignTitle: null,
        repName: s.user?.displayName || s.user?.email || 'Rep',
        hasRecording: true,
        clipId,
        isFeatured: clipId ? featuredSet.has(clipId) : false,
        href: `/sessions/${s.id}`,
      };
    });

    let campaignRows: PastCallRow[] = [];

    if (includeCampaign && !brandId) {
      const callLogs = await prisma.callLog.findMany({
        where: {
          userId: profile.id,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          userId: true,
          prospectId: true,
          brandId: true,
          campaignId: true,
          status: true,
          duration: true,
          outcome: true,
          createdAt: true,
          prospect: { select: { companyName: true } },
          brand: { select: { id: true, name: true } },
        },
      });

      const campaignIds = [
        ...new Set(callLogs.map((c) => c.campaignId).filter((id): id is string => Boolean(id))),
      ];
      const campaigns = campaignIds.length
        ? await prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true, payoutCents: true },
          })
        : [];
      const campaignById = new Map(campaigns.map((c) => [c.id, c]));

      const callLogIds = callLogs.map((c) => c.id);
      const claims =
        callLogIds.length > 0
          ? await prisma.appointmentClaim.findMany({
              where: { callLogId: { in: callLogIds }, repUserId: profile.id },
              select: {
                callLogId: true,
                status: true,
                campaignId: true,
                campaign: { select: { payoutCents: true } },
              },
            })
          : [];
      const claimByCallLog = new Map(
        claims.filter((c) => c.callLogId).map((c) => [c.callLogId as string, c])
      );

      campaignRows = callLogs.map((c) => {
        const campaign = c.campaignId ? campaignById.get(c.campaignId) : null;
        const claim = claimByCallLog.get(c.id);
        const disposition =
          c.outcome ||
          (c.status === 'APPOINTMENT_SET'
            ? 'appointment_set'
            : c.status === 'NO_ANSWER'
              ? 'no_answer'
              : null);
        const goalMet =
          disposition === 'appointment_set' ||
          c.status === 'APPOINTMENT_SET' ||
          Boolean(claim && (claim.status === 'PASSED' || claim.status === 'PAID'));
        const valueCents = goalMet
          ? claim?.campaign?.payoutCents ?? campaign?.payoutCents ?? null
          : null;
        const href = c.prospectId
          ? `/leads/${c.prospectId}`
          : c.campaignId
            ? `/campaigns/${c.campaignId}`
            : '/outbound';

        return {
          id: c.id,
          kind: 'campaign',
          userId: c.userId,
          prospectId: c.prospectId,
          brandId: c.brandId,
          packId: null,
          scenarioType: 'outbound',
          focusArea: 'outbound',
          difficulty: null,
          overallScore: null,
          pointsEarned: 0,
          duration: c.duration ?? 0,
          minutesCharged: 0,
          outcome: disposition,
          disposition,
          goalMet,
          valueCents,
          createdAt: c.createdAt.toISOString(),
          leadCompany: c.prospect?.companyName || null,
          brandName: c.brand?.name || null,
          packName: null,
          campaignTitle: campaign?.title || null,
          repName: profile.displayName || profile.email || 'Rep',
          hasRecording: true,
          clipId: null,
          isFeatured: false,
          href,
        };
      });
    }

    const calls = [...trainingRows, ...campaignRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const balance = await getMinuteBalance(profile);
    const planKey = (profile.plan || 'FREE') as PlanKey;
    const planMeta = PLAN[planKey] || PLAN.FREE;
    const periodMinutes =
      planKey === 'FREE'
        ? null
        : typeof planMeta.minutes === 'number'
          ? planMeta.minutes
          : null;

    let renewsAt: string | null = null;
    let renewNote: string;
    if (profile.stripeSubscriptionId && planKey !== 'FREE') {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
        if (sub.current_period_end) {
          renewsAt = new Date(sub.current_period_end * 1000).toISOString();
        }
        renewNote = renewsAt
          ? `Practice minutes renew on ${new Date(renewsAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} with your ${planMeta.label} plan.`
          : `${planMeta.label} plan — ${periodMinutes ?? '—'} practice minutes / mo.`;
      } catch {
        renewNote = `${planMeta.label} plan — ${periodMinutes ?? '—'} practice minutes renew each billing cycle.`;
      }
    } else if (planKey === 'FREE') {
      renewNote = `Free trial minutes do not renew. Buy a minute pack or upgrade for a monthly allotment.`;
    } else {
      renewNote = `${planMeta.label} plan includes ${periodMinutes ?? '—'} practice minutes / mo.`;
    }

    const trainingInWindow = trainingRows;
    const minutesConsumedInWindow = trainingInWindow.reduce(
      (sum, row) => sum + (row.minutesCharged || 0),
      0
    );

    return NextResponse.json({
      /** @deprecated prefer `calls` — kept for older clients */
      sessions: trainingRows,
      calls,
      minutesRemaining: balance.available,
      minutesUsed: profile.minutesUsed,
      totalPoints: profile.totalPoints,
      streak: profile.currentStreak,
      minuteSummary: {
        remaining: balance.available,
        usedLifetime: profile.minutesUsed,
        consumedInWindow: minutesConsumedInWindow,
        plan: planKey,
        planLabel: planMeta.label,
        planMinutes: periodMinutes,
        renewsAt,
        renewNote,
        trainingChargesPracticeMinutes: true,
        campaignChargesPracticeMinutes: false,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
