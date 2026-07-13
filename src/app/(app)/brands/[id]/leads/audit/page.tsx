import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, effectiveRole } from '@/lib/roles';
import { brandHref } from '@/lib/brand-context';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandLeadAuditClient from '@/components/BrandLeadAuditClient';

export default async function BrandLeadAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  const { id } = await params;

  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!brand) notFound();

  if (!canManageBrand(profile, brand.ownerId) && role !== 'SUPERADMIN') {
    redirect('/practice');
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="Lead audit log"
        description="Every edit to brand leads — who changed what and when."
        actions={
          <Link href={brandHref(brand, 'leads')} className="btn-ghost">
            ← Leads
          </Link>
        }
      />
      <BrandLeadAuditClient brandKey={brand.slug || brand.id} brandName={brand.name} />
    </main>
  );
}
