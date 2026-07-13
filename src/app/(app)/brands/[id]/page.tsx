import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { loadBrandOverview } from '@/lib/brand-overview';
import { requireDeskBrand } from '@/lib/desk-brand';
import BrandHomeClient from '@/components/BrandHomeClient';
import { BRAND_DESK_MODE_COOKIE, type BrandDeskMode } from '@/lib/brand-context';

export default async function BrandDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deskCookie = (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value;
  const initialDeskMode: BrandDeskMode = deskCookie === 'demo' ? 'demo' : 'live';
  const profile = await requireUser();
  const initialOverview =
    initialDeskMode === 'live' ? await loadBrandOverview(profile, id) : null;
  const { brand } = initialOverview?.brand
    ? { brand: initialOverview.brand }
    : await requireDeskBrand(id);

  return (
    <BrandHomeClient
      brandKey={brand.slug || brand.id}
      initialBrand={brand}
      initialDeskMode={initialDeskMode}
      initialOverview={initialOverview}
    />
  );
}
