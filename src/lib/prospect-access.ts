import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrand, isSuperadmin } from '@/lib/roles';
import { TRAINING_SOURCE } from '@/lib/training-leads';

export type ProspectAccessVia = 'owner' | 'brand' | 'superadmin' | 'training' | 'sdr';

export type ProspectAccess = {
  prospect: NonNullable<Awaited<ReturnType<typeof loadProspectRow>>>;
  canEdit: boolean;
  via: ProspectAccessVia;
};

async function loadProspectRow(id: string) {
  return prisma.prospect.findFirst({
    where: { id },
    include: {
      brand: { select: { id: true, slug: true, name: true, ownerId: true } },
      campaign: { select: { id: true, title: true } },
    },
  });
}

/**
 * Resolve prospect access:
 * - owner / brand manager / superadmin → edit
 * - shared training leads → any signed-in user may view + edit (practice desk)
 * - accepted SDR on the brand/campaign → view (no full edit)
 */
export async function resolveProspectAccess(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  prospectId: string
): Promise<ProspectAccess | null> {
  const prospect = await loadProspectRow(prospectId);
  if (!prospect) return null;

  if (isSuperadmin(profile)) {
    return { prospect, canEdit: true, via: 'superadmin' };
  }

  if (prospect.userId === profile.id) {
    return { prospect, canEdit: true, via: 'owner' };
  }

  if (prospect.brandId && prospect.brand) {
    if (canManageBrand(profile, prospect.brand.ownerId)) {
      return { prospect, canEdit: true, via: 'brand' };
    }
  }

  // Platform / demo training leads are shared practice contacts.
  if (prospect.source === TRAINING_SOURCE) {
    return { prospect, canEdit: true, via: 'training' };
  }

  // Accepted SDRs can open brand campaign leads (view).
  if (prospect.brandId || prospect.campaignId) {
    const app = await prisma.campaignApplication.findFirst({
      where: {
        userId: profile.id,
        status: { in: ['ACCEPTED', 'ACTIVE'] },
        ...(prospect.campaignId
          ? { campaignId: prospect.campaignId }
          : { campaign: { brandId: prospect.brandId! } }),
      },
      select: { id: true },
    });
    if (app) {
      return { prospect, canEdit: false, via: 'sdr' };
    }
  }

  return null;
}
