/** Client-safe campaign list stat shapes + demo aggregation (no Prisma). */

export type CampaignListStats = {
  teamApproved: number;
  teamApplicants: number;
  leadCount: number;
  calledCount: number;
  calledPct: number;
  goalsMet: number;
  goalsPerLead: number;
};

const APPROVED = new Set(['ACTIVE', 'ACCEPTED', 'COMPLETED']);
const APPLICANT = new Set(['APPLIED']);

export function emptyCampaignListStats(): CampaignListStats {
  return {
    teamApproved: 0,
    teamApplicants: 0,
    leadCount: 0,
    calledCount: 0,
    calledPct: 0,
    goalsMet: 0,
    goalsPerLead: 0,
  };
}

export function statsFromDemoProgress(opts: {
  applications?: { status: string }[];
  progress?: {
    targeting?: number;
    conditioning?: number;
    dialingReady?: number;
    dialingActive?: number;
    booked?: number;
  } | null;
}): CampaignListStats {
  const apps = opts.applications || [];
  let teamApproved = 0;
  let teamApplicants = 0;
  for (const a of apps) {
    if (APPROVED.has(a.status)) teamApproved += 1;
    else if (APPLICANT.has(a.status)) teamApplicants += 1;
  }

  const p = opts.progress;
  const leadCount =
    (p?.targeting ?? 0) +
    (p?.conditioning ?? 0) +
    (p?.dialingReady ?? 0) +
    (p?.dialingActive ?? 0) +
    (p?.booked ?? 0);
  const calledCount = (p?.dialingActive ?? 0) + (p?.booked ?? 0) + (p?.dialingReady ?? 0);
  const goalsMet = p?.booked ?? 0;
  return {
    teamApproved,
    teamApplicants,
    leadCount,
    calledCount,
    calledPct: leadCount > 0 ? Math.min(100, Math.round((calledCount / leadCount) * 100)) : 0,
    goalsMet,
    goalsPerLead: leadCount > 0 ? Math.round((goalsMet / leadCount) * 1000) / 1000 : 0,
  };
}

export { APPROVED, APPLICANT };
