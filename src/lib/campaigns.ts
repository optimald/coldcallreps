import type {
  Campaign,
  CampaignApplicationStatus,
  CampaignGoalType,
  CampaignStatus,
  ProductPack,
  Playbook,
  Brand,
} from '@prisma/client';

export const CAMPAIGN_GOAL_TYPES: CampaignGoalType[] = ['QUALIFIED_LEAD', 'BOOKED_MEETING'];
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED'];
export const APPLICATION_STATUSES: CampaignApplicationStatus[] = [
  'APPLIED',
  'ACCEPTED',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'WITHDRAWN',
];

export const GOAL_LABELS: Record<CampaignGoalType, string> = {
  QUALIFIED_LEAD: 'Qualified lead',
  BOOKED_MEETING: 'Booked meeting',
};

export function isCampaignGoalType(v: unknown): v is CampaignGoalType {
  return typeof v === 'string' && (CAMPAIGN_GOAL_TYPES as string[]).includes(v);
}

export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === 'string' && (CAMPAIGN_STATUSES as string[]).includes(v);
}

export function isApplicationStatus(v: unknown): v is CampaignApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as string[]).includes(v);
}

export function formatPayout(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Split a campaign outcome payment.
 * Brand pays `payoutCents`; platform keeps `platformFeeBps` (default 20%); SDR receives the rest.
 */
export function calcPayoutSplit(payoutCents: number, platformFeeBps = 2000) {
  const grossCents = Math.max(0, Math.round(payoutCents));
  const bps = Math.min(10000, Math.max(0, Math.round(platformFeeBps)));
  const platformFeeCents = Math.round((grossCents * bps) / 10000);
  const netCents = Math.max(0, grossCents - platformFeeCents);
  return { grossCents, platformFeeCents, netCents, platformFeeBps: bps };
}

export function serializePayout(p: {
  id: string;
  status: string;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  paidAt?: Date | null;
  failureReason?: string | null;
}) {
  return {
    id: p.id,
    status: p.status,
    grossCents: p.grossCents,
    platformFeeCents: p.platformFeeCents,
    netCents: p.netCents,
    grossLabel: formatPayout(p.grossCents),
    netLabel: formatPayout(p.netCents),
    feeLabel: formatPayout(p.platformFeeCents),
    paidAt: p.paidAt,
    failureReason: p.failureReason || null,
  };
}

export function practiceHref(campaign: {
  brandId: string;
  packId?: string | null;
  playbookId?: string | null;
}): string | null {
  if (!campaign.brandId) return null;
  const qs = new URLSearchParams({ brandId: campaign.brandId });
  if (campaign.packId) qs.set('packId', campaign.packId);
  if (campaign.playbookId) qs.set('playbookId', campaign.playbookId);
  return `/practice?${qs.toString()}`;
}

type CampaignWithRelations = Campaign & {
  brand?: Pick<Brand, 'id' | 'name' | 'slug' | 'logoUrl'> | null;
  pack?: Pick<ProductPack, 'id' | 'name'> | null;
  playbook?: Pick<Playbook, 'id' | 'title'> | null;
  _count?: { applications: number };
  myApplication?: { id: string; status: CampaignApplicationStatus } | null;
};

export function serializeCampaign(c: CampaignWithRelations) {
  return {
    id: c.id,
    brandId: c.brandId,
    createdByUserId: c.createdByUserId,
    title: c.title,
    description: c.description,
    icpText: c.icpText,
    goalType: c.goalType,
    goalLabel: GOAL_LABELS[c.goalType],
    payoutCents: c.payoutCents,
    payoutLabel: formatPayout(c.payoutCents),
    pricingTier: (c as { pricingTier?: string }).pricingTier || null,
    platformFeeBps: c.platformFeeBps,
    status: c.status,
    minScore: c.minScore,
    requireCertification: c.requireCertification,
    minPracticeSessions: (c as { minPracticeSessions?: number }).minPracticeSessions ?? 1,
    packId: c.packId,
    playbookId: c.playbookId,
    budgetCents: c.budgetCents,
    escrowLockedCents: (c as { escrowLockedCents?: number }).escrowLockedCents ?? 0,
    maxAwards: c.maxAwards,
    bookingLink: (c as { bookingLink?: string | null }).bookingLink ?? null,
    targetVertical: (c as { targetVertical?: string | null }).targetVertical ?? null,
    targetLocation: (c as { targetLocation?: string | null }).targetLocation ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    brand: c.brand
      ? {
          id: c.brand.id,
          name: c.brand.name,
          slug: c.brand.slug,
          logoUrl: c.brand.logoUrl,
        }
      : undefined,
    pack: c.pack ? { id: c.pack.id, name: c.pack.name } : null,
    playbook: c.playbook ? { id: c.playbook.id, title: c.playbook.title } : null,
    applicationCount: c._count?.applications,
    myApplication: c.myApplication ?? undefined,
    practiceHref: practiceHref(c),
  };
}
