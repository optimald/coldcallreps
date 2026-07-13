import { prisma } from '@/lib/prisma';
import { loadVerifiedGoals } from '@/lib/verified-goals';

export type TeamCampaignMetric = {
  id: string;
  title: string;
  status: string;
  brandKey?: string;
  brandName?: string;
  dials: number;
  verifiedGoals: number;
  lastCallAt: string | null;
};

export type BrandTeamMember = {
  userId: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  campaigns: TeamCampaignMetric[];
  dials: number;
  verifiedGoals: number;
  lastCallAt: string | null;
};

/** Active/accepted SDRs with dials + verified goals per campaign. */
export async function loadBrandTeamRoster(brand: {
  id: string;
  slug: string;
  name: string;
}): Promise<BrandTeamMember[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brand.id },
    select: { id: true },
  });
  const campaignIds = campaigns.map((c) => c.id);
  const active = campaignIds.length
    ? await prisma.campaignApplication.findMany({
        where: {
          campaignId: { in: campaignIds },
          status: { in: ['ACCEPTED', 'ACTIVE'] },
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              repProfile: { select: { slug: true } },
            },
          },
          campaign: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 80,
      })
    : [];

  const byUser = new Map<
    string,
    {
      userId: string;
      name: string;
      slug: string | null;
      avatarUrl: string | null;
      campaigns: { id: string; title: string; status: string }[];
    }
  >();
  for (const a of active) {
    const uid = a.userId;
    const cur = byUser.get(uid) || {
      userId: uid,
      name: a.user?.displayName || 'Rep',
      slug: a.user?.repProfile?.slug || null,
      avatarUrl: a.user?.avatarUrl || null,
      campaigns: [],
    };
    cur.campaigns.push({
      id: a.campaign.id,
      title: a.campaign.title,
      status: a.status,
    });
    byUser.set(uid, cur);
  }

  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return [];

  const [callByUserCampaign, callByUser, goals] = await Promise.all([
    prisma.callLog.groupBy({
      by: ['userId', 'campaignId'],
      where: {
        brandId: brand.id,
        userId: { in: userIds },
        campaignId: { not: null },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.callLog.groupBy({
      by: ['userId'],
      where: { brandId: brand.id, userId: { in: userIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    loadVerifiedGoals({ brandId: brand.id, take: 200 }),
  ]);

  const callMap = new Map<string, { count: number; lastAt: Date | null }>();
  for (const row of callByUserCampaign) {
    if (!row.campaignId) continue;
    callMap.set(`${row.userId}:${row.campaignId}`, {
      count: row._count._all,
      lastAt: row._max.createdAt,
    });
  }

  const userCallMap = Object.fromEntries(
    callByUser.map((c) => [
      c.userId,
      { count: c._count._all, lastAt: c._max.createdAt },
    ])
  );

  const goalsByUserCamp = new Map<string, number>();
  const goalsByUser = new Map<string, number>();
  for (const g of goals) {
    const uid = g.repUserId;
    if (!uid) continue;
    goalsByUser.set(uid, (goalsByUser.get(uid) || 0) + 1);
    if (g.campaignId) {
      const k = `${uid}:${g.campaignId}`;
      goalsByUserCamp.set(k, (goalsByUserCamp.get(k) || 0) + 1);
    }
  }

  const brandKey = brand.slug || brand.id;

  return [...byUser.values()].map((m) => {
    const campaigns: TeamCampaignMetric[] = m.campaigns.map((c) => {
      const call = callMap.get(`${m.userId}:${c.id}`);
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        brandKey,
        brandName: brand.name,
        dials: call?.count || 0,
        verifiedGoals: goalsByUserCamp.get(`${m.userId}:${c.id}`) || 0,
        lastCallAt: call?.lastAt?.toISOString() || null,
      };
    });
    const dialsFromCamps = campaigns.reduce((s, c) => s + c.dials, 0);
    const goalsFromCamps = campaigns.reduce((s, c) => s + c.verifiedGoals, 0);
    const lastFromCamps = campaigns
      .map((c) => c.lastCallAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

    return {
      userId: m.userId,
      name: m.name,
      slug: m.slug,
      avatarUrl: m.avatarUrl,
      campaigns,
      dials: dialsFromCamps || userCallMap[m.userId]?.count || 0,
      verifiedGoals: goalsFromCamps || goalsByUser.get(m.userId) || 0,
      lastCallAt:
        lastFromCamps || userCallMap[m.userId]?.lastAt?.toISOString() || null,
    };
  });
}
