/**
 * Single source of truth for campaign platform fee policy.
 * Headline 20%, with hard dollar caps so large bases aren't extractive.
 */

export const PLATFORM_FEE_BPS = 2000; // 20%

/** Cap per outcome / claim payout transfer. */
export const PLATFORM_FEE_CAP_CENTS = 3000; // $30

export type BasePayCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export const BASE_PAY_CADENCES: BasePayCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];

/** Cadence-scaled caps ≈ $150/mo max platform take on base. */
export const PLATFORM_BASE_FEE_CAP_BY_CADENCE: Record<BasePayCadence, number> = {
  WEEKLY: 4000, // $40
  BIWEEKLY: 7500, // $75
  MONTHLY: 15000, // $150
};

export function isBasePayCadence(v: unknown): v is BasePayCadence {
  return typeof v === 'string' && (BASE_PAY_CADENCES as string[]).includes(v);
}

export function baseFeeCapCents(cadence: BasePayCadence | string | null | undefined): number {
  if (cadence && isBasePayCadence(cadence)) {
    return PLATFORM_BASE_FEE_CAP_BY_CADENCE[cadence];
  }
  return PLATFORM_BASE_FEE_CAP_BY_CADENCE.MONTHLY;
}

export const PLATFORM_FEE_SUMMARY =
  '20% platform fee on SDR payouts, capped at $30 per outcome and $40/wk · $75/bi-weekly · $150/mo on base pay.';

export const PLATFORM_FEE_EXAMPLES =
  'Example: $75 set → $15 fee. $2,000/mo base → $150 fee (not $400).';

export function cadenceLabel(cadence: BasePayCadence | string | null | undefined): string {
  switch (cadence) {
    case 'WEEKLY':
      return 'week';
    case 'BIWEEKLY':
      return 'bi-week';
    case 'MONTHLY':
      return 'month';
    default:
      return 'period';
  }
}

export function cadenceShortSuffix(cadence: BasePayCadence | string | null | undefined): string {
  switch (cadence) {
    case 'WEEKLY':
      return '/wk';
    case 'BIWEEKLY':
      return '/bi-wk';
    case 'MONTHLY':
      return '/mo';
    default:
      return '';
  }
}
