import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ownedBrandIds } from '@/lib/brand-leads';
import { requireDeskBrand } from '@/lib/desk-brand';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk, effectiveRole } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandPipelineClient from '@/components/BrandPipelineClient';

export default async function BrandPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  const { id } = await params;

  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode) && role !== 'SUPERADMIN') {
    redirect('/practice');
  }

  const owned = await ownedBrandIds(profile);
  const brands = owned.filter((b) => b.id === brand.id);
  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brand.id },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: { id: true, title: true, brandId: true },
  });

  return (
    <main className="app-page brand-pipeline-page">
      <PageHeader compact title="Pipeline" />
      <Suspense fallback={<p className="muted">Loading pipeline…</p>}>
        <BrandPipelineClient
          brands={brands.length ? brands : [{ id: brand.id, name: brand.name, slug: brand.slug }]}
          campaigns={campaigns}
        />
      </Suspense>
    </main>
  );
}
