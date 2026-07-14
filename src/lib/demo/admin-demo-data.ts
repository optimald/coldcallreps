/**
 * Superadmin Demo desk fixtures — in-memory only.
 * Never written to Postgres. Used when ccr-admin-desk-mode=demo.
 */

import type {
  AdminBrandsMatrix,
  AdminPlatformOverview,
  AdminReviewQueue,
} from '@/lib/admin-platform-types';

export const ADMIN_DEMO_MSG = 'Demo mode — read-only sample (not written to live ops)';

export function isAdminDemoEntityId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('demo-admin-'));
}

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function dayKey(n: number) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

const DEMO_USERS = [
  {
    id: 'demo-admin-user-maya',
    email: 'maya.chen@demo.coldcallreps.com',
    displayName: 'Maya Chen',
    platformRole: 'REP',
    opsRole: null as string | null,
    accountStatus: 'ACTIVE',
    statusReason: null as string | null,
    plan: 'PRO',
    minutesRemaining: 142,
    totalPoints: 1840,
    bountyCredits: 0,
    hiringBoardOptIn: true,
    stripeConnectAccountId: 'acct_demo_maya',
    stripeConnectPayoutsEnabled: true,
    createdAt: daysAgoIso(40),
    repProfile: { slug: 'maya-chen', verified: true },
  },
  {
    id: 'demo-admin-user-dev',
    email: 'dev.patel@demo.coldcallreps.com',
    displayName: 'Dev Patel',
    platformRole: 'REP',
    opsRole: null as string | null,
    accountStatus: 'ACTIVE',
    statusReason: null as string | null,
    plan: 'STARTER',
    minutesRemaining: 38,
    totalPoints: 920,
    bountyCredits: 0,
    hiringBoardOptIn: true,
    stripeConnectAccountId: null as string | null,
    stripeConnectPayoutsEnabled: false,
    createdAt: daysAgoIso(22),
    repProfile: { slug: 'dev-patel', verified: false },
  },
  {
    id: 'demo-admin-user-jordan',
    email: 'jordan.lee@demo.coldcallreps.com',
    displayName: 'Jordan Lee',
    platformRole: 'REP',
    opsRole: null as string | null,
    accountStatus: 'SUSPENDED',
    statusReason: 'Integrity spike on payout claims',
    plan: 'FREE',
    minutesRemaining: 0,
    totalPoints: 410,
    bountyCredits: 0,
    hiringBoardOptIn: false,
    stripeConnectAccountId: 'acct_demo_jordan',
    stripeConnectPayoutsEnabled: true,
    createdAt: daysAgoIso(55),
    repProfile: { slug: 'jordan-lee', verified: false },
  },
  {
    id: 'demo-admin-user-avery',
    email: 'avery@meridianops.demo',
    displayName: 'Avery Kim',
    platformRole: 'BRAND',
    opsRole: null as string | null,
    accountStatus: 'ACTIVE',
    statusReason: null as string | null,
    plan: 'FREE',
    minutesRemaining: 0,
    totalPoints: 0,
    bountyCredits: 0,
    hiringBoardOptIn: false,
    stripeConnectAccountId: null as string | null,
    stripeConnectPayoutsEnabled: false,
    createdAt: daysAgoIso(60),
    repProfile: null as { slug: string; verified: boolean } | null,
  },
  {
    id: 'demo-admin-user-sam',
    email: 'sam@harborline.demo',
    displayName: 'Sam Rivera',
    platformRole: 'BRAND',
    opsRole: null as string | null,
    accountStatus: 'ACTIVE',
    statusReason: null as string | null,
    plan: 'FREE',
    minutesRemaining: 12,
    totalPoints: 0,
    bountyCredits: 0,
    hiringBoardOptIn: false,
    stripeConnectAccountId: null as string | null,
    stripeConnectPayoutsEnabled: false,
    createdAt: daysAgoIso(33),
    repProfile: null,
  },
];

export function getDemoAdminOverview(): AdminPlatformOverview {
  const liquiditySeries = Array.from({ length: 30 }, (_, i) => {
    const n = 29 - i;
    return {
      key: dayKey(n),
      label: dayKey(n).slice(5),
      leads: 18 + ((i * 7) % 40),
      dials: 40 + ((i * 11) % 90),
      goals: 2 + ((i * 3) % 8),
      spendCents: (3 + (i % 6)) * 2500,
    };
  });

  return {
    kpis: {
      brandCount: 24,
      userCount: 186,
      openCampaigns: 11,
      activeSdrs: 47,
      outreachReady: 1284,
      dialers24h: 19,
      leadToRepRatio: 12.4,
      callsToday: 312,
      connectRatePct: 18.6,
      auditFailRatePct: 9.2,
      claims30d: 148,
      claimsFailed30d: 14,
      tvlCents: 428_500_00,
      tvlLabel: '$428,500.00',
      walletCents: 312_000_00,
      escrowLockedCents: 116_500_00,
      gmvMtdCents: 84_200_00,
      gmvMtdLabel: '$84,200.00',
      gmv30dCents: 126_400_00,
      gmv30dLabel: '$126,400.00',
      takeRateMtdCents: 16_840_00,
      takeRateMtdLabel: '$16,840.00',
      takeRate30dCents: 25_280_00,
      takeRate30dLabel: '$25,280.00',
      netRevenueMtdCents: 22_100_00,
      netRevenueMtdLabel: '$22,100.00',
      leadPlanMrrCents: 8_400_00,
      leadPlanMrrLabel: '$8,400.00',
      sdrSubMrrCents: 6_200_00,
      sdrSubMrrLabel: '$6,200.00',
      estimatedMrrCents: 14_600_00,
      estimatedMrrLabel: '$14,600.00',
      pendingPayoutCount: 7,
      pendingPayoutGrossCents: 18_750_00,
      pendingPayoutLabel: '$18,750.00',
      reviewQueue: 4,
      brandsAtRisk: 2,
      failedJobs: 3,
    },
    liquiditySeries,
    fraudScatter: [
      { repUserId: 'demo-admin-user-maya', name: 'Maya Chen', bookings: 22, failRatePct: 4.5, failed: 1 },
      { repUserId: 'demo-admin-user-dev', name: 'Dev Patel', bookings: 14, failRatePct: 14.3, failed: 2 },
      { repUserId: 'demo-admin-user-jordan', name: 'Jordan Lee', bookings: 9, failRatePct: 44.4, failed: 4 },
      { repUserId: 'demo-admin-user-riley', name: 'Riley Quinn', bookings: 17, failRatePct: 5.9, failed: 1 },
    ],
    alerts: [
      {
        id: 'demo-alert-review',
        severity: 'warn',
        title: '4 calls need manual review',
        detail: 'AI audit failures waiting on trust ops.',
        href: '/admin/review',
      },
      {
        id: 'demo-alert-payouts',
        severity: 'info',
        title: '7 pending payouts · $18,750',
        detail: 'Connect / escrow queue — finance can hold or release.',
        href: '/admin/finance',
      },
      {
        id: 'demo-alert-risk',
        severity: 'bad',
        title: '2 brands at risk',
        detail: 'Low runway or stalled goals on MeridianOps & Harborline.',
        href: '/admin/brands',
      },
    ],
    exceptions: [
      {
        brandId: 'demo-admin-brand-meridian',
        brandKey: 'demo-meridianops',
        brandName: 'MeridianOps',
        label: 'Low runway',
        detail: '≈6 days of escrow at current spend',
        tone: 'warn',
      },
      {
        brandId: 'demo-admin-brand-harbor',
        brandKey: 'demo-harborline',
        brandName: 'Harborline Benefits',
        label: 'Stalled goals',
        detail: '0 verified goals in 7d with active SDRs',
        tone: 'bad',
      },
    ],
    pipelineFailed: [
      {
        id: 'demo-admin-job-1',
        query: 'final expense agencies',
        location: 'Texas',
        error: 'Maps API rate limited — retry later',
        brandName: 'Harborline Benefits',
        brandKey: 'demo-harborline',
        createdAt: daysAgoIso(0),
      },
    ],
    audits: [
      {
        id: 'demo-admin-audit-1',
        action: 'USER_SUSPEND',
        targetId: 'demo-admin-user-jordan',
        createdAt: daysAgoIso(1),
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
      {
        id: 'demo-admin-audit-2',
        action: 'PAYOUT_HOLD',
        targetId: 'demo-admin-payout-2',
        createdAt: daysAgoIso(2),
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
    ],
    period: { from: dayKey(29), to: dayKey(0) },
  };
}

export function getDemoAdminUsers(q = '', status = 'ALL', role = 'ALL') {
  let users = [...DEMO_USERS];
  if (status !== 'ALL') users = users.filter((u) => u.accountStatus === status);
  if (role !== 'ALL') users = users.filter((u) => u.platformRole === role);
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    users = users.filter(
      (u) =>
        u.email?.toLowerCase().includes(needle) ||
        u.displayName?.toLowerCase().includes(needle) ||
        u.repProfile?.slug?.includes(needle) ||
        u.id.includes(needle)
    );
  }
  return { users };
}

export function getDemoAdminUserDossier(userId: string) {
  const base =
    DEMO_USERS.find((u) => u.id === userId) || DEMO_USERS[0];
  return {
    user: {
      ...base,
      minutesUsed: 60,
      stripeCustomerId: 'cus_demo',
      stripeConnectDetailsSubmitted: Boolean(base.stripeConnectAccountId),
      orgId: null,
      referralCode: 'DEMOREF1',
      referredByCode: null,
      brandsOwned:
        base.platformRole === 'BRAND'
          ? [
              {
                id: 'demo-admin-brand-meridian',
                slug: 'demo-meridianops',
                name: 'MeridianOps',
                logoUrl: null,
                creditsRemaining: 420,
                walletCents: 1250000,
                createdAt: daysAgoIso(60),
              },
            ]
          : [],
      banAppeals:
        base.accountStatus === 'SUSPENDED'
          ? [
              {
                id: 'demo-admin-appeal-1',
                status: 'PENDING',
                reason: 'False positive on claim audit — requesting review.',
                response: null,
                createdAt: daysAgoIso(0),
                reviewedAt: null,
              },
            ]
          : [],
    },
    sessions: [
      {
        id: 'demo-admin-session-1',
        overallScore: 88,
        focusArea: 'gatekeeper',
        duration: 186,
        integrityFlags: null,
        createdAt: daysAgoIso(3),
        flagged: false,
      },
      {
        id: 'demo-admin-session-2',
        overallScore: 41,
        focusArea: 'budget_500',
        duration: 18,
        integrityFlags: JSON.stringify([{ code: 'short_duration', detail: 'Call under 20 seconds' }]),
        createdAt: daysAgoIso(5),
        flagged: true,
      },
    ],
    payoutsEarned: [
      {
        id: 'demo-admin-payout-1',
        status: 'PAID',
        grossCents: 30000,
        netCents: 24000,
        platformFeeCents: 6000,
        holdReason: null,
        campaignTitle: 'RevOps qualified lead wave',
        campaignId: 'demo-admin-camp-1',
        createdAt: daysAgoIso(10),
        paidAt: daysAgoIso(8),
      },
    ],
    earnings: { paidCount: 1, paidNetLabel: '$240.00' },
    calls: [],
    audits: [
      {
        id: 'demo-admin-audit-u1',
        action: 'USER_VIEW',
        actorEmail: 'ops@coldcallreps.com',
        createdAt: daysAgoIso(0),
        targetId: base.id,
      },
    ],
  };
}

export function getDemoAdminFinance(): {
  summary: Record<string, string | number>;
  payouts: Array<Record<string, unknown>>;
} {
  return {
    summary: {
      pendingCount: 3,
      pendingGrossLabel: '$1,050.00',
      heldCount: 1,
      heldGrossLabel: '$250.00',
      disputedCount: 1,
      disputedGrossLabel: '$175.00',
      paid30Count: 28,
      paid30GrossLabel: '$12,640.00',
      paid30FeeLabel: '$2,528.00',
    },
    payouts: [
      {
        id: 'demo-admin-payout-pending-1',
        status: 'PENDING',
        grossLabel: '$300.00',
        feeLabel: '$60.00',
        netLabel: '$240.00',
        holdReason: null,
        disputeReason: null,
        campaignTitle: 'RevOps qualified lead wave',
        brandId: 'demo-admin-brand-meridian',
        rep: { id: 'demo-admin-user-maya', email: 'maya.chen@demo.coldcallreps.com', name: 'Maya Chen' },
        brand: { id: 'demo-admin-brand-meridian', email: 'avery@meridianops.demo', name: 'MeridianOps' },
        createdAt: daysAgoIso(1),
      },
      {
        id: 'demo-admin-payout-held-1',
        status: 'HELD',
        grossLabel: '$250.00',
        feeLabel: '$50.00',
        netLabel: '$200.00',
        holdReason: 'Audit fail rate spike',
        disputeReason: null,
        campaignTitle: 'Term / life agency wave',
        brandId: 'demo-admin-brand-harbor',
        rep: { id: 'demo-admin-user-jordan', email: 'jordan.lee@demo.coldcallreps.com', name: 'Jordan Lee' },
        brand: { id: 'demo-admin-brand-harbor', email: 'sam@harborline.demo', name: 'Harborline Benefits' },
        createdAt: daysAgoIso(3),
      },
      {
        id: 'demo-admin-payout-disputed-1',
        status: 'DISPUTED',
        grossLabel: '$175.00',
        feeLabel: '$35.00',
        netLabel: '$140.00',
        holdReason: null,
        disputeReason: 'Brand disputed meeting quality',
        campaignTitle: 'Roof inspection set',
        brandId: 'demo-admin-brand-summit',
        rep: { id: 'demo-admin-user-dev', email: 'dev.patel@demo.coldcallreps.com', name: 'Dev Patel' },
        brand: { id: 'demo-admin-brand-summit', email: 'elena@summit.demo', name: 'SummitShield Home' },
        createdAt: daysAgoIso(5),
      },
    ],
  };
}

export function getDemoAdminBrands(): AdminBrandsMatrix {
  return {
    generatedAt: new Date().toISOString(),
    brands: [
      {
        id: 'demo-admin-brand-meridian',
        slug: 'demo-meridianops',
        name: 'MeridianOps',
        logoUrl: null,
        ownerId: 'demo-admin-user-avery',
        ownerEmail: 'avery@meridianops.demo',
        ownerName: 'Avery Kim',
        leadPlan: 'GROWTH',
        creditsRemaining: 420,
        openCampaigns: 2,
        activeSdrs: 5,
        dialReady: 186,
        balanceCents: 1250000,
        walletLabel: '$12,500.00',
        goals7d: 8,
        costPerGoalLabel: '$312.50',
        runwayDays: 6,
        risk: 72,
        topSignal: { label: 'Low runway', detail: '≈6 days at current spend', tone: 'warn' },
        createdAt: daysAgoIso(60),
      },
      {
        id: 'demo-admin-brand-harbor',
        slug: 'demo-harborline',
        name: 'Harborline Benefits',
        logoUrl: null,
        ownerId: 'demo-admin-user-sam',
        ownerEmail: 'sam@harborline.demo',
        ownerName: 'Sam Rivera',
        leadPlan: 'STARTER',
        creditsRemaining: 48,
        openCampaigns: 1,
        activeSdrs: 3,
        dialReady: 62,
        balanceCents: 320000,
        walletLabel: '$3,200.00',
        goals7d: 0,
        costPerGoalLabel: '—',
        runwayDays: 14,
        risk: 81,
        topSignal: { label: 'Stalled goals', detail: '0 verified goals in 7d', tone: 'bad' },
        createdAt: daysAgoIso(33),
      },
      {
        id: 'demo-admin-brand-summit',
        slug: 'demo-summitshield',
        name: 'SummitShield Home',
        logoUrl: null,
        ownerId: null,
        ownerEmail: 'elena@summit.demo',
        ownerName: 'Elena Ruiz',
        leadPlan: 'FREE',
        creditsRemaining: 12,
        openCampaigns: 2,
        activeSdrs: 4,
        dialReady: 94,
        balanceCents: 890000,
        walletLabel: '$8,900.00',
        goals7d: 5,
        costPerGoalLabel: '$178.00',
        runwayDays: 28,
        risk: 22,
        topSignal: null,
        createdAt: daysAgoIso(45),
      },
    ],
  };
}

export function getDemoAdminReview(): AdminReviewQueue {
  return {
    calls: [
      {
        id: 'demo-admin-call-1',
        kind: 'call',
        status: 'completed',
        outcome: 'appointment_set',
        durationSec: 214,
        recordingUrl: null,
        transcript: 'USER: Hi, is this the owner?\nPROSPECT: Speaking.',
        aiAuditResult: JSON.stringify({ score: 42, reason: 'Weak discovery' }),
        createdAt: daysAgoIso(0),
        brandId: 'demo-admin-brand-meridian',
        brandKey: 'demo-meridianops',
        brandName: 'MeridianOps',
        campaignId: 'demo-admin-camp-1',
        prospectId: 'demo-admin-prospect-1',
        companyName: 'Northwind RevOps',
        repName: 'Dev Patel',
        repEmail: 'dev.patel@demo.coldcallreps.com',
        repUserId: 'demo-admin-user-dev',
      },
    ],
    claims: [
      {
        id: 'demo-admin-claim-1',
        kind: 'claim',
        status: 'FAILED',
        auditScore: 38,
        auditJSON: JSON.stringify({ fail: 'no_decision_maker' }),
        failureReason: 'No decision-maker confirmation',
        notes: null,
        transcriptSnippet: '…yeah just send an email…',
        prospectName: 'Keisha Brooks',
        meetingAt: daysAgoIso(-2),
        callLogId: 'demo-admin-call-2',
        createdAt: daysAgoIso(1),
        campaignId: 'demo-admin-camp-2',
        campaignTitle: 'Term / life agency wave',
        brandId: 'demo-admin-brand-harbor',
        brandKey: 'demo-harborline',
        brandName: 'Harborline Benefits',
        brandOwnerId: 'demo-admin-user-sam',
        repName: 'Jordan Lee',
        repEmail: 'jordan.lee@demo.coldcallreps.com',
        repUserId: 'demo-admin-user-jordan',
      },
    ],
  };
}

export function getDemoAdminAppeals() {
  return {
    appeals: [
      {
        id: 'demo-admin-appeal-1',
        status: 'PENDING',
        reason: 'False positive on claim audit — requesting review.',
        response: null,
        createdAt: daysAgoIso(0),
        reviewedAt: null,
        user: {
          id: 'demo-admin-user-jordan',
          email: 'jordan.lee@demo.coldcallreps.com',
          displayName: 'Jordan Lee',
          accountStatus: 'SUSPENDED',
          statusReason: 'Integrity spike on payout claims',
          platformRole: 'REP',
        },
      },
    ],
  };
}

export function getDemoAdminAudit() {
  return {
    audits: [
      {
        id: 'demo-admin-audit-1',
        action: 'USER_SUSPEND',
        targetType: 'UserProfile',
        targetId: 'demo-admin-user-jordan',
        metaJSON: '{"reason":"Integrity spike","days":7}',
        createdAt: daysAgoIso(1),
        actorId: 'demo-admin-ops',
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
      {
        id: 'demo-admin-audit-2',
        action: 'PAYOUT_HOLD',
        targetType: 'CampaignPayout',
        targetId: 'demo-admin-payout-held-1',
        metaJSON: '{"reason":"Audit fail rate spike"}',
        createdAt: daysAgoIso(2),
        actorId: 'demo-admin-ops',
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
      {
        id: 'demo-admin-audit-3',
        action: 'CAMPAIGN_PAUSE',
        targetType: 'Campaign',
        targetId: 'demo-admin-camp-2',
        metaJSON: '{"reason":"Brand request"}',
        createdAt: daysAgoIso(4),
        actorId: 'demo-admin-ops',
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
      {
        id: 'demo-admin-audit-4',
        action: 'admin.credits.adjust',
        targetType: 'UserProfile',
        targetId: 'demo-admin-user-maya',
        metaJSON: '{"note":"Goodwill credit","amount":100}',
        createdAt: daysAgoIso(5),
        actorId: 'demo-admin-ops',
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
      {
        id: 'demo-admin-audit-5',
        action: 'USER_VIEW',
        targetType: 'UserProfile',
        targetId: 'demo-admin-user-maya',
        metaJSON: '{}',
        createdAt: daysAgoIso(6),
        actorId: 'demo-admin-ops',
        actorEmail: 'ops@coldcallreps.com',
        actorName: 'Ops Demo',
      },
    ],
  };
}

export function getDemoAdminDialer() {
  return {
    kpis: {
      calls7d: 1842,
      completed7d: 1210,
      connectRatePct: 18.6,
      avgDurationSec: 94,
      activePhones: 3,
      dncEntries: 128,
    },
    phones: [
      {
        id: 'demo-admin-phone-1',
        e164: '+14155550101',
        isActive: true,
        brandId: 'demo-admin-brand-meridian',
        brandName: 'MeridianOps',
        label: 'West desk',
      },
      {
        id: 'demo-admin-phone-2',
        e164: '+15125550122',
        isActive: true,
        brandId: 'demo-admin-brand-harbor',
        brandName: 'Harborline Benefits',
        label: 'Austin pool',
      },
      {
        id: 'demo-admin-phone-3',
        e164: '+13035550188',
        isActive: true,
        brandId: 'demo-admin-brand-summit',
        brandName: 'SummitShield Home',
        label: 'Denver local',
      },
      {
        id: 'demo-admin-phone-4',
        e164: '+12125550109',
        isActive: false,
        brandId: 'demo-admin-brand-meridian',
        brandName: 'MeridianOps',
        label: 'Legacy NYC',
      },
    ],
    recentCalls: [
      {
        id: 'demo-admin-call-r1',
        status: 'completed',
        toNumber: '+1555010101',
        duration: 142,
        recordingConsent: true,
        repName: 'Maya Chen',
        brandName: 'MeridianOps',
        createdAt: daysAgoIso(0),
      },
      {
        id: 'demo-admin-call-r2',
        status: 'no-answer',
        toNumber: '+1555010102',
        duration: 12,
        recordingConsent: null,
        repName: 'Dev Patel',
        brandName: 'SummitShield Home',
        createdAt: daysAgoIso(0),
      },
      {
        id: 'demo-admin-call-r3',
        status: 'busy',
        toNumber: '+1555010103',
        duration: 4,
        recordingConsent: false,
        repName: 'Jordan Lee',
        brandName: 'Harborline Benefits',
        createdAt: daysAgoIso(1),
      },
    ],
    dncEntries: [
      {
        id: 'demo-admin-dnc-1',
        phoneE164: '+1555099999',
        scope: 'global',
        brandId: null,
        brandName: null,
        reason: 'Consumer request',
        createdAt: daysAgoIso(7),
      },
      {
        id: 'demo-admin-dnc-2',
        phoneE164: '+1555088888',
        scope: 'brand',
        brandId: 'demo-admin-brand-harbor',
        brandName: 'Harborline Benefits',
        reason: 'Brand-level stop — wrong vertical',
        createdAt: daysAgoIso(3),
      },
      {
        id: 'demo-admin-dnc-3',
        phoneE164: '+1555077777',
        scope: 'global',
        brandId: null,
        brandName: null,
        reason: null,
        createdAt: daysAgoIso(1),
      },
    ],
    brandVolume: [
      { brandName: 'MeridianOps', calls: 640, avgDurationSec: 98 },
      { brandName: 'Harborline Benefits', calls: 410, avgDurationSec: 88 },
      { brandName: 'SummitShield Home', calls: 320, avgDurationSec: 102 },
    ],
  };
}

export function getDemoAdminPipeline() {
  return {
    kpis: {
      failedJobs: 3,
      runningJobs: 1,
      queuedJobs: 2,
      scrapeFailed: 5,
      webScanFailed: 2,
      outreachReady: 1284,
    },
    jobs: [
      {
        id: 'demo-admin-job-1',
        status: 'failed',
        query: 'final expense agencies',
        location: 'Texas',
        errorMessage: 'Maps API rate limited — retry later',
        brandName: 'Harborline Benefits',
        brandId: 'demo-admin-brand-harbor',
        brandSlug: 'demo-harborline',
        savedCount: 0,
        readyCount: 0,
        createdAt: daysAgoIso(0),
      },
      {
        id: 'demo-admin-job-2',
        status: 'running',
        query: 'enterprise CRO / VP Sales',
        location: 'San Francisco Bay Area',
        errorMessage: null,
        brandName: 'MeridianOps',
        brandId: 'demo-admin-brand-meridian',
        brandSlug: 'demo-meridianops',
        savedCount: 9,
        readyCount: 3,
        createdAt: daysAgoIso(0),
      },
      {
        id: 'demo-admin-job-3',
        status: 'failed',
        query: 'dental office managers',
        location: 'Phoenix, AZ',
        errorMessage: 'Enrichment timeout after 0 saved leads',
        brandName: 'MeridianOps',
        brandId: 'demo-admin-brand-meridian',
        brandSlug: 'demo-meridianops',
        savedCount: 0,
        readyCount: 0,
        createdAt: daysAgoIso(1),
      },
      {
        id: 'demo-admin-job-4',
        status: 'queued',
        query: 'home services GMs',
        location: 'Denver metro',
        errorMessage: null,
        brandName: 'Harborline Benefits',
        brandId: 'demo-admin-brand-harbor',
        brandSlug: 'demo-harborline',
        savedCount: 0,
        readyCount: 0,
        createdAt: daysAgoIso(0),
      },
    ],
    creditMoves: [
      {
        id: 'demo-admin-credit-1',
        type: 'GRANT',
        amount: 100,
        brandName: 'MeridianOps',
        brandId: 'demo-admin-brand-meridian',
        note: 'Growth plan allotment',
        createdAt: daysAgoIso(2),
      },
      {
        id: 'demo-admin-credit-2',
        type: 'ADJUST',
        amount: 25,
        brandName: 'Harborline Benefits',
        brandId: 'demo-admin-brand-harbor',
        note: 'admin_refund:Maps API rate limited',
        createdAt: daysAgoIso(1),
      },
    ],
    brandsHot: [
      {
        id: 'demo-admin-brand-meridian',
        name: 'MeridianOps',
        slug: 'demo-meridianops',
        leadPlan: 'GROWTH',
        remaining: 420,
        leadCreditsUsedPeriod: 180,
      },
      {
        id: 'demo-admin-brand-harbor',
        name: 'Harborline Benefits',
        slug: 'demo-harborline',
        leadPlan: 'STARTER',
        remaining: 45,
        leadCreditsUsedPeriod: 95,
      },
    ],
  };
}

export function getDemoAdminVoice() {
  return {
    kpis: {
      sessions30: 842,
      flagged30: 36,
      avgScore: 71.4,
      practiceMinutes30: 2140,
      estXaiCostLabel: '$642.00',
      minutesRemainingPool: 4820,
      minutesUsedPool: 12640,
      openHolds: 2,
      assumedCostPerMinCents: 30,
    },
    series: Array.from({ length: 14 }, (_, i) => ({
      day: dayKey(13 - i),
      sessions: 40 + ((i * 9) % 55),
      minutes: 90 + ((i * 17) % 120),
    })),
    recentSessions: [
      {
        id: 'demo-admin-session-1',
        overallScore: 88,
        duration: 186,
        focusArea: 'gatekeeper',
        flagged: false,
        userName: 'Maya Chen',
        userId: 'demo-admin-user-maya',
        createdAt: daysAgoIso(0),
      },
      {
        id: 'demo-admin-session-2',
        overallScore: 41,
        duration: 18,
        focusArea: 'budget_500',
        flagged: true,
        userName: 'Jordan Lee',
        userId: 'demo-admin-user-jordan',
        createdAt: daysAgoIso(1),
      },
    ],
    clips: [
      {
        id: 'demo-admin-clip-1',
        title: 'Gatekeeper breakthrough',
        status: 'PUBLISHED',
        durationSec: 42,
        userName: 'Maya Chen',
        createdAt: daysAgoIso(4),
      },
    ],
  };
}

export function getDemoAdminCampaigns() {
  return {
    kpis: {
      total: 18,
      open: 11,
      paused: 3,
      escrowLockedLabel: '$116,500.00',
    },
    campaigns: [
      {
        id: 'demo-admin-camp-1',
        title: 'RevOps qualified lead wave',
        status: 'OPEN',
        goalType: 'QUALIFIED_LEAD',
        payoutCents: 30000,
        platformFeeBps: 2000,
        escrowLockedCents: 4500000,
        applications: 12,
        accepted: 5,
        brandId: 'demo-admin-brand-meridian',
        brandName: 'MeridianOps',
        brandSlug: 'demo-meridianops',
        createdAt: daysAgoIso(20),
      },
      {
        id: 'demo-admin-camp-2',
        title: 'Term / life agency wave',
        status: 'PAUSED',
        goalType: 'APPOINTMENT',
        payoutCents: 17500,
        platformFeeBps: 2000,
        escrowLockedCents: 2100000,
        applications: 8,
        accepted: 3,
        brandId: 'demo-admin-brand-harbor',
        brandName: 'Harborline Benefits',
        brandSlug: 'demo-harborline',
        createdAt: daysAgoIso(14),
      },
    ],
  };
}

export function getDemoAdminContent() {
  return {
    packs: [
      { id: 'demo-admin-pack-1', name: 'Meridian opener pack', active: true, brandName: 'MeridianOps' },
      {
        id: 'demo-admin-pack-2',
        name: 'Harborline benefits pack',
        active: false,
        brandName: 'Harborline Benefits',
      },
    ],
    playbooks: [
      {
        id: 'demo-admin-pb-1',
        title: 'RevOps discovery',
        brandId: 'demo-admin-brand-meridian',
        brandSlug: 'demo-meridianops',
        brandName: 'MeridianOps',
      },
      {
        id: 'demo-admin-pb-2',
        title: 'Agency intro',
        brandId: 'demo-admin-brand-harbor',
        brandSlug: 'demo-harborline',
        brandName: 'Harborline Benefits',
      },
    ],
    bounties: [
      {
        id: 'demo-admin-bounty-1',
        title: 'First booking bonus',
        active: true,
        rewardCents: 5000,
        brandName: 'MeridianOps',
      },
      {
        id: 'demo-admin-bounty-2',
        title: 'Seasonal closer bonus',
        active: false,
        rewardCents: 2500,
        brandName: 'Harborline Benefits',
      },
    ],
    boards: [
      { id: 'demo-admin-board-1', title: 'Hiring board · West', active: true, brandName: 'MeridianOps' },
    ],
    scenarios: [
      {
        id: 'demo-admin-scenario-1',
        slug: 'gatekeeper-hard',
        title: 'Tough gatekeeper',
        focusArea: 'gatekeeper',
        active: true,
        difficulty: 'hard',
      },
      {
        id: 'demo-admin-scenario-2',
        slug: 'budget-pushback',
        title: 'Budget pushback',
        focusArea: 'budget_500',
        active: true,
        difficulty: 'medium',
      },
      {
        id: 'demo-admin-scenario-3',
        slug: 'voicemail-drop',
        title: 'Voicemail drop (draft)',
        focusArea: 'voicemail',
        active: false,
        difficulty: 'easy',
      },
    ],
    academies: [
      {
        id: 'demo-admin-academy-1',
        name: 'Acme SDR Academy',
        members: 24,
        curricula: 3,
        orgId: 'org_demo_acme',
      },
    ],
  };
}

export function getDemoAdminAnalytics() {
  return {
    sdrFunnel: [
      { step: 'Signed up', count: 420 },
      { step: 'Practiced', count: 310 },
      { step: 'Applied', count: 148 },
      { step: 'Accepted', count: 72 },
      { step: 'Booked goal', count: 41 },
    ],
    brandFunnel: [
      { step: 'Created brand', count: 86 },
      { step: 'Funded wallet', count: 54 },
      { step: 'Opened campaign', count: 38 },
      { step: 'Hired SDR', count: 29 },
      { step: 'Paid goal', count: 22 },
    ],
    topReps: DEMO_USERS.filter((u) => u.platformRole === 'REP').map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      totalPoints: u.totalPoints,
    })),
    topBrands: [
      {
        id: 'demo-admin-brand-meridian',
        name: 'MeridianOps',
        campaigns: 2,
        leads: 420,
        creditsUsed: 180,
        walletLabel: '$12,500.00',
      },
      {
        id: 'demo-admin-brand-summit',
        name: 'SummitShield Home',
        campaigns: 2,
        leads: 210,
        creditsUsed: 88,
        walletLabel: '$8,900.00',
      },
    ],
  };
}

export function getDemoAdminHealth() {
  return {
    kpis: {
      webhooks: 4,
      webhookErrors: 1,
      apiKeys: 9,
      revokedKeys: 2,
      disputesOpen: 1,
      notifFails24h: 3,
    },
    webhooks: [
      {
        id: 'demo-admin-wh-1',
        url: 'https://hooks.example.com/ccr',
        active: true,
        lastError: null,
        userEmail: 'avery@meridianops.demo',
      },
      {
        id: 'demo-admin-wh-2',
        url: 'https://hooks.example.com/fail',
        active: true,
        lastError: 'timeout',
        userEmail: 'sam@harborline.demo',
      },
      {
        id: 'demo-admin-wh-3',
        url: 'https://hooks.example.com/paused',
        active: false,
        lastError: null,
        userEmail: 'lee@summit.demo',
      },
    ],
    apiKeys: [
      {
        id: 'demo-admin-key-1',
        name: 'Meridian prod',
        keyPrefix: 'ccr_live_ab',
        revokedAt: null,
        userEmail: 'avery@meridianops.demo',
      },
      {
        id: 'demo-admin-key-2',
        name: 'Harbor staging',
        keyPrefix: 'ccr_test_9f',
        revokedAt: null,
        userEmail: 'sam@harborline.demo',
      },
      {
        id: 'demo-admin-key-3',
        name: 'Old integration',
        keyPrefix: 'ccr_live_xx',
        revokedAt: daysAgoIso(14),
        userEmail: 'lee@summit.demo',
      },
    ],
    disputes: [
      {
        id: 'demo-admin-dispute-1',
        stripeDisputeId: 'dp_demo_1',
        status: 'needs_response',
        reason: 'product_not_received',
        amountLabel: '$175.00',
        evidenceDueBy: daysAgoIso(-5),
      },
      {
        id: 'demo-admin-dispute-2',
        stripeDisputeId: 'dp_demo_2',
        status: 'warning_needs_response',
        reason: 'fraudulent',
        amountLabel: '$890.00',
        evidenceDueBy: daysAgoIso(1),
      },
    ],
    configs: [
      { key: 'feature.demoDesk', valueJSON: '{"enabled":true}' },
      { key: 'voice.costPerMinCents', valueJSON: '30' },
      { key: 'ops.maintenanceBanner', valueJSON: '{"enabled":false,"message":""}' },
    ],
    stripeEvents: [
      {
        id: 'evt_demo_1',
        type: 'charge.dispute.created',
        processedAt: daysAgoIso(1),
      },
      {
        id: 'evt_demo_2',
        type: 'invoice.paid',
        processedAt: daysAgoIso(2),
      },
      {
        id: 'evt_demo_3',
        type: 'customer.subscription.updated',
        processedAt: daysAgoIso(3),
      },
    ],
  };
}

export function getDemoAdminRefunds(filter = 'open') {
  const dueSoon = new Date(Date.now() + 2 * 86400000).toISOString();
  const overdue = new Date(Date.now() - 1 * 86400000).toISOString();
  const disputes = [
    {
      id: 'demo-admin-dispute-1',
      stripeDisputeId: 'dp_demo_1',
      chargeId: 'ch_demo_1',
      paymentIntentId: 'pi_demo_meridian_1',
      amountCents: 17500,
      currency: 'usd',
      amountLabel: '$175.00',
      reason: 'product_not_received',
      status: 'needs_response',
      isOpen: true,
      evidenceDueBy: dueSoon,
      evidenceDueLabel: new Date(dueSoon).toLocaleDateString(),
      evidenceOverdue: false,
      evidenceDueSoon: true,
      createdAt: daysAgoIso(2),
      updatedAt: daysAgoIso(0),
      stripeUrl: 'https://dashboard.stripe.com/disputes/dp_demo_1',
    },
    {
      id: 'demo-admin-dispute-2',
      stripeDisputeId: 'dp_demo_2',
      chargeId: 'ch_demo_2',
      paymentIntentId: 'pi_demo_harbor_2',
      amountCents: 89000,
      currency: 'usd',
      amountLabel: '$890.00',
      reason: 'fraudulent',
      status: 'warning_needs_response',
      isOpen: true,
      evidenceDueBy: overdue,
      evidenceDueLabel: new Date(overdue).toLocaleDateString(),
      evidenceOverdue: true,
      evidenceDueSoon: false,
      createdAt: daysAgoIso(5),
      updatedAt: daysAgoIso(1),
      stripeUrl: 'https://dashboard.stripe.com/disputes/dp_demo_2',
    },
    {
      id: 'demo-admin-dispute-3',
      stripeDisputeId: 'dp_demo_3',
      chargeId: 'ch_demo_3',
      paymentIntentId: 'pi_demo_summit_3',
      amountCents: 25000,
      currency: 'usd',
      amountLabel: '$250.00',
      reason: 'subscription_canceled',
      status: 'won',
      isOpen: false,
      evidenceDueBy: null as string | null,
      evidenceDueLabel: null as string | null,
      evidenceOverdue: false,
      evidenceDueSoon: false,
      createdAt: daysAgoIso(20),
      updatedAt: daysAgoIso(12),
      stripeUrl: 'https://dashboard.stripe.com/disputes/dp_demo_3',
    },
  ];
  const f = filter.toLowerCase();
  const filtered =
    f === 'all'
      ? disputes
      : f === 'closed'
        ? disputes.filter((d) => !d.isOpen)
        : disputes.filter((d) => d.isOpen);
  return {
    kpis: {
      openCount: 2,
      openLabel: '$1,065.00',
      totalSynced: 3,
      needsResponse: 2,
    },
    filter: f,
    disputes: filtered,
  };
}

/** Resolve fixture payload for an admin API path (querystring ignored). */
export function resolveAdminDemoPayload(url: string): unknown | null {
  try {
    const u = new URL(url, 'http://local');
    const path = u.pathname.replace(/\/$/, '') || u.pathname;
    const q = u.searchParams.get('q') || '';
    const status = (u.searchParams.get('status') || 'ALL').toUpperCase();
    const role = (u.searchParams.get('role') || 'ALL').toUpperCase();

    if (path === '/api/admin/overview') return getDemoAdminOverview();
    if (path === '/api/admin/users') return getDemoAdminUsers(q, status, role);
    if (path.startsWith('/api/admin/users/')) {
      const id = path.split('/').pop() || '';
      return getDemoAdminUserDossier(id);
    }
    if (path === '/api/admin/finance') return getDemoAdminFinance();
    if (path === '/api/admin/brands') return getDemoAdminBrands();
    if (path === '/api/admin/review') return getDemoAdminReview();
    if (path === '/api/admin/appeals') return getDemoAdminAppeals();
    if (path === '/api/admin/audit') return getDemoAdminAudit();
    if (path === '/api/admin/dialer') return getDemoAdminDialer();
    if (path === '/api/admin/pipeline') return getDemoAdminPipeline();
    if (path === '/api/admin/voice') return getDemoAdminVoice();
    if (path === '/api/admin/campaigns') return getDemoAdminCampaigns();
    if (path === '/api/admin/content') return getDemoAdminContent();
    if (path === '/api/admin/analytics') return getDemoAdminAnalytics();
    if (path === '/api/admin/health') return getDemoAdminHealth();
    if (path === '/api/admin/refunds') {
      return getDemoAdminRefunds(u.searchParams.get('filter') || 'open');
    }
    return null;
  } catch {
    return null;
  }
}
