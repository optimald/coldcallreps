import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandSdrTeamClient from '@/components/BrandSdrTeamClient';

export default async function BrandSdrTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

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
      campaigns: { id: string; title: string; status: string }[];
    }
  >();
  for (const a of active) {
    const uid = a.userId;
    const cur = byUser.get(uid) || {
      userId: uid,
      name: a.user?.displayName || 'Rep',
      slug: a.user?.repProfile?.slug || null,
      campaigns: [],
    };
    cur.campaigns.push({ id: a.campaign.id, title: a.campaign.title, status: a.status });
    byUser.set(uid, cur);
  }

  const userIds = [...byUser.keys()];
  const callCounts =
    userIds.length > 0
      ? await prisma.callLog.groupBy({
          by: ['userId'],
          where: { brandId: brand.id, userId: { in: userIds } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : [];
  const callByUser = Object.fromEntries(
    callCounts.map((c) => [
      c.userId,
      { count: c._count._all, lastAt: c._max.createdAt },
    ])
  );

  const team = [...byUser.values()].map((m) => ({
    ...m,
    dials: callByUser[m.userId]?.count || 0,
    lastCallAt: callByUser[m.userId]?.lastAt?.toISOString() || null,
  }));

  return (
    <main className="app-page">
      <PageHeader
        title="SDR team"
        description="Accepted and active SDRs across your campaigns, with dial activity."
        actions={
          <Link href={brandHref(brand, 'sdrs', 'applications')} className="btn-ghost">
            Applications →
          </Link>
        }
      />

      <BrandSdrTeamClient brandKey={brandPathKey(brand)} initial={team} />
    </main>
  );
}
