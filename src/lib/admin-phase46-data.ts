import 'server-only';

import { prisma } from '@/lib/prisma';

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const dayAgo = () => new Date(Date.now() - 86400000);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

export async function loadAdminDialerOps() {
  const since = daysAgo(7);
  const [
    calls7d,
    completed,
    connected,
    avgDur,
    phones,
    dncCount,
    recentCalls,
    dncEntries,
    byBrand,
  ] = await Promise.all([
    prisma.callLog.count({ where: { createdAt: { gte: since } } }),
    prisma.callLog.count({
      where: {
        createdAt: { gte: since },
        status: { in: ['completed', 'CONNECTED', 'APPOINTMENT_SET'] },
      },
    }),
    prisma.callLog.count({
      where: {
        createdAt: { gte: since },
        OR: [
          { status: { in: ['CONNECTED', 'APPOINTMENT_SET', 'completed'] } },
          { outcome: { in: ['interested', 'appointment_set', 'callback'] } },
        ],
      },
    }),
    prisma.callLog.aggregate({
      where: { createdAt: { gte: since }, duration: { not: null } },
      _avg: { duration: true },
    }),
    prisma.brandPhoneNumber.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: { brand: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.doNotCallEntry.count(),
    prisma.callLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        status: true,
        outcome: true,
        duration: true,
        toNumber: true,
        recordingConsent: true,
        recordingUrl: true,
        needsManualReview: true,
        createdAt: true,
        brandId: true,
        user: { select: { displayName: true, email: true } },
        brand: { select: { name: true, slug: true } },
      },
    }),
    prisma.doNotCallEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.callLog.groupBy({
      by: ['brandId'],
      where: { createdAt: { gte: since }, brandId: { not: null } },
      _count: true,
      _avg: { duration: true },
      orderBy: { _count: { brandId: 'desc' } },
      take: 15,
    }),
  ]);

  const brandIds = [
    ...new Set(
      [
        ...byBrand.map((b) => b.brandId),
        ...dncEntries.map((e) => e.brandId),
      ].filter(Boolean) as string[]
    ),
  ];
  const brands = brandIds.length
    ? await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  const connectRate =
    calls7d > 0 ? Math.round((connected / calls7d) * 1000) / 10 : null;

  return {
    kpis: {
      calls7d,
      completed7d: completed,
      connectRatePct: connectRate,
      avgDurationSec: avgDur._avg.duration
        ? Math.round(avgDur._avg.duration)
        : null,
      activePhones: phones.filter((p) => p.isActive).length,
      dncEntries: dncCount,
    },
    phones: phones.map((p) => ({
      id: p.id,
      e164: p.e164,
      label: p.label,
      areaCode: p.areaCode,
      isActive: p.isActive,
      brandId: p.brandId,
      brandName: p.brand.name,
      brandSlug: p.brand.slug,
      createdAt: p.createdAt.toISOString(),
    })),
    recentCalls: recentCalls.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      repName: c.user.displayName || c.user.email,
      brandName: c.brand?.name ?? null,
    })),
    dncEntries: dncEntries.map((e) => ({
      id: e.id,
      phoneE164: e.phoneE164,
      scope: e.scope,
      brandId: e.brandId,
      brandName: e.brandId ? brandMap.get(e.brandId)?.name ?? null : null,
      reason: e.reason,
      source: e.source,
      createdAt: e.createdAt.toISOString(),
    })),
    brandVolume: byBrand.map((b) => ({
      brandId: b.brandId,
      brandName: b.brandId ? brandMap.get(b.brandId)?.name ?? b.brandId : '—',
      calls: b._count,
      avgDurationSec: b._avg.duration ? Math.round(b._avg.duration) : null,
    })),
  };
}

export async function loadAdminPipelineOps() {
  const [jobs, failed, running, queued, creditMoves, brandsHot, phaseStats] =
    await Promise.all([
      prisma.pipelineJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.pipelineJob.count({ where: { status: 'failed' } }),
      prisma.pipelineJob.count({ where: { status: 'running' } }),
      prisma.pipelineJob.count({ where: { status: 'queued' } }),
      prisma.brandLeadCreditLedger.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.brand.findMany({
        orderBy: { leadCreditsUsedPeriod: 'desc' },
        take: 15,
        select: {
          id: true,
          name: true,
          slug: true,
          leadPlan: true,
          leadCreditsAllotment: true,
          leadCreditsPack: true,
          leadCreditsUsedPeriod: true,
        },
      }),
      Promise.all([
        prisma.prospect.count({ where: { scrapeStatus: 'failed' } }),
        prisma.prospect.count({ where: { webScanStatus: 'failed' } }),
        prisma.prospect.count({ where: { outreachReady: true } }),
        prisma.prospect.count({
          where: { enrichmentStatus: { in: ['failed', 'pending'] } },
        }),
      ]),
    ]);

  return {
    kpis: {
      failedJobs: failed,
      runningJobs: running,
      queuedJobs: queued,
      scrapeFailed: phaseStats[0],
      webScanFailed: phaseStats[1],
      outreachReady: phaseStats[2],
      enrichmentStuck: phaseStats[3],
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      query: j.query,
      location: j.location,
      savedCount: j.savedCount,
      readyCount: j.readyCount,
      errorMessage: j.errorMessage,
      brandId: j.brandId,
      brandName: j.brand.name,
      brandSlug: j.brand.slug,
      campaignId: j.campaignId,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
    creditMoves: creditMoves.map((m) => ({
      id: m.id,
      type: m.type,
      amount: m.amount,
      note: m.note,
      brandName: m.brand.name,
      brandId: m.brandId,
      createdAt: m.createdAt.toISOString(),
    })),
    brandsHot: brandsHot.map((b) => ({
      ...b,
      remaining: b.leadCreditsAllotment + b.leadCreditsPack,
    })),
  };
}

export async function loadAdminVoiceOps() {
  const since = daysAgo(30);
  const [
    sessions30,
    flagged,
    avgScore,
    totalMinutes,
    holdsOpen,
    clips,
    recentSessions,
    byDay,
  ] = await Promise.all([
    prisma.trainerSession.count({ where: { createdAt: { gte: since } } }),
    prisma.trainerSession.count({
      where: {
        createdAt: { gte: since },
        AND: [
          { integrityFlags: { not: null } },
          { NOT: { integrityFlags: '[]' } },
        ],
      },
    }),
    prisma.trainerSession.aggregate({
      where: { createdAt: { gte: since } },
      _avg: { overallScore: true, duration: true },
      _sum: { duration: true },
    }),
    prisma.userProfile.aggregate({
      _sum: { minutesRemaining: true, minutesUsed: true },
    }),
    prisma.minuteHold.count({
      where: { consumedAt: null, expiresAt: { gt: new Date() } },
    }),
    prisma.clip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        durationSec: true,
        r2Key: true,
        mediaUrl: true,
        createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
    }),
    prisma.trainerSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        overallScore: true,
        duration: true,
        focusArea: true,
        integrityFlags: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    }),
    prisma.$queryRawUnsafe<Array<{ day: string; n: number; secs: number }>>(
      `SELECT date(createdAt) as day, COUNT(*) as n, COALESCE(SUM(duration),0) as secs
       FROM TrainerSession
       WHERE createdAt >= datetime('now', '-14 days')
       GROUP BY date(createdAt)
       ORDER BY day ASC`
    ).catch(() => [] as Array<{ day: string; n: number; secs: number }>),
  ]);

  const practiceSeconds = avgScore._sum.duration ?? 0;
  // Rough unit economics: assume ~$0.05/min xAI voice (configurable later)
  const assumedCostPerMinCents = Number(
    process.env.XAI_VOICE_COST_CENTS_PER_MIN || 5
  );
  const estCostCents = Math.round((practiceSeconds / 60) * assumedCostPerMinCents);

  return {
    kpis: {
      sessions30,
      flagged30: flagged,
      avgScore: avgScore._avg.overallScore
        ? Math.round(avgScore._avg.overallScore)
        : null,
      avgDurationSec: avgScore._avg.duration
        ? Math.round(avgScore._avg.duration)
        : null,
      practiceMinutes30: Math.round(practiceSeconds / 60),
      estXaiCostLabel: money(estCostCents),
      estXaiCostCents: estCostCents,
      minutesRemainingPool: totalMinutes._sum.minutesRemaining ?? 0,
      minutesUsedPool: totalMinutes._sum.minutesUsed ?? 0,
      openHolds: holdsOpen,
      assumedCostPerMinCents,
    },
    series: byDay.map((r) => ({
      day: String(r.day),
      sessions: Number(r.n),
      minutes: Math.round(Number(r.secs) / 60),
    })),
    clips: clips.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      userName: c.user.displayName || c.user.email,
    })),
    recentSessions: recentSessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      flagged: Boolean(s.integrityFlags && s.integrityFlags !== '[]'),
      userName: s.user.displayName || s.user.email,
      userId: s.user.id,
    })),
  };
}

export async function loadAdminCampaignsOps() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      _count: {
        select: { applications: true },
      },
    },
  });

  const accepted = await prisma.campaignApplication.groupBy({
    by: ['campaignId'],
    where: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
    _count: true,
  });
  const acceptedMap = new Map(accepted.map((a) => [a.campaignId, a._count]));

  const open = campaigns.filter((c) => c.status === 'OPEN').length;
  const paused = campaigns.filter((c) => c.status === 'PAUSED').length;
  const escrow = campaigns.reduce((s, c) => s + (c.escrowLockedCents || 0), 0);

  return {
    kpis: {
      total: campaigns.length,
      open,
      paused,
      escrowLockedLabel: money(escrow),
      escrowLockedCents: escrow,
    },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      goalType: c.goalType,
      payoutCents: c.payoutCents,
      platformFeeBps: c.platformFeeBps,
      escrowLockedCents: c.escrowLockedCents,
      applications: c._count.applications,
      accepted: acceptedMap.get(c.id) ?? 0,
      brandId: c.brand.id,
      brandName: c.brand.name,
      brandSlug: c.brand.slug,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function loadAdminContentOps() {
  const [packs, playbooks, bounties, boards, scenarios, academies] =
    await Promise.all([
      prisma.productPack.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { brand: { select: { name: true, slug: true } } },
      }),
      prisma.playbook.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: {
          id: true,
          title: true,
          brandId: true,
          orgId: true,
          updatedAt: true,
          brand: { select: { name: true, slug: true } },
        },
      }),
      prisma.bounty.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { brand: { select: { name: true } } },
      }),
      prisma.sponsoredBoard.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { brand: { select: { name: true } } },
      }),
      prisma.practiceScenario.findMany({
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
      prisma.academy.findMany({
        take: 20,
        select: {
          id: true,
          name: true,
          slug: true,
          orgId: true,
          _count: { select: { members: true, curricula: true } },
        },
      }),
    ]);

  return {
    packs: packs.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
      brandName: p.brand.name,
      brandSlug: p.brand.slug,
      createdAt: p.createdAt.toISOString(),
    })),
    playbooks: playbooks.map((p) => ({
      id: p.id,
      title: p.title,
      brandId: p.brandId,
      brandName: p.brand?.name ?? null,
      brandSlug: p.brand?.slug ?? null,
      orgId: p.orgId,
      updatedAt: p.updatedAt.toISOString(),
    })),
    bounties: bounties.map((b) => ({
      id: b.id,
      title: b.title,
      active: b.active,
      rewardCents: b.rewardCents,
      brandName: b.brand.name,
    })),
    boards: boards.map((b) => ({
      id: b.id,
      title: b.title,
      active: b.active,
      focusArea: b.focusArea,
      brandName: b.brand.name,
    })),
    scenarios: scenarios.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      focusArea: s.focusArea,
      difficulty: s.difficulty,
      active: s.active,
      sortOrder: s.sortOrder,
    })),
    academies: academies.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      orgId: a.orgId,
      members: a._count.members,
      curricula: a._count.curricula,
    })),
  };
}

export async function loadAdminAnalytics() {
  const [
    users,
    withSession,
    withCleared,
    withApp,
    withAccept,
    withPayout,
    brands,
    withCampaign,
    withEscrow,
    withRelease,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.userProfile.count({
      where: { sessions: { some: {} } },
    }),
    prisma.userProfile.count({
      where: {
        sessions: {
          some: {
            OR: [{ integrityFlags: null }, { integrityFlags: '[]' }],
            overallScore: { gte: 60 },
          },
        },
      },
    }),
    prisma.userProfile.count({
      where: { campaignApplications: { some: {} } },
    }),
    prisma.userProfile.count({
      where: {
        campaignApplications: {
          some: { status: { in: ['ACCEPTED', 'ACTIVE'] } },
        },
      },
    }),
    prisma.userProfile.count({
      where: { campaignPayoutsEarned: { some: { status: 'PAID' } } },
    }),
    prisma.userProfile.count({ where: { platformRole: { in: ['BRAND', 'RECRUITER'] } } }),
    prisma.brand.count({ where: { campaigns: { some: {} } } }),
    prisma.brand.count({
      where: { campaigns: { some: { escrowLockedCents: { gt: 0 } } } },
    }),
    prisma.userProfile.count({
      where: { campaignPayoutsPaid: { some: { status: 'PAID' } } },
    }),
  ]);

  const topReps = await prisma.userProfile.findMany({
    where: { totalPoints: { gt: 0 } },
    orderBy: { totalPoints: 'desc' },
    take: 10,
    select: {
      id: true,
      displayName: true,
      email: true,
      totalPoints: true,
      platformRole: true,
    },
  });

  const topBrands = await prisma.brand.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      leadCreditsUsedPeriod: true,
      _count: { select: { campaigns: true, prospects: true } },
      wallet: { select: { balanceCents: true } },
    },
  });

  return {
    sdrFunnel: [
      { step: 'Signup', count: users },
      { step: 'First practice', count: withSession },
      { step: 'Integrity-cleared', count: withCleared },
      { step: 'Campaign applied', count: withApp },
      { step: 'Accepted', count: withAccept },
      { step: 'First payout', count: withPayout },
    ],
    brandFunnel: [
      { step: 'Brand accounts', count: brands },
      { step: 'Campaign posted', count: withCampaign },
      { step: 'Escrow funded', count: withEscrow },
      { step: 'Payout released', count: withRelease },
    ],
    topReps,
    topBrands: topBrands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      campaigns: b._count.campaigns,
      leads: b._count.prospects,
      creditsUsed: b.leadCreditsUsedPeriod,
      walletLabel: money(b.wallet?.balanceCents ?? 0),
    })),
  };
}

export async function loadAdminSystemHealth() {
  const [webhooks, apiKeys, stripeEvents, disputes, configs, notifFails] =
    await Promise.all([
      prisma.webhookEndpoint.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          user: { select: { email: true, displayName: true } },
        },
      }),
      prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          user: { select: { email: true, displayName: true } },
        },
      }),
      prisma.stripeEvent.findMany({
        orderBy: { processedAt: 'desc' },
        take: 30,
      }),
      prisma.stripeDisputeRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.adminConfig.findMany({ orderBy: { key: 'asc' } }),
      prisma.notificationLog.count({
        where: {
          status: 'failed',
          createdAt: { gte: dayAgo() },
        },
      }),
    ]);

  return {
    kpis: {
      webhooks: webhooks.length,
      webhookErrors: webhooks.filter((w) => w.lastError).length,
      apiKeys: apiKeys.length,
      revokedKeys: apiKeys.filter((k) => k.revokedAt).length,
      disputesOpen: disputes.filter((d) =>
        ['needs_response', 'warning_needs_response', 'under_review'].includes(
          d.status
        )
      ).length,
      notifFails24h: notifFails,
    },
    webhooks: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      active: w.active,
      lastError: w.lastError,
      lastAttemptAt: w.lastAttemptAt?.toISOString() ?? null,
      userEmail: w.user.email,
      createdAt: w.createdAt.toISOString(),
    })),
    apiKeys: apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      userEmail: k.user.email,
      createdAt: k.createdAt.toISOString(),
    })),
    stripeEvents: stripeEvents.map((e) => ({
      id: e.id,
      type: e.type,
      processedAt: e.processedAt.toISOString(),
    })),
    disputes: disputes.map((d) => ({
      ...d,
      amountLabel: money(d.amountCents),
      createdAt: d.createdAt.toISOString(),
      evidenceDueBy: d.evidenceDueBy?.toISOString() ?? null,
    })),
    configs: configs.map((c) => ({
      key: c.key,
      valueJSON: c.valueJSON,
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

export async function loadAdminOrgsOps() {
  const pools = await prisma.orgMinutePool.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });

  const orgIds = pools.map((p) => p.orgId);
  const members = orgIds.length
    ? await prisma.userProfile.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds } },
        _count: true,
      })
    : [];
  const memberMap = new Map(members.map((m) => [m.orgId, m._count]));

  const academies = await prisma.academy.findMany({
    take: 40,
    include: {
      _count: { select: { members: true } },
    },
  });

  const teamUsers = await prisma.userProfile.findMany({
    where: { plan: 'TEAM' },
    take: 40,
    select: {
      id: true,
      email: true,
      displayName: true,
      orgId: true,
      minutesRemaining: true,
      plan: true,
    },
  });

  return {
    pools: pools.map((p) => ({
      orgId: p.orgId,
      minutesRemaining: p.minutesRemaining,
      minutesUsed: p.minutesUsed,
      seatsApprox: memberMap.get(p.orgId) ?? 0,
      lastTopUpAt: p.lastTopUpAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    academies: academies.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      orgId: a.orgId,
      members: a._count.members,
    })),
    teamAccounts: teamUsers,
  };
}
