import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandCallsBoard from '@/components/BrandCallsBoard';

export default async function BrandCallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  const key = brandPathKey(brand);

  return (
    <main className="app-page app-page--desk brand-calls-page">
      <PageHeader
        compact
        title="Calls"
        description="Upcoming meetings, active dials, and recent outcomes — updates every few seconds."
        actions={
          <Link href={brandHref(brand, 'leads')} className="btn-ghost">
            Leads →
          </Link>
        }
      />
      <Suspense fallback={<p className="muted">Loading calls…</p>}>
        <BrandCallsBoard brandKey={key} brandName={brand.name} />
      </Suspense>
    </main>
  );
}
