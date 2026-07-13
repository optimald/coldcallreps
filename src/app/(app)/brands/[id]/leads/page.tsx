import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedBrandIds } from '@/lib/brand-leads';
import { requireDeskBrand } from '@/lib/desk-brand';
import { listTrainingLeads } from '@/lib/training-leads';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk, effectiveRole } from '@/lib/roles';
import { brandHref } from '@/lib/brand-context';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandLeadsClient from '@/components/BrandLeadsClient';

export default async function BrandLeadsPage({
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

  const { prospects: trainingLeads } = await listTrainingLeads({
    take: 80,
    ownerUserId: profile.id,
  });

  const owned = await ownedBrandIds(profile);
  const brands = owned.filter((b) => b.id === brand.id);
  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brand.id },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: {
      id: true,
      title: true,
      brandId: true,
      status: true,
    },
  });

  return (
    <main className="app-page brand-leads-page">
      <PageHeader
        compact
        title="Leads"
        actions={
          <Link href={brandHref(brand, 'leads', 'audit')} className="btn-ghost">
            Lead audit log
          </Link>
        }
      />
      <BrandLeadsClient
        brands={brands.length ? brands : [{ id: brand.id, name: brand.name, slug: brand.slug }]}
        campaigns={campaigns}
        platformTrainingLeads={trainingLeads}
      />
    </main>
  );
}
