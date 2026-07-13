import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dialableBrandCampaigns } from '@/lib/brand-leads';
import { DIAL_QUEUE_SIZE, listQueueLeads } from '@/lib/lead-queue';
import { effectiveRole } from '@/lib/roles';
import { EmptyState, PageHeader } from '@/components/ui/PagePrimitives';
import OutboundDialer from '@/components/OutboundDialer';

/** Cold Call desk — hot-potato queue of 6 outreach-ready leads. */
export default async function OutboundPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);

  if (role !== 'REP' && role !== 'MANAGER' && role !== 'SUPERADMIN') {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Cold Call"
          title="Cold Call workspace"
          description="This workspace is for SDRs running campaign dials."
        />
        <EmptyState
          title="Wrong role"
          description="As a Brand, load leads under Leads and manage phone pools on the brand desk."
          action={
            <Link href="/leads" className="btn" style={{ marginTop: '1rem' }}>
              Brand leads
            </Link>
          }
        />
      </main>
    );
  }

  const campaigns = await dialableBrandCampaigns(profile.id);
  const campaignIds = campaigns.map((c) => c.id);

  const [apps, brandLeads] = await Promise.all([
    prisma.campaignApplication.findMany({
      where: {
        userId: profile.id,
        status: { in: ['ACCEPTED', 'ACTIVE', 'APPLIED'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: {
        campaign: {
          include: {
            brand: { select: { name: true, slug: true } },
            pack: { select: { id: true } },
            playbook: { select: { id: true } },
          },
        },
      },
    }),
    campaignIds.length
      ? listQueueLeads({
          campaignIds,
          userId: profile.id,
          take: DIAL_QUEUE_SIZE,
        })
      : Promise.resolve([]),
  ]);

  const active = apps.filter((a) => a.status === 'ACCEPTED' || a.status === 'ACTIVE');
  const applied = apps.filter((a) => a.status === 'APPLIED');
  const primary = active[0];
  const primaryCampaignId = primary?.campaignId ?? null;
  const hasAcceptedCampaign = active.length > 0;

  const campaignDialList = brandLeads.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    phone: l.phone,
    ownerName: l.ownerName,
    ownerTitle: l.ownerTitle,
    city: l.city,
    status: l.status,
    website: l.website,
    hooksJSON: l.hooksJSON,
    notes: l.notes,
    brandName: l.brand?.name ?? null,
    brandSlug: l.brand?.slug ?? null,
    attemptCount: l.attemptCount,
    nextCallAt: l.nextCallAt?.toISOString() ?? null,
    lastDisposition: l.lastDisposition,
  }));

  const activeGigs = active.map((a) => ({
    id: a.id,
    campaignId: a.campaignId,
    title: a.campaign.title,
    brandName: a.campaign.brand?.name || 'Brand',
    brandSlug: a.campaign.brand?.slug,
    status: a.status,
    packId: a.campaign.pack?.id ?? null,
    playbookId: a.campaign.playbook?.id ?? null,
    goalType: a.campaign.goalType,
    bookingLink: a.campaign.bookingLink ?? null,
    meetingDurationMinutes: a.campaign.meetingDurationMinutes ?? null,
    payoutCents: a.campaign.payoutCents,
    qualifiedPayoutCents: a.campaign.qualifiedPayoutCents ?? null,
  }));

  const pendingApps = applied.map((a) => ({
    id: a.id,
    campaignId: a.campaignId,
    title: a.campaign.title,
    brandName: a.campaign.brand?.name || 'Brand',
    status: a.status,
  }));

  return (
    <main className="app-page app-page--desk">
      <PageHeader
        compact
        eyebrow="Workspace"
        title="Cold Call"
        description={
          hasAcceptedCampaign
            ? 'Up to 6 outreach-ready leads. Select one to check it out for 10 minutes.'
            : 'Dials unlock after a brand accepts you. Warm up on Practice anytime.'
        }
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/practice" className="btn-ghost">
              Practice
            </Link>
            <Link href="/gigs" className="btn">
              Browse brand deals
            </Link>
          </div>
        }
      />

      <OutboundDialer
        campaignProspects={campaignDialList}
        campaignId={primaryCampaignId}
        activeGigs={activeGigs}
        pendingApps={pendingApps}
        hasAcceptedCampaign={hasAcceptedCampaign}
      />
    </main>
  );
}
