/**
 * Productized campaign pricing — Uber Eats–style flat tiers (no bidding).
 * Rates are per verified booked meeting / qualified set.
 */

export type CampaignTierId = 'TIER1' | 'TIER2' | 'TIER3';

export type CampaignTier = {
  id: CampaignTierId;
  label: string;
  subtitle: string;
  minCents: number;
  maxCents: number;
  /** Default selected payout when creating a campaign. */
  suggestedCents: number;
  criteria: string;
};

export const CAMPAIGN_TIERS: CampaignTier[] = [
  {
    id: 'TIER1',
    label: 'High Volume',
    subtitle: '$35 – $60 / set',
    minCents: 3500,
    maxCents: 6000,
    suggestedCents: 4500,
    criteria: 'Local services, SMB software, marketing agencies. Lower gatekeeper friction.',
  },
  {
    id: 'TIER2',
    label: 'Mid-Market',
    subtitle: '$75 – $120 / set',
    minCents: 7500,
    maxCents: 12000,
    suggestedCents: 9000,
    criteria: 'B2B SaaS, mid-level managers. Strict BANT screening + script conditioning.',
  },
  {
    id: 'TIER3',
    label: 'Enterprise',
    subtitle: '$150 – $250+ / set',
    minCents: 15000,
    maxCents: 25000,
    suggestedCents: 17500,
    criteria: 'C-suite / complex tech. Extreme gatekeeper resistance.',
  },
];

export function getCampaignTier(id: string | null | undefined): CampaignTier | null {
  if (!id) return null;
  return CAMPAIGN_TIERS.find((t) => t.id === id) || null;
}

/** Clamp free-form cents into a tier band, or map to nearest suggested. */
export function resolvePayoutCents(opts: {
  tierId?: string | null;
  payoutCents?: number | null;
}): { tierId: CampaignTierId; payoutCents: number } {
  const tier =
    getCampaignTier(opts.tierId) ||
    CAMPAIGN_TIERS.find(
      (t) =>
        opts.payoutCents != null &&
        opts.payoutCents >= t.minCents &&
        opts.payoutCents <= t.maxCents
    ) ||
    CAMPAIGN_TIERS[1];

  let cents =
    typeof opts.payoutCents === 'number' && opts.payoutCents > 0
      ? Math.round(opts.payoutCents)
      : tier.suggestedCents;

  cents = Math.min(tier.maxCents, Math.max(tier.minCents, cents));
  return { tierId: tier.id, payoutCents: cents };
}

/** Default AI gate: practice score before apply. */
export const DEFAULT_CAMPAIGN_MIN_SCORE = 80;
export const DEFAULT_REQUIRE_CERTIFICATION = true;
/** Minimum completed trainer sessions on the brand (or pack) before apply. */
export const DEFAULT_MIN_PRACTICE_SESSIONS = 1;
