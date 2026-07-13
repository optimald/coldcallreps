import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import PracticeCallsList from '@/components/PracticeCallsList';

export default async function BrandPracticeCallsPage({
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
  const detailQuery = `from=brand&brand=${encodeURIComponent(key)}`;

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brand.name}
        title="Practice calls"
        description="Scored trainer sessions for this brand — filter by rep or scenario, then open any call for transcript and playback."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={brandHref(brand, 'calls')} className="btn-ghost">
              Live calls
            </Link>
            <Link href="/practice" className="btn-ghost">
              Open trainer
            </Link>
          </div>
        }
      />
      <PracticeCallsList
        brandId={brand.id}
        detailQuery={detailQuery}
        showRepFilter
        emptyHref={brandHref(brand, 'calls')}
        emptyLabel="View live calls →"
        title="Brand practice history"
        description="Filter by SDR or campaign/scenario. Click a row for the full detail view."
      />
    </main>
  );
}
