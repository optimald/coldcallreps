import { prisma } from '@/lib/prisma';
import { utcDayStart, type CampaignSpendStats } from '@/lib/campaigns';

/**
 * Sum verified/paid spend for campaigns (gross cents on CampaignPayout).
 * Counts PENDING + PAID so reserved awards also consume budget.
 */
export async function loadCampaignSpendStats(
  campaignIds: string[],
  now: Date = new Date()
): Promise<Map<string, CampaignSpendStats>> {
  const map = new Map<string, CampaignSpendStats>();
  for (const id of campaignIds) {
    map.set(id, { spentCents: 0, spentTodayCents: 0 });
  }
  if (campaignIds.length === 0) return map;

  const dayStart = utcDayStart(now);
  const rows = await prisma.campaignPayout.groupBy({
    by: ['campaignId'],
    where: {
      campaignId: { in: campaignIds },
      status: { in: ['PENDING', 'PAID'] },
    },
    _sum: { grossCents: true },
  });

  for (const row of rows) {
    const cur = map.get(row.campaignId) || { spentCents: 0, spentTodayCents: 0 };
    cur.spentCents = row._sum.grossCents || 0;
    map.set(row.campaignId, cur);
  }

  const todayRows = await prisma.campaignPayout.groupBy({
    by: ['campaignId'],
    where: {
      campaignId: { in: campaignIds },
      status: { in: ['PENDING', 'PAID'] },
      OR: [
        { paidAt: { gte: dayStart } },
        { AND: [{ paidAt: null }, { createdAt: { gte: dayStart } }] },
      ],
    },
    _sum: { grossCents: true },
  });

  for (const row of todayRows) {
    const cur = map.get(row.campaignId) || { spentCents: 0, spentTodayCents: 0 };
    cur.spentTodayCents = row._sum.grossCents || 0;
    map.set(row.campaignId, cur);
  }

  return map;
}

export async function loadOneCampaignSpend(
  campaignId: string,
  now: Date = new Date()
): Promise<CampaignSpendStats> {
  const map = await loadCampaignSpendStats([campaignId], now);
  return map.get(campaignId) || { spentCents: 0, spentTodayCents: 0 };
}
