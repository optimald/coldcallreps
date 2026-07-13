import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  listCustomerBilling,
  setBackupPaymentMethod,
  setPrimaryPaymentMethod,
} from '@/lib/billing-stripe';
import { getStripe } from '@/lib/stripe';
import { PLAN } from '@/lib/product';

/**
 * GET /api/billing/account — payment methods, invoices, plan summary for the signed-in user.
 * PATCH — set primary (`defaultPaymentMethodId`) and/or backup (`backupPaymentMethodId`) card.
 */
export async function GET() {
  try {
    const profile = await requireUser();
    let paymentMethods: Awaited<ReturnType<typeof listCustomerBilling>>['paymentMethods'] = [];
    let invoices: Awaited<ReturnType<typeof listCustomerBilling>>['invoices'] = [];

    if (profile.stripeCustomerId) {
      try {
        const stripe = getStripe();
        const listed = await listCustomerBilling(stripe, profile.stripeCustomerId);
        paymentMethods = listed.paymentMethods;
        invoices = listed.invoices;
      } catch (e) {
        console.error('billing account stripe', e);
      }
    }

    const planKey = (profile.plan || 'FREE') as keyof typeof PLAN;
    const planMeta = PLAN[planKey] || PLAN.FREE;

    return NextResponse.json({
      plan: profile.plan || 'FREE',
      planLabel: planMeta.label,
      minutesRemaining: profile.minutesRemaining,
      hasSubscription: Boolean(profile.stripeSubscriptionId),
      platformRole: profile.platformRole,
      paymentMethods,
      invoices,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('billing account GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const hasPrimary = Object.prototype.hasOwnProperty.call(body, 'defaultPaymentMethodId');
    const hasBackup = Object.prototype.hasOwnProperty.call(body, 'backupPaymentMethodId');
    const primaryId = hasPrimary ? String(body.defaultPaymentMethodId || '').trim() : '';
    const backupId = hasBackup
      ? body.backupPaymentMethodId
        ? String(body.backupPaymentMethodId).trim()
        : null
      : undefined;

    if (!hasPrimary && !hasBackup) {
      return NextResponse.json(
        { error: 'defaultPaymentMethodId or backupPaymentMethodId required' },
        { status: 400 }
      );
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer — subscribe or add a card first' },
        { status: 400 }
      );
    }

    const customerId = profile.stripeCustomerId;
    const stripe = getStripe();

    if (hasPrimary) {
      if (!primaryId) {
        return NextResponse.json({ error: 'defaultPaymentMethodId required' }, { status: 400 });
      }
      await setPrimaryPaymentMethod(stripe, customerId, primaryId);
      const customer = await stripe.customers.retrieve(customerId);
      const currentBackup =
        !customer.deleted && customer.metadata?.backup_payment_method
          ? customer.metadata.backup_payment_method
          : '';
      if (currentBackup === primaryId) {
        await setBackupPaymentMethod(stripe, customerId, null);
      }
    }

    if (hasBackup) {
      await setBackupPaymentMethod(stripe, customerId, backupId || null);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('billing account PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
