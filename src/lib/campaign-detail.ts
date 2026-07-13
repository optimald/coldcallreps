import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { serializeCampaign } from '@/lib/campaigns';
import { shouldAutoDeactivate } from '@/lib/campaign-schedule';
import { loadOneCampaignSpend } from '@/lib/campaign-spend';
import { matchProgressOf } from '@/lib/brand-lead-match';
import { GOOGLE_CALENDAR_PROVIDER } from '@/lib/google-calendar';

export type CampaignDetailProgress = {
  targeting: number;
  conditioning: number;
  dialingReady: number;
  dialingActive: number;
  booked: number;
  failed: number;
  total: number;
  dials: number;
};

export type CampaignDetailJob = {
  id: string;
  query: string;
  location: string;
  status: string;
  savedCount: number;
  readyCount: number;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  campaignId?: string | null;
};

export type CampaignDetailBundle = {
  campaign: ReturnType<typeof serializeCampaign> & Record<string, unknown>;
  canManage: boolean;
  applications: unknown[];
  progress: CampaignDetailProgress;
  campaignJobs: CampaignDetailJob[];
  calendarConnected: boolean;
  bookings: unknown[];
};

const emptyProgress = (): CampaignDetailProgress => ({
  targeting: 0,
  conditioning: 0,
  dialingReady: 0,
  dialingActive: 0,
  booked: 0,
  failed: 0,
  total: 0,
  dials: 0,
});

/**
 * Parallel load for brand campaign detail desk (SSR + API reuse).
 * Returns null when not found / not visible to the viewer.
 */
export async function loadCampaignDetailBundle(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  campaignId: string
): Promise<CampaignDetailBundle | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
      pack: { select: { id: true, name: true } },
      playbook: { select: { id: true, title: true } },
      _count: { select: { applications: true } },
      applications: {
        where: { userId: profile.id },
        take: 1,
        select: { id: true, status: true },
      },
    },
  });
  if (!campaign) return null;

  if (shouldAutoDeactivate(campaign.status, campaign)) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'PAUSED' },
    });
    campaign.status = 'PAUSED';
  }

  const manage = canManageBrand(profile, campaign.brand.ownerId);
  const hasApplication = campaign.applications.length > 0;
  if (
    campaign.status !== 'OPEN' &&
    !manage &&
    !hasApplication &&
    campaign.createdByUserId !== profile.id
  ) {
    return null;
  }

  const brandId = campaign.brandId;
  const [spend, applications, leads, jobs, ownerConn, bookings] = await Promise.all([
    loadOneCampaignSpend(campaign.id),
    manage
      ? prisma.campaignApplication.findMany({
          where: { campaignId },
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                totalPoints: true,
                currentStreak: true,
                badges: true,
                stripeConnectPayoutsEnabled: true,
                stripeConnectAccountId: true,
                repProfile: { select: { slug: true, verified: true } },
              },
            },
            payout: true,
          },
        })
      : Promise.resolve([]),
    prisma.prospect.findMany({
      where: { brandId, campaignId, NOT: { source: 'training' } },
      take: 200,
      select: {
        id: true,
        status: true,
        outreachReady: true,
        enrichmentStatus: true,
        scrapeStatus: true,
        webScanStatus: true,
        qualifyPhase1: true,
        qualifyPhase2: true,
        qualifyPhase3: true,
      },
    }),
    prisma.pipelineJob.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        query: true,
        location: true,
        status: true,
        savedCount: true,
        readyCount: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
        campaignId: true,
      },
    }),
    campaign.brand.ownerId
      ? prisma.crmConnection.findFirst({
          where: {
            userId: campaign.brand.ownerId,
            provider: GOOGLE_CALENDAR_PROVIDER,
            status: 'connected',
          },
          orderBy: { updatedAt: 'desc' },
          select: { accessTokenEnc: true },
        })
      : Promise.resolve(null),
    prisma.calendarBooking.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const { applications: myApps, brand, ...rest } = campaign;
  const serialized = serializeCampaign({
    ...rest,
    ...spend,
    brand: { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl },
    myApplication: myApps[0] || null,
  });

  const kpis = matchProgressOf(leads);
  const progress: CampaignDetailProgress = {
    targeting: kpis.targeting,
    conditioning: kpis.conditioning,
    dialingReady: kpis.dialingReady,
    dialingActive: kpis.dialingActive,
    booked: kpis.booked,
    failed: kpis.failed,
    total: kpis.total,
    dials: leads.filter((l) =>
      ['warming', 'dialing', 'done'].includes(l.status || '')
    ).length,
  };

  const campaignJobs: CampaignDetailJob[] = jobs
    .filter((j) => j.campaignId === campaignId)
    .map((j) => ({
      id: j.id,
      query: j.query,
      location: j.location,
      status: j.status,
      savedCount: j.savedCount,
      readyCount: j.readyCount,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      errorMessage: j.errorMessage,
      campaignId: j.campaignId,
    }));

  return {
    campaign: serialized as CampaignDetailBundle['campaign'],
    canManage: manage,
    applications: applications.map((a) => ({
      id: a.id,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      payout: a.payout
        ? {
            id: a.payout.id,
            status: a.payout.status,
            grossCents: a.payout.grossCents,
            netCents: a.payout.netCents,
            platformFeeCents: a.payout.platformFeeCents,
            paidAt: a.payout.paidAt,
          }
        : null,
      applicant: {
        id: a.user.id,
        displayName: a.user.displayName,
        totalPoints: a.user.totalPoints,
        streak: a.user.currentStreak,
        verified: a.user.repProfile?.verified || false,
        profileSlug: a.user.repProfile?.slug || null,
        connectReady: Boolean(
          a.user.stripeConnectAccountId && a.user.stripeConnectPayoutsEnabled
        ),
        repProfile: a.user.repProfile,
      },
    })),
    progress: leads.length ? progress : emptyProgress(),
    campaignJobs,
    calendarConnected: Boolean(ownerConn?.accessTokenEnc),
    bookings: bookings.map((b) => ({
      id: b.id,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      meetLink: b.meetLink,
      attendeeEmails: b.attendeeEmails,
      createdByUserId: b.createdByUserId,
    })),
  };
}
