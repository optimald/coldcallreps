import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { appBaseUrl, getStripe } from '@/lib/stripe';

async function resolveBrand(idOrSlug: string) {
  return prisma.brand.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      campaigns: {
        where: { escrowLockedCents: { gt: 0 } },
        select: {
          id: true,
          title: true,
          status: true,
          escrowLockedCents: true,
          payoutCents: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      },
    },
  });
}

async function ensureStripeCustomer(profile: {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<string | null> {
  if (profile.stripeCustomerId) return profile.stripeCustomerId;
  if (!profile.email) return null;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: profile.email,
    metadata: { userId: profile.id },
    name: profile.email,
  });
  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** GET /api/brands/[id]/wallet — balance, locked escrow, ledger. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await resolveBrand(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const wallet = await getOrCreateBrandWallet(brand.id);
    const ledger = await prisma.walletLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    const campaignIds = [
      ...new Set(ledger.map((l) => l.campaignId).filter(Boolean) as string[]),
    ];
    const campaigns =
      campaignIds.length > 0
        ? await prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true },
          })
        : [];
    const titleById = Object.fromEntries(campaigns.map((c) => [c.id, c.title]));

    const escrowLockedCents = brand.campaigns.reduce(
      (sum, c) => sum + (c.escrowLockedCents || 0),
      0
    );

    return NextResponse.json({
      brand: { id: brand.id, slug: brand.slug, name: brand.name },
      balanceCents: wallet.balanceCents,
      balanceLabel: `$${(wallet.balanceCents / 100).toFixed(2)}`,
      escrowLockedCents,
      escrowLockedLabel: `$${(escrowLockedCents / 100).toFixed(2)}`,
      availableLabel: `$${((wallet.balanceCents) / 100).toFixed(2)}`,
      currency: wallet.currency,
      campaignsWithEscrow: brand.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        escrowLockedCents: c.escrowLockedCents,
        escrowLabel: `$${(c.escrowLockedCents / 100).toFixed(2)}`,
        payoutCents: c.payoutCents,
      })),
      ledger: ledger.map((l) => ({
        id: l.id,
        type: l.type,
        amountCents: l.amountCents,
        balanceAfter: l.balanceAfter,
        campaignId: l.campaignId,
        campaignTitle: l.campaignId ? titleById[l.campaignId] || null : null,
        note: l.note,
        stripeSessionId: l.stripeSessionId,
        createdAt: l.createdAt.toISOString(),
      })),
      hasStripeCustomer: Boolean(profile.stripeCustomerId),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — Stripe Checkout to fund escrow wallet. Body: { amountCents, returnTo? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await resolveBrand(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const amountCents = Math.max(5000, Math.round(Number(body.amountCents) || 0)); // min $50
    if (amountCents > 500000) {
      return NextResponse.json({ error: 'Max fund is $5,000 per checkout' }, { status: 400 });
    }

    await getOrCreateBrandWallet(brand.id);
    const stripe = getStripe();
    const base = appBaseUrl();
    const returnTo = String(body.returnTo || 'brand');
    const successPath =
      returnTo === 'billing'
        ? `/billing?wallet=funded&brand=${encodeURIComponent(brand.slug || brand.id)}`
        : `/brands/${brand.slug || brand.id}?wallet=funded`;
    const cancelPath =
      returnTo === 'billing'
        ? `/billing?wallet=cancel&brand=${encodeURIComponent(brand.slug || brand.id)}`
        : `/brands/${brand.slug || brand.id}?wallet=cancel`;

    const customerId = await ensureStripeCustomer(profile);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(customerId
        ? { customer: customerId }
        : { customer_email: profile.email || undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Campaign escrow — ${brand.name}`,
              description: 'Prepaid wallet to fund OPEN campaigns and verified appointment payouts',
            },
          },
        },
      ],
      success_url: `${base}${successPath}`,
      cancel_url: `${base}${cancelPath}`,
      metadata: {
        type: 'brand_wallet_fund',
        brandId: brand.id,
        amountCents: String(amountCents),
        userId: profile.id,
      },
      invoice_creation: { enabled: true },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[wallet fund]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
