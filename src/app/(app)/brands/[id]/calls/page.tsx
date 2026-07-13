import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandCallsBoard from '@/components/BrandCallsBoard';

export default async function BrandCallsPage({
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

  const key = brandPathKey(brand);

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="Live calls"
        description="Upcoming meetings, active dials, and recent outcomes — updates every few seconds."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={brandHref(brand, 'practice')} className="btn-ghost">
              Practice history →
            </Link>
            <Link href={brandHref(brand, 'leads')} className="btn-ghost">
              Leads →
            </Link>
            <Link href={brandHref(brand, 'campaigns')} className="btn-ghost">
              Campaigns →
            </Link>
          </div>
        }
      />
      <BrandCallsBoard brandKey={key} brandName={brand.name} />
    </main>
  );
}
