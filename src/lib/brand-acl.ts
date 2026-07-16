import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSuperadmin } from '@/lib/roles';

/** Owner or superadmin. BrandMember ACL lands with the members schema migration. */
export async function canManageBrandId(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<boolean> {
  if (isSuperadmin(profile)) return true;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { ownerId: true },
  });
  return Boolean(brand?.ownerId && brand.ownerId === profile.id);
}
