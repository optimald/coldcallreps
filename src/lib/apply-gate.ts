import { prisma } from '@/lib/prisma';
import {
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
} from '@/lib/campaign-tiers';
import { practiceHref } from '@/lib/campaigns';

export type ApplyGateResult =
  | { ok: true; bestScore: number | null; sessionCount: number; certified: boolean }
  | {
      ok: false;
      code: string;
      error: string;
      status: number;
      practiceHref: string;
      bestScore: number | null;
      sessionCount: number;
      minScore: number;
      minPracticeSessions: number;
      requireCertification: boolean;
      certified: boolean;
    };

/**
 * Hard gate: SDRs must practice (and usually certify) before applying to a campaign.
 */
export async function assertCanApplyToCampaign(opts: {
  userId: string;
  campaign: {
    id: string;
    brandId: string;
    packId?: string | null;
    playbookId?: string | null;
    minScore?: number | null;
    requireCertification?: boolean | null;
    minPracticeSessions?: number | null;
  };
}): Promise<ApplyGateResult> {
  const minScore = opts.campaign.minScore ?? DEFAULT_CAMPAIGN_MIN_SCORE;
  const minSessions = opts.campaign.minPracticeSessions ?? DEFAULT_MIN_PRACTICE_SESSIONS;
  const requireCert = opts.campaign.requireCertification !== false;
  const href = practiceHref(opts.campaign) || `/trainer?brandId=${opts.campaign.brandId}`;

  const [sessions, cert] = await Promise.all([
    prisma.trainerSession.findMany({
      where: {
        userId: opts.userId,
        brandId: opts.campaign.brandId,
        ...(opts.campaign.packId ? { packId: opts.campaign.packId } : {}),
      },
      orderBy: { overallScore: 'desc' },
      take: 20,
      select: { id: true, overallScore: true },
    }),
    prisma.certification.findUnique({
      where: {
        brandId_userId: { brandId: opts.campaign.brandId, userId: opts.userId },
      },
      select: { id: true },
    }),
  ]);

  const sessionCount = sessions.length;
  const bestScore = sessions[0]?.overallScore ?? null;
  const certified = Boolean(cert);

  if (sessionCount < minSessions) {
    return {
      ok: false,
      code: 'PRACTICE_REQUIRED',
      error: `Complete at least ${minSessions} AI trainer session${minSessions === 1 ? '' : 's'} on this brand pack before applying.`,
      status: 403,
      practiceHref: href,
      bestScore,
      sessionCount,
      minScore,
      minPracticeSessions: minSessions,
      requireCertification: requireCert,
      certified,
    };
  }

  if (bestScore == null || bestScore < minScore) {
    return {
      ok: false,
      code: 'SCORE_REQUIRED',
      error: `Score at least ${minScore} on a trainer session for this brand (best: ${bestScore ?? 'none'}).`,
      status: 403,
      practiceHref: href,
      bestScore,
      sessionCount,
      minScore,
      minPracticeSessions: minSessions,
      requireCertification: requireCert,
      certified,
    };
  }

  if (requireCert && !certified) {
    return {
      ok: false,
      code: 'CERTIFICATION_REQUIRED',
      error: 'Earn brand certification in the trainer (usually score ≥80) before applying.',
      status: 403,
      practiceHref: href,
      bestScore,
      sessionCount,
      minScore,
      minPracticeSessions: minSessions,
      requireCertification: requireCert,
      certified,
    };
  }

  return { ok: true, bestScore, sessionCount, certified };
}
