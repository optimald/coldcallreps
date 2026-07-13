import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canAccessBrandDesk } from '@/lib/roles';
import BrandVerifiedGoalsClient from '@/components/BrandVerifiedGoalsClient';

export default async function BrandVerifiedGoalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  return (
    <BrandVerifiedGoalsClient
      brand={{
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        logoUrl: brand.logoUrl,
      }}
    />
  );
}
