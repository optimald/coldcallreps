/**
 * Persist a validated SetupProposal as Brand (optional) + Pack + Playbook + DRAFT Campaign.
 * Never opens the campaign, locks escrow, or starts lead scouting.
 */

import { prisma } from '@/lib/prisma';
import {
  goalTypeForEarningsModel,
  clampPayoutCents,
} from '@/lib/campaigns';
import {
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
  resolvePayoutCents,
} from '@/lib/campaign-tiers';
import { PLATFORM_FEE_BPS } from '@/lib/platform-fees';
import {
  normalizeWebsiteUrl,
  resolveBrandLogoFromWebsite,
} from '@/lib/fetch-brand-logo';
import {
  buildRoleModeState,
  serializeUnlockedRoles,
} from '@/lib/role-mode';
import type { SetupProposal } from '@/lib/setup/proposal-schema';
import type { UserProfile } from '@prisma/client';

export type ApplySetupResult = {
  brand: { id: string; name: string; slug: string; logoUrl: string | null };
  packId: string;
  playbookId: string;
  campaignId: string;
  createdBrand: boolean;
  reused: boolean;
};

async function uniqueBrandSlug(baseName: string): Promise<string> {
  const baseSlug =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `brand-${Date.now().toString(36)}`;

  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function applySetupProposal(opts: {
  profile: UserProfile;
  proposal: SetupProposal;
  brandId?: string | null;
  /** Soft idempotency — reuse recent DRAFT with same title when key matches. */
  idempotencyKey?: string | null;
  /** When creating a first brand during onboarding. */
  unlockBrandRole?: boolean;
}): Promise<ApplySetupResult> {
  const { profile, proposal } = opts;
  const websiteUrl =
    normalizeWebsiteUrl(proposal.brand.websiteUrl) || proposal.brand.websiteUrl;

  let brandId = opts.brandId?.trim() || null;
  let createdBrand = false;
  let brandRow: { id: string; name: string; slug: string; logoUrl: string | null };

  if (brandId) {
    const existing = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
    });
    if (!existing) throw new Error('Brand not found');
    brandRow = {
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      logoUrl: existing.logoUrl,
    };
  } else {
    let logoUrl = proposal.brand.logoUrl?.trim() || null;
    if (!logoUrl) {
      logoUrl = await resolveBrandLogoFromWebsite(websiteUrl);
    }
    const slug = await uniqueBrandSlug(proposal.brand.name);
    const roleMode = buildRoleModeState(profile);
    const unlocked = new Set(roleMode.unlockedRoles.map(String));
    if (opts.unlockBrandRole) unlocked.add('BRAND');

    const created = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: {
          ownerId: profile.id,
          name: proposal.brand.name.slice(0, 120),
          slug,
          description: proposal.brand.description.slice(0, 1000),
          websiteUrl,
          logoUrl,
        },
      });
      await tx.brandWallet.create({
        data: { brandId: brand.id, balanceCents: 0 },
      });
      if (opts.unlockBrandRole) {
        await tx.userProfile.update({
          where: { id: profile.id },
          data: {
            platformRole: 'BRAND',
            unlockedRolesJSON: serializeUnlockedRoles(unlocked),
            brandOnboardedAt: profile.brandOnboardedAt || new Date(),
          },
        });
      }
      return brand;
    });

    brandId = created.id;
    createdBrand = true;
    brandRow = {
      id: created.id,
      name: created.name,
      slug: created.slug,
      logoUrl: created.logoUrl,
    };
  }

  // Soft idempotency: same user + brand + draft title in last 10 minutes.
  if (opts.idempotencyKey) {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await prisma.campaign.findFirst({
      where: {
        brandId,
        createdByUserId: profile.id,
        status: 'DRAFT',
        title: proposal.campaign.title.slice(0, 160),
        createdAt: { gte: since },
      },
      select: {
        id: true,
        packId: true,
        playbookId: true,
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent?.playbookId) {
      return {
        brand: recent.brand,
        packId: recent.packId || '',
        playbookId: recent.playbookId,
        campaignId: recent.id,
        createdBrand: false,
        reused: true,
      };
    }
  }

  const earningsModel = proposal.campaign.earningsModel;
  const goalType = goalTypeForEarningsModel(earningsModel);
  const payoutCents = clampPayoutCents(proposal.campaign.payoutCents);
  const { tierId } = resolvePayoutCents({ payoutCents });
  const maxAwards = proposal.campaign.maxAwards ?? 25;
  const budgetMode = proposal.campaign.budgetMode;
  const budgetCents =
    proposal.campaign.budgetCents ?? payoutCents * maxAwards;
  const dailyBudgetCents =
    budgetMode === 'DAILY'
      ? proposal.campaign.dailyBudgetCents && proposal.campaign.dailyBudgetCents > 0
        ? proposal.campaign.dailyBudgetCents
        : Math.max(payoutCents, Math.round(budgetCents / 10))
      : null;

  const wantsMeeting = goalType === 'BOOKED_MEETING' || goalType === 'BOTH';

  const result = await prisma.$transaction(async (tx) => {
    const pack = await tx.productPack.create({
      data: {
        brandId: brandId!,
        name: proposal.pack.name.slice(0, 160),
        icpJSON: JSON.stringify(proposal.pack.icp || {}),
        scriptsJSON: JSON.stringify(proposal.pack.scripts || []),
        objectionsJSON: JSON.stringify(proposal.pack.objections || []),
        active: true,
      },
    });

    const playbook = await tx.playbook.create({
      data: {
        brandId: brandId!,
        userId: profile.id,
        title: proposal.playbook.title.slice(0, 160),
        contentJSON: JSON.stringify({
          steps: proposal.playbook.steps,
          productUrl: proposal.playbook.productUrl || websiteUrl,
        }),
        practiceAllowed: false,
      },
    });

    const campaign = await tx.campaign.create({
      data: {
        brandId: brandId!,
        createdByUserId: profile.id,
        title: proposal.campaign.title.slice(0, 160),
        description: proposal.campaign.description.slice(0, 8000),
        icpText: proposal.campaign.icpText
          ? proposal.campaign.icpText.slice(0, 4000)
          : null,
        goalType,
        earningsModel,
        payoutCents,
        pricingTier: tierId,
        platformFeeBps: PLATFORM_FEE_BPS,
        status: 'DRAFT',
        minScore: DEFAULT_CAMPAIGN_MIN_SCORE,
        requireCertification: DEFAULT_REQUIRE_CERTIFICATION,
        minPracticeSessions: DEFAULT_MIN_PRACTICE_SESSIONS,
        packId: pack.id,
        playbookId: playbook.id,
        budgetCents,
        budgetMode,
        dailyBudgetCents,
        maxAwards,
        bookingLink: proposal.campaign.bookingLink || null,
        meetingDurationMinutes: wantsMeeting
          ? proposal.campaign.meetingDurationMinutes || 20
          : null,
        callingHoursStartMin: proposal.campaign.callingHoursStartMin ?? null,
        callingHoursEndMin: proposal.campaign.callingHoursEndMin ?? null,
        callingTimezone: proposal.campaign.callingTimezone ?? null,
        targetVertical: proposal.campaign.targetVertical || null,
        targetLocation: proposal.campaign.targetLocation || null,
        qualifiedPayoutCents:
          earningsModel === 'PER_QUALIFIED_LEAD' ? payoutCents : null,
      },
    });

    return { pack, playbook, campaign };
  });

  return {
    brand: brandRow,
    packId: result.pack.id,
    playbookId: result.playbook.id,
    campaignId: result.campaign.id,
    createdBrand,
    reused: false,
  };
}
