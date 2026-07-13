import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BRAND_DESK_MODE_COOKIE, type BrandDeskMode } from '@/lib/brand-context';
import { syntheticCanonicalBrand } from '@/lib/demo/canonical-brands';
import { prisma } from '@/lib/prisma';

export type DeskBrandRow = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  ownerId: string | null;
};

/** Resolve brand for desk pages; allows canonical demo-* when Demo mode and not seeded. */
export async function resolveDeskBrand(idOrSlug: string): Promise<{
  brand: DeskBrandRow;
  deskMode: BrandDeskMode;
} | null> {
  const deskMode: BrandDeskMode =
    (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value === 'demo' ? 'demo' : 'live';
  const row =
    (await prisma.brand.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, slug: true, name: true, logoUrl: true, ownerId: true },
    })) ||
    (deskMode === 'demo' ? syntheticCanonicalBrand(idOrSlug) : null);
  if (!row) return null;
  const brand: DeskBrandRow = {
    id: row.id,
    slug: row.slug || row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    ownerId: row.ownerId,
  };
  return { brand, deskMode };
}

export async function requireDeskBrand(idOrSlug: string): Promise<{
  brand: DeskBrandRow;
  deskMode: BrandDeskMode;
}> {
  const resolved = await resolveDeskBrand(idOrSlug);
  if (!resolved) notFound();
  return resolved;
}
