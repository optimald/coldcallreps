import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';

/** Canonical campaign URLs live under /brands/{brand}/campaigns/{id}. */
export default async function CampaignDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, brand: { select: { id: true, slug: true } } },
  });
  if (!campaign) notFound();
  redirect(brandHref(campaign.brand, 'campaigns', campaign.id));
}
