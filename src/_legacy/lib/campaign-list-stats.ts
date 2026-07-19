import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  APPROVED,
  APPLICANT,
  emptyCampaignListStats,
  type CampaignListStats,
} from '@/lib/campaign-list-stats-shared';

export type { CampaignListStats } from '@/lib/campaign-list-stats-shared';
export {
  emptyCampaignListStats,
  statsFromDemoProgress,
} from '@/lib/campaign-list-stats-shared';

const CALLED = new Set(['warming', 'dialing', 'done']);
const GOAL = new Set(['done']);

/** Aggregate team + lead results for campaign list cards. */
export async function loadCampaignListStats(
  campaignIds: string[]
): Promise<Map<string, CampaignListStats>> {
  const map = new Map<string, CampaignListStats>();
  for (const id of campaignIds) map.set(id, emptyCampaignListStats());
  if (campaignIds.length === 0) return map;

  const [appGroups, prospectGroups] = await Promise.all([
    prisma.campaignApplication.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
  ]);

  for (const row of appGroups) {
    const stats = map.get(row.campaignId);
    if (!stats) continue;
    const n = row._count._all;
    if (APPROVED.has(row.status)) stats.teamApproved += n;
    else if (APPLICANT.has(row.status)) stats.teamApplicants += n;
  }

  for (const row of prospectGroups) {
    if (!row.campaignId) continue;
    const stats = map.get(row.campaignId);
    if (!stats) continue;
    const n = row._count._all;
    stats.leadCount += n;
    if (CALLED.has(row.status)) stats.calledCount += n;
    if (GOAL.has(row.status)) stats.goalsMet += n;
  }

  for (const stats of map.values()) {
    stats.calledPct =
      stats.leadCount > 0
        ? Math.min(100, Math.round((stats.calledCount / stats.leadCount) * 100))
        : 0;
    stats.goalsPerLead =
      stats.leadCount > 0
        ? Math.round((stats.goalsMet / stats.leadCount) * 1000) / 1000
        : 0;
  }

  return map;
}
