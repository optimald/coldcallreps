/**
 * Marketplace types for ColdCallReps campaign tiers.
 * Maps to Campaign.pricingTier (TIER1 | TIER2 | TIER3).
 */

export type MarketplaceTier = 'TIER_1_SMB' | 'TIER_2_MIDMARKET' | 'TIER_3_ENTERPRISE';

export type CampaignPricingTier = 'TIER1' | 'TIER2' | 'TIER3';

export interface MarketplaceCampaign {
  id: string;
  founderId: string;
  tier: MarketplaceTier;
  suggestedRatePerSet: number; // Tier 1: $35-60, Tier 2: $75-120, Tier 3: $150-250+
  escrowBalance: number;
  isActive: boolean;
  bookingLink?: string | null;
}

export const MARKETPLACE_TIER_RANGES: Record<
  MarketplaceTier,
  { min: number; max: number; pricingTier: CampaignPricingTier; label: string }
> = {
  TIER_1_SMB: { min: 35, max: 60, pricingTier: 'TIER1', label: 'SMB' },
  TIER_2_MIDMARKET: { min: 75, max: 120, pricingTier: 'TIER2', label: 'Mid-market' },
  TIER_3_ENTERPRISE: { min: 150, max: 250, pricingTier: 'TIER3', label: 'Enterprise' },
};

export function pricingTierToMarketplace(tier: string | null | undefined): MarketplaceTier {
  const t = (tier || 'TIER2').toUpperCase();
  if (t === 'TIER1' || t === 'TIER_1') return 'TIER_1_SMB';
  if (t === 'TIER3' || t === 'TIER_3') return 'TIER_3_ENTERPRISE';
  return 'TIER_2_MIDMARKET';
}

export function marketplaceToPricingTier(tier: MarketplaceTier): CampaignPricingTier {
  return MARKETPLACE_TIER_RANGES[tier].pricingTier;
}
