import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk, effectiveRole } from '@/lib/roles';
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

  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode) && role !== 'SUPERADMIN') {
    redirect('/practice');
  }

  return (
    <main className="app-page">
      <PageHeader
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
