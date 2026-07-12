import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrand, isSuperadmin } from '@/lib/roles';
import { TRAINING_SOURCE } from '@/lib/training-leads';

/** Brand IDs the user owns (or all for superadmin). */
export async function ownedBrandIds(profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>) {
  const brands = await prisma.brand.findMany({
    where: isSuperadmin(profile) ? {} : { ownerId: profile.id },
    select: { id: true, ownerId: true, name: true, slug: true },
    take: 50,
  });
  return brands;
}

/** Exclude training / practice contacts from paid campaign dial lists. */
export function campaignLeadWhere(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    NOT: { source: TRAINING_SOURCE },
  };
}

/** True if profile can manage this brand's lead list. */
export async function canManageBrandLeads(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<boolean> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { ownerId: true },
  });
  if (!brand) return false;
  return canManageBrand(profile, brand.ownerId);
}

/**
 * Brand IDs an SDR may dial: campaigns where application is ACCEPTED or ACTIVE.
 */
export async function dialableBrandCampaigns(userId: string) {
  const apps = await prisma.campaignApplication.findMany({
    where: {
      userId,
      status: { in: ['ACCEPTED', 'ACTIVE'] },
    },
    select: {
      campaignId: true,
      campaign: {
        select: {
          id: true,
          brandId: true,
          title: true,
          packId: true,
          playbookId: true,
          brand: { select: { name: true } },
        },
      },
    },
  });
  return apps.map((a) => a.campaign);
}
