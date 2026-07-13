import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import PracticeCallsList from '@/components/PracticeCallsList';

export default async function BrandPracticeCallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  const key = brandPathKey(brand);
  const detailQuery = `from=brand&brand=${encodeURIComponent(key)}`;

  return (
    <main className="app-page">
      <PageHeader
        title="Practice calls"
        description="Scored trainer sessions for this brand — filter by rep or scenario, then open any call for transcript and playback."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={brandHref(brand, 'calls')} className="btn-ghost">
              Calls
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
        emptyLabel="View calls →"
        title="Brand practice history"
        description="Filter by SDR or campaign/scenario. Click a row for the full detail view."
      />
    </main>
  );
}
