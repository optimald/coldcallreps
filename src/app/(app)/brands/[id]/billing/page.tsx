import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canManageBrand } from '@/lib/roles';

/**
 * Brand-scoped billing entry — account billing is shared; deep-link with brand filter.
 */
export default async function BrandBillingRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const { brand, deskMode } = await requireDeskBrand(id);
  const isDemoBrand =
    deskMode === 'demo' &&
    Boolean(brand.slug?.startsWith('demo-')) &&
    ['BRAND', 'RECRUITER', 'SUPERADMIN'].includes(profile.platformRole);
  if (!canManageBrand(profile, brand.ownerId) && !isDemoBrand) {
    redirect('/billing');
  }

  const qs = new URLSearchParams();
  qs.set('brand', brand.slug || brand.id);
  const tab = typeof sp.tab === 'string' ? sp.tab : null;
  if (tab) qs.set('tab', tab);
  redirect(`/billing?${qs.toString()}`);
}
