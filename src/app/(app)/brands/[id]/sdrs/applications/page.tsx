import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';
import BrandSdrApplicationsClient from '@/components/BrandSdrApplicationsClient';

export default async function BrandSdrApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!brand) notFound();
  if (!canManageBrand(profile, brand.ownerId)) redirect('/dashboard');

  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brand.id },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
  const campaignIds = campaigns.map((c) => c.id);
  const applications = campaignIds.length
    ? await prisma.campaignApplication.findMany({
        where: { campaignId: { in: campaignIds } },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              repProfile: { select: { slug: true } },
            },
          },
          campaign: { select: { id: true, title: true, status: true } },
        },
      })
    : [];

  const rows = applications.map((a) => ({
    id: a.id,
    status: a.status,
    campaignId: a.campaign.id,
    campaignTitle: a.campaign.title,
    displayName: a.user?.displayName || 'Rep',
    profileSlug: a.user?.repProfile?.slug || null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="SDR applications"
        description="Accept or reject applicants across all campaigns for this brand."
        actions={
          <Link href={brandHref(brand, 'campaigns')} className="btn">
            Campaigns
          </Link>
        }
      />

      <Panel title="Applications" description={`${rows.length} recent`}>
        <BrandSdrApplicationsClient brandKey={brandPathKey(brand)} initial={rows} />
      </Panel>
    </main>
  );
}
