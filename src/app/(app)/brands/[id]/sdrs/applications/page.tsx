import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { brandPathKey } from '@/lib/brand-context';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';
import BrandSdrApplicationsClient from '@/components/BrandSdrApplicationsClient';

export default async function BrandSdrApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  return (
    <main className="app-page">
      <PageHeader
        title="SDR applications"
        description="Review resumes and featured calls, then accept or reject with a message — SDRs are emailed automatically."
      />

      <Panel title="Applications" description="Click a rep to hear calls on their resume.">
        <BrandSdrApplicationsClient
          brandKey={brandPathKey(brand)}
          brandName={brand.name}
          initial={[]}
        />
      </Panel>
    </main>
  );
}
