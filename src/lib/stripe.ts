import Stripe from 'stripe';

/** Shared Stripe client — keep apiVersion in sync across billing routes. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Create a Connect account for an SDR (marketplace recipient).
 * Uses controller properties (Express-style dashboard) — preferred over legacy `type: 'express'`.
 * @see https://docs.stripe.com/connect/migrate-to-controller-properties
 */
export async function createConnectAccount(opts: {
  email?: string | null;
  userId: string;
  country?: string;
}): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.create({
    controller: {
      stripe_dashboard: { type: 'express' },
      fees: { payer: 'application' },
      losses: { payments: 'application' },
    },
    capabilities: {
      transfers: { requested: true },
    },
    country: opts.country || process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || 'US',
    email: opts.email || undefined,
    business_type: 'individual',
    metadata: { userId: opts.userId },
  });
}

export async function createConnectOnboardingLink(opts: {
  accountId: string;
  refreshPath?: string;
  returnPath?: string;
}): Promise<Stripe.AccountLink> {
  const stripe = getStripe();
  const base = appBaseUrl();
  return stripe.accountLinks.create({
    account: opts.accountId,
    refresh_url: `${base}${opts.refreshPath || '/billing?connect=refresh'}`,
    return_url: `${base}${opts.returnPath || '/billing?connect=return'}`,
    type: 'account_onboarding',
  });
}

export function connectStatusFromAccount(account: Stripe.Account) {
  return {
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
  };
}
