/** Client-safe types for Super Admin surfaces (no server-only imports). */

export type AdminPlatformOverview = {
  kpis: {
    brandCount: number;
    userCount: number;
    openCampaigns: number;
    activeSdrs: number;
    outreachReady: number;
    dialers24h: number;
    leadToRepRatio: number | null;
    callsToday: number;
    connectRatePct: number | null;
    auditFailRatePct: number | null;
    claims30d: number;
    claimsFailed30d: number;
    tvlCents: number;
    tvlLabel: string;
    walletCents: number;
    escrowLockedCents: number;
    gmvMtdCents: number;
    gmvMtdLabel: string;
    gmv30dCents: number;
    gmv30dLabel: string;
    takeRateMtdCents: number;
    takeRateMtdLabel: string;
    takeRate30dCents: number;
    takeRate30dLabel: string;
    netRevenueMtdCents: number;
    netRevenueMtdLabel: string;
    leadPlanMrrCents: number;
    leadPlanMrrLabel: string;
    sdrSubMrrCents: number;
    sdrSubMrrLabel: string;
    estimatedMrrCents: number;
    estimatedMrrLabel: string;
    pendingPayoutCount: number;
    pendingPayoutGrossCents: number;
    pendingPayoutLabel: string;
    reviewQueue: number;
    brandsAtRisk: number;
    failedJobs: number;
    flaggedSessions: number;
  };
  liquiditySeries: Array<{
    key: string;
    label: string;
    leads: number;
    dials: number;
    goals: number;
    spendCents: number;
  }>;
  fraudScatter: Array<{
    repUserId: string;
    name: string;
    bookings: number;
    failRatePct: number;
    failed: number;
  }>;
  alerts: Array<{
    id: string;
    severity: 'info' | 'warn' | 'bad';
    title: string;
    detail: string;
    href?: string;
  }>;
  exceptions: Array<{
    brandId: string;
    brandKey: string;
    brandName: string;
    label: string;
    detail: string;
    tone: string;
  }>;
  pipelineFailed: Array<{
    id: string;
    query: string;
    location: string;
    error: string | null;
    brandName: string;
    brandKey: string;
    createdAt: string;
  }>;
  audits: Array<{
    id: string;
    action: string;
    targetId: string | null;
    createdAt: string;
    actorEmail: string;
    actorName: string | null;
  }>;
  period: { from: string; to: string };
};

export type AdminBrandsMatrix = {
  brands: Array<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    ownerEmail: string | null;
    ownerName: string | null;
    leadPlan: string;
    creditsRemaining: number;
    openCampaigns: number;
    activeSdrs: number;
    dialReady: number;
    balanceCents: number;
    walletLabel: string;
    goals7d: number;
    costPerGoalLabel: string;
    runwayDays: number | null;
    risk: number;
    topSignal: { label: string; detail: string; tone: string } | null;
    createdAt: string;
  }>;
  generatedAt: string;
};

export type AdminReviewQueue = {
  calls: Array<{
    id: string;
    kind: 'call';
    status: string;
    outcome: string | null;
    durationSec: number | null;
    recordingUrl: string | null;
    transcript: string | null;
    aiAuditResult: string | null;
    createdAt: string;
    brandId: string | null;
    brandKey: string | null;
    brandName: string | null;
    campaignId: string | null;
    prospectId: string | null;
    companyName: string | null;
    repName: string;
    repEmail: string | null;
    repUserId: string;
  }>;
  claims: Array<{
    id: string;
    kind: 'claim';
    status: string;
    auditScore: number | null;
    auditJSON: string | null;
    failureReason: string | null;
    notes: string | null;
    transcriptSnippet: string | null;
    prospectName: string | null;
    meetingAt: string | null;
    callLogId: string | null;
    createdAt: string;
    campaignId: string;
    campaignTitle: string;
    brandId: string;
    brandKey: string;
    brandName: string;
    brandOwnerId: string | null;
    repName: string;
    repEmail: string | null;
    repUserId: string;
  }>;
};
