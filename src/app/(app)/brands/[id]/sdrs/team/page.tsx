import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { brandPathKey } from '@/lib/brand-context';
import { loadBrandTeamRoster } from '@/lib/brand-team';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandSdrTeamClient from '@/components/BrandSdrTeamClient';
import { enrichDemoTeamMetrics } from '@/lib/demo/brand-demo-data';

export default async function BrandSdrTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  const key = brandPathKey(brand);
  const team =
    deskMode === 'demo'
      ? enrichDemoTeamMetrics(key, brand.name)
      : await loadBrandTeamRoster({
          id: brand.id,
          slug: brand.slug,
          name: brand.name,
        });

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="SDR team"
        description="Accepted and active SDRs across your campaigns, with dials and verified goals."
        actions={
          <Link href="/recruit" className="btn-ghost">
            Recruit →
          </Link>
        }
      />

      <BrandSdrTeamClient brandKey={key} initial={team} />
    </main>
  );
}
