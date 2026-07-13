import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { getLeadCreditSnapshot } from '@/lib/lead-credits';
import { BRAND_LEAD_PLAN, LEAD_PACKS } from '@/lib/product';
import {
  listCustomerBilling,
  setPrimaryPaymentMethod,
  setBackupPaymentMethod,
} from '@/lib/billing-stripe';
import { getStripe } from '@/lib/stripe';

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
          take: 80,
        })
      : [];

    const campaignIds = [
      ...new Set(walletLedger.map((l) => l.campaignId).filter(Boolean) as string[]),
    ];
    const campaignTitles =
      campaignIds.length > 0
        ? Object.fromEntries(
            (
              await prisma.campaign.findMany({
                where: { id: { in: campaignIds } },
                select: { id: true, title: true },
              })
            ).map((c) => [c.id, c.title])
          )
        : ({} as Record<string, string>);

    let paymentMethods: Awaited<ReturnType<typeof listCustomerBilling>>['paymentMethods'] = [];
    let invoices: Awaited<ReturnType<typeof listCustomerBilling>>['invoices'] = [];
    let subscription: {
      id: string;
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
      planKey: string;
    } | null = null;

    const customerId = profile.stripeCustomerId;

    if (customerId) {
      try {
        const stripe = getStripe();
        const listed = await listCustomerBilling(stripe, customerId);
        paymentMethods = listed.paymentMethods;
        invoices = listed.invoices;

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
      } catch (e) {
        console.error('brand billing stripe', e);
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
            ledger: walletLedger.map((row) => ({
              ...row,
              campaignTitle: row.campaignId ? campaignTitles[row.campaignId] || null : null,
            })),
          }
        : { balanceCents: 0, balanceLabel: '$0.00', ledger: [] },
      campaigns: brand.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        budgetCents: c.budgetCents,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH — set primary and/or backup payment method. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: raw } = await ctx.params;
    const body = await req.json();
    const hasPrimary = Object.prototype.hasOwnProperty.call(body, 'defaultPaymentMethodId');
    const hasBackup = Object.prototype.hasOwnProperty.call(body, 'backupPaymentMethodId');
    const paymentMethodId = hasPrimary ? String(body.defaultPaymentMethodId || '').trim() : '';
    const backupId = hasBackup
      ? body.backupPaymentMethodId
        ? String(body.backupPaymentMethodId).trim()
        : null
      : undefined;

    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id: raw }, { slug: raw }] },
    });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer — fund wallet or subscribe first' },
        { status: 400 }
      );
    }
    if (!hasPrimary && !hasBackup) {
      return NextResponse.json(
        { error: 'defaultPaymentMethodId or backupPaymentMethodId required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (hasPrimary) {
      if (!paymentMethodId) {
        return NextResponse.json({ error: 'defaultPaymentMethodId required' }, { status: 400 });
      }
      await setPrimaryPaymentMethod(stripe, profile.stripeCustomerId, paymentMethodId);
    }
    if (hasBackup) {
      await setBackupPaymentMethod(stripe, profile.stripeCustomerId, backupId || null);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
