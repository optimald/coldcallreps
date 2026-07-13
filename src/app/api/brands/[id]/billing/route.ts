import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { getLeadCreditSnapshot } from '@/lib/lead-credits';
import { BRAND_LEAD_PLAN, LEAD_PACKS } from '@/lib/product';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * GET /api/brands/[id]/billing
 * Brand billing overview: lead credits, wallet, campaigns, Stripe charges + payment methods.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: raw } = await ctx.params;
    const brand = await prisma.brand.findFirst({
      where: {
        OR: [{ id: raw }, { slug: raw }],
      },
      include: {
        wallet: true,
        campaigns: {
          select: {
            id: true,
            title: true,
            status: true,
            budgetCents: true,
            dailyBudgetCents: true,
            budgetMode: true,
            escrowLockedCents: true,
            payoutCents: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
        },
      },
    });

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const credits = await getLeadCreditSnapshot(brand.id);
    const creditLedger = await prisma.brandLeadCreditLedger.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const walletLedger = brand.wallet
      ? await prisma.walletLedger.findMany({
          where: { walletId: brand.wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 40,
        })
      : [];

    let paymentMethods: Array<{
      id: string;
      brand: string | null;
      last4: string | null;
      expMonth: number | null;
      expYear: number | null;
      isDefault: boolean;
      isBackup: boolean;
    }> = [];
    let invoices: Array<{
      id: string;
      number: string | null;
      status: string | null;
      amountPaid: number;
      currency: string;
      created: number;
      hostedInvoiceUrl: string | null;
      description: string | null;
    }> = [];
    let subscription: {
      id: string;
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
      planKey: string;
    } | null = null;

    const stripe = getStripe();
    const customerId = profile.stripeCustomerId;

    if (stripe && customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      const defaultPm =
        !customer.deleted && customer.invoice_settings?.default_payment_method
          ? typeof customer.invoice_settings.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings.default_payment_method.id
          : null;

      const pms = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 10,
      });

      paymentMethods = pms.data.map((pm, idx) => ({
        id: pm.id,
        brand: pm.card?.brand || null,
        last4: pm.card?.last4 || null,
        expMonth: pm.card?.exp_month || null,
        expYear: pm.card?.exp_year || null,
        isDefault: defaultPm ? pm.id === defaultPm : idx === 0,
        isBackup: defaultPm ? pm.id !== defaultPm : idx === 1,
      }));

      // Ensure at most one backup flag when no default set
      if (!defaultPm && paymentMethods.length > 1) {
        paymentMethods = paymentMethods.map((pm, idx) => ({
          ...pm,
          isDefault: idx === 0,
          isBackup: idx === 1,
        }));
      }

      const inv = await stripe.invoices.list({ customer: customerId, limit: 20 });
      invoices = inv.data.map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status ?? null,
        amountPaid: i.amount_paid,
        currency: i.currency,
        created: i.created,
        hostedInvoiceUrl: i.hosted_invoice_url ?? null,
        description: i.lines?.data?.[0]?.description || i.description || null,
      }));

      if (brand.stripeLeadSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(brand.stripeLeadSubscriptionId);
          subscription = {
            id: sub.id,
            status: sub.status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end ?? null,
            planKey: brand.leadPlan,
          };
        } catch {
          subscription = null;
        }
      }
    }

    const planMeta =
      credits.plan === 'LEAD_ANNUAL'
        ? BRAND_LEAD_PLAN.LEAD_ANNUAL
        : credits.plan === 'LEAD_MONTHLY'
          ? BRAND_LEAD_PLAN.LEAD_MONTHLY
          : BRAND_LEAD_PLAN.FREE;

    return NextResponse.json({
      brand: {
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
      },
      credits,
      plan: {
        key: credits.plan,
        label: planMeta.label,
        priceUsd: planMeta.priceUsd,
        allotment: planMeta.allotment,
      },
      catalog: {
        monthly: BRAND_LEAD_PLAN.LEAD_MONTHLY,
        annual: BRAND_LEAD_PLAN.LEAD_ANNUAL,
        packs: LEAD_PACKS,
      },
      subscription,
      paymentMethods,
      invoices,
      wallet: brand.wallet
        ? {
            balanceCents: brand.wallet.balanceCents,
            balanceLabel: `$${(brand.wallet.balanceCents / 100).toFixed(2)}`,
            ledger: walletLedger,
          }
        : { balanceCents: 0, balanceLabel: '$0.00', ledger: [] },
      campaigns: brand.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        budgetCents: c.budgetCents,
        dailyBudgetCents: c.dailyBudgetCents,
        budgetMode: c.budgetMode,
        escrowLockedCents: c.escrowLockedCents,
        payoutCents: c.payoutCents,
        budgetLabel:
          c.budgetCents != null ? `$${(c.budgetCents / 100).toFixed(0)}` : '—',
        escrowLabel: `$${((c.escrowLockedCents || 0) / 100).toFixed(2)}`,
      })),
      creditLedger,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('brand billing', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — set default payment method (primary). Backup = next card. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: raw } = await ctx.params;
    const body = await req.json();
    const paymentMethodId = String(body.defaultPaymentMethodId || '').trim();

    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id: raw }, { slug: raw }] },
    });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stripe = getStripe();
    if (!stripe || !profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer — fund wallet or subscribe first' },
        { status: 400 }
      );
    }
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'defaultPaymentMethodId required' }, { status: 400 });
    }

    await stripe.customers.update(profile.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
