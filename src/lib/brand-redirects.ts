import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserProfile } from '@prisma/client';
import {
  brandHref,
  SELECTED_BRAND_COOKIE,
  SELECTED_BRAND_KEY,
  type BrandRef,
} from '@/lib/brand-context';
import { ownedBrandIds } from '@/lib/brand-leads';
import { effectiveRole } from '@/lib/roles';

export async function resolveOwnedBrandForRedirect(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>
): Promise<BrandRef | null> {
  const brands = await ownedBrandIds(profile);
  if (!brands.length) return null;

  const jar = await cookies();
  const preferred =
    jar.get(SELECTED_BRAND_COOKIE)?.value || jar.get(SELECTED_BRAND_KEY)?.value || null;
  if (preferred) {
    const hit = brands.find((b) => b.slug === preferred || b.id === preferred);
    if (hit) return hit;
  }
  return brands[0];
}

/** Redirect into brand-scoped IA (BRAND / RECRUITER / SUPERADMIN). */
export async function redirectBrandToScoped(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  ...segments: string[]
): Promise<never | void> {
  const role = effectiveRole(profile);
  if (role !== 'BRAND' && role !== 'RECRUITER' && role !== 'SUPERADMIN') return;

  const brand = await resolveOwnedBrandForRedirect(profile);
  if (!brand) redirect('/brands');
  redirect(brandHref(brand, ...segments));
}
