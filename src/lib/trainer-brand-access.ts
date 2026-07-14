import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads } from '@/lib/brand-leads';
import { canManageBrand, isSuperadmin } from '@/lib/roles';

/**
 * Who may train against a brand pack (certs / bounties / ICP scripts).
 * Demo brands are open practice; otherwise owner/manager or accepted SDR.
 */
export async function assertTrainerBrandAccess(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  brandId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (isSuperadmin(profile)) return { ok: true };

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, slug: true, ownerId: true },
  });
  if (!brand) return { ok: false, status: 400, error: 'Invalid brand' };

  if (brand.slug?.startsWith('demo-')) return { ok: true };
  if (await canManageBrandLeads(profile, brandId)) return { ok: true };
  if (canManageBrand(profile, brand.ownerId)) return { ok: true };

  // Brand opted a playbook into the public Practice catalog.
  const openPractice = await prisma.playbook.findFirst({
    where: { brandId, practiceAllowed: true },
    select: { id: true },
  });
  if (openPractice) return { ok: true };

  const app = await prisma.campaignApplication.findFirst({
    where: {
      userId: profile.id,
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      campaign: { brandId },
    },
    select: { id: true },
  });
  if (app) return { ok: true };

  return { ok: false, status: 403, error: 'Forbidden' };
}
