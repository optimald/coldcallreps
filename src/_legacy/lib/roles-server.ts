import 'server-only';

import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrand, effectiveRole, isSuperadmin } from '@/lib/roles';

/**
 * Async brand ACL — owner or BrandMember with role admin.
 * Prefer this for new routes; migrate call sites from canManageBrand(ownerId) over time.
 */
export async function canManageBrandId(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<boolean> {
  if (isSuperadmin(profile)) return true;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      ownerId: true,
      members: {
        where: { userId: profile.id, role: 'admin' },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!brand) return false;
  if (brand.ownerId === profile.id) return true;
  return brand.members.length > 0;
}

/** Owner, admin, or viewer BrandMember — for read-only brand desk surfaces. */
export async function canViewBrandId(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<boolean> {
  if (await canManageBrandId(profile, brandId)) return true;
  const member = await prisma.brandMember.findFirst({
    where: { brandId, userId: profile.id },
    select: { id: true },
  });
  return Boolean(member);
}

/**
 * Brand desk pages: owners/admins always; viewers via BrandMember;
 * platform demo-* brands when desk is in Demo mode.
 */
export async function canAccessBrandDeskAsync(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brand: { id: string; ownerId: string | null; slug?: string | null },
  deskMode?: 'live' | 'demo' | null
): Promise<boolean> {
  if (await canViewBrandId(profile, brand.id)) return true;
  if (deskMode !== 'demo') return false;
  const slug = brand.slug || '';
  if (!slug.startsWith('demo-')) return false;
  const role = effectiveRole(profile);
  return role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN';
}

// Re-export sync helpers so server call sites can import one module when needed.
export { canManageBrand, effectiveRole, isSuperadmin };
