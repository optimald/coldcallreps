import 'server-only';

import { prisma } from '@/lib/prisma';
import type { AccountStatus, CampaignPayoutStatus, Prisma } from '@prisma/client';
import { realBrandWhere } from '@/lib/training-leads';

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function loadAdminUserDetail(userId: string) {
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: {
      repProfile: true,
      brandsOwned: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          leadCreditsAllotment: true,
          leadCreditsPack: true,
          createdAt: true,
          wallet: { select: { balanceCents: true } },
        },
      },
      banAppeals: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!user) return null;

  const [
    sessions,
    payoutsEarned,
    payoutsPaid,
    applications,
    callLogs,
    minuteAudits,
    earningsAgg,
  ] = await Promise.all([
    prisma.trainerSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        overallScore: true,
        focusArea: true,
        duration: true,
        integrityFlags: true,
        createdAt: true,
        pointsEarned: true,
      },
    }),
    prisma.campaignPayout.findMany({
      where: { repUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        campaign: { select: { id: true, title: true, brandId: true } },
      },
    }),
    prisma.campaignPayout.findMany({
      where: { brandUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        campaign: { select: { id: true, title: true } },
        repUser: { select: { displayName: true, email: true } },
      },
    }),
    prisma.campaignApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        campaign: { select: { id: true, title: true, brandId: true, status: true } },
      },
    }),
    prisma.callLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        status: true,
        duration: true,
        needsManualReview: true,
        createdAt: true,
        campaignId: true,
        prospectId: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [{ targetId: userId }, { actorId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        actor: { select: { email: true, displayName: true } },
      },
    }),
    prisma.campaignPayout.aggregate({
      where: { repUserId: userId, status: 'PAID' },
      _sum: { netCents: true },
      _count: true,
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      opsRole: user.opsRole,
      accountStatus: user.accountStatus,
      statusReason: user.statusReason,
      statusChangedAt: user.statusChangedAt?.toISOString() ?? null,
      plan: user.plan,
      minutesRemaining: user.minutesRemaining,
      minutesUsed: user.minutesUsed,
      totalPoints: user.totalPoints,
      hiringBoardOptIn: user.hiringBoardOptIn,
      stripeCustomerId: user.stripeCustomerId,
      stripeConnectAccountId: user.stripeConnectAccountId,
      stripeConnectDetailsSubmitted: user.stripeConnectDetailsSubmitted,
      stripeConnectPayoutsEnabled: user.stripeConnectPayoutsEnabled,
      orgId: user.orgId,
      referralCode: user.referralCode,
      referredByCode: user.referredByCode,
      createdAt: user.createdAt.toISOString(),
      repProfile: user.repProfile
        ? {
            slug: user.repProfile.slug,
            verified: user.repProfile.verified,
          }
        : null,
      brandsOwned: user.brandsOwned.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        logoUrl: b.logoUrl,
        creditsRemaining: b.leadCreditsAllotment + b.leadCreditsPack,
        walletCents: b.wallet?.balanceCents ?? 0,
        createdAt: b.createdAt.toISOString(),
      })),
      banAppeals: user.banAppeals.map((a) => ({
        id: a.id,
        status: a.status,
        reason: a.reason,
        response: a.response,
        createdAt: a.createdAt.toISOString(),
        reviewedAt: a.reviewedAt?.toISOString() ?? null,
      })),
    },
    sessions: sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      flagged: Boolean(s.integrityFlags && s.integrityFlags !== '[]'),
    })),
    payoutsEarned: payoutsEarned.map((p) => ({
      id: p.id,
      status: p.status,
      grossCents: p.grossCents,
      netCents: p.netCents,
      platformFeeCents: p.platformFeeCents,
      holdReason: p.holdReason,
      campaignTitle: p.campaign.title,
      campaignId: p.campaign.id,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    payoutsPaid: payoutsPaid.map((p) => ({
      id: p.id,
      status: p.status,
      grossCents: p.grossCents,
      netCents: p.netCents,
      repName: p.repUser.displayName,
      campaignTitle: p.campaign.title,
      createdAt: p.createdAt.toISOString(),
    })),
    applications: applications.map((a) => ({
      id: a.id,
      status: a.status,
      campaignId: a.campaign.id,
      campaignTitle: a.campaign.title,
      campaignStatus: a.campaign.status,
      createdAt: a.createdAt.toISOString(),
    })),
    callLogs: callLogs.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    audits: minuteAudits.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      metaJSON: a.metaJSON,
      createdAt: a.createdAt.toISOString(),
      actorEmail: a.actor?.email ?? 'system',
      actorName: a.actor?.displayName ?? null,
    })),
    earnings: {
      paidCount: earningsAgg._count,
      paidNetCents: earningsAgg._sum.netCents ?? 0,
      paidNetLabel: money(earningsAgg._sum.netCents ?? 0),
    },
  };
}

export async function loadAdminFinanceLedger(opts: {
  status?: CampaignPayoutStatus | 'ALL';
  q?: string;
  take?: number;
}) {
  const take = Math.min(opts.take ?? 100, 200);
  const liveCampaign = { brand: realBrandWhere() };
  const where: Prisma.CampaignPayoutWhereInput = {
    AND: [
      { campaign: liveCampaign },
      ...(opts.status && opts.status !== 'ALL'
        ? [{ status: opts.status as CampaignPayoutStatus }]
        : []),
      ...(opts.q?.trim()
        ? [
            {
              OR: [
                { repUser: { email: { contains: opts.q.trim() } } },
                { repUser: { displayName: { contains: opts.q.trim() } } },
                { brandUser: { email: { contains: opts.q.trim() } } },
                { campaign: { title: { contains: opts.q.trim() } } },
                { id: { contains: opts.q.trim() } },
              ],
            },
          ]
        : []),
    ],
  };

  const [rows, pending, held, disputed, paid30] = await Promise.all([
    prisma.campaignPayout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        campaign: { select: { id: true, title: true, brandId: true } },
        repUser: { select: { id: true, email: true, displayName: true } },
        brandUser: { select: { id: true, email: true, displayName: true } },
      },
    }),
    prisma.campaignPayout.aggregate({
      where: { status: 'PENDING', campaign: liveCampaign },
      _sum: { grossCents: true, platformFeeCents: true, netCents: true },
      _count: true,
    }),
    prisma.campaignPayout.aggregate({
      where: { status: 'HELD', campaign: liveCampaign },
      _sum: { grossCents: true },
      _count: true,
    }),
    prisma.campaignPayout.aggregate({
      where: { status: 'DISPUTED', campaign: liveCampaign },
      _sum: { grossCents: true },
      _count: true,
    }),
    prisma.campaignPayout.aggregate({
      where: {
        status: 'PAID',
        campaign: liveCampaign,
        paidAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      _sum: { grossCents: true, platformFeeCents: true, netCents: true },
      _count: true,
    }),
  ]);

  return {
    summary: {
      pendingCount: pending._count,
      pendingGrossCents: pending._sum.grossCents ?? 0,
      pendingGrossLabel: money(pending._sum.grossCents ?? 0),
      heldCount: held._count,
      heldGrossCents: held._sum.grossCents ?? 0,
      heldGrossLabel: money(held._sum.grossCents ?? 0),
      disputedCount: disputed._count,
      disputedGrossCents: disputed._sum.grossCents ?? 0,
      disputedGrossLabel: money(disputed._sum.grossCents ?? 0),
      paid30Count: paid30._count,
      paid30GrossCents: paid30._sum.grossCents ?? 0,
      paid30GrossLabel: money(paid30._sum.grossCents ?? 0),
      paid30FeeCents: paid30._sum.platformFeeCents ?? 0,
      paid30FeeLabel: money(paid30._sum.platformFeeCents ?? 0),
    },
    payouts: rows.map((p) => ({
      id: p.id,
      status: p.status,
      grossCents: p.grossCents,
      platformFeeCents: p.platformFeeCents,
      netCents: p.netCents,
      grossLabel: money(p.grossCents),
      feeLabel: money(p.platformFeeCents),
      netLabel: money(p.netCents),
      holdReason: p.holdReason,
      disputeReason: p.disputeReason,
      heldAt: p.heldAt?.toISOString() ?? null,
      disputedAt: p.disputedAt?.toISOString() ?? null,
      failureReason: p.failureReason,
      campaignId: p.campaign.id,
      campaignTitle: p.campaign.title,
      brandId: p.campaign.brandId,
      rep: {
        id: p.repUser.id,
        email: p.repUser.email,
        name: p.repUser.displayName,
      },
      brand: {
        id: p.brandUser.id,
        email: p.brandUser.email,
        name: p.brandUser.displayName,
      },
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
  };
}

export async function loadAdminAuditLog(opts: {
  q?: string;
  action?: string;
  take?: number;
}) {
  const take = Math.min(opts.take ?? 80, 200);
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.action?.trim()) {
    where.action = { contains: opts.action.trim() };
  }
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { action: { contains: q } },
      { targetId: { contains: q } },
      { targetType: { contains: q } },
      { actor: { email: { contains: q } } },
      { actor: { displayName: { contains: q } } },
    ];
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { id: true, email: true, displayName: true } },
    },
  });

  return {
    audits: rows.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      metaJSON: a.metaJSON,
      createdAt: a.createdAt.toISOString(),
      actorId: a.actorId,
      actorEmail: a.actor?.email ?? 'system',
      actorName: a.actor?.displayName ?? null,
    })),
  };
}

export async function loadAdminAppealsQueue() {
  const appeals = await prisma.banAppeal.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          accountStatus: true,
          statusReason: true,
          platformRole: true,
        },
      },
    },
  });

  return {
    appeals: appeals.map((a) => ({
      id: a.id,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    })),
  };
}

export type { AccountStatus };
