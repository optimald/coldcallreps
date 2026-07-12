import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { appBaseUrl, getStripe } from '@/lib/stripe';

/** GET /api/brands/[id]/wallet — balance + recent ledger. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const wallet = await getOrCreateBrandWallet(id);
    const ledger = await prisma.walletLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    return NextResponse.json({
      balanceCents: wallet.balanceCents,
      balanceLabel: `$${(wallet.balanceCents / 100).toFixed(2)}`,
      currency: wallet.currency,
      ledger,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — start Stripe Checkout to fund escrow wallet. Body: { amountCents } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const amountCents = Math.max(5000, Math.round(Number(body.amountCents) || 0)); // min $50
    if (amountCents > 500000) {
      return NextResponse.json({ error: 'Max fund is $5,000 per checkout' }, { status: 400 });
    }

    await getOrCreateBrandWallet(id);
    const stripe = getStripe();
    const base = appBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: profile.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `ColdCallReps escrow — ${brand.name}`,
              description: 'Prepaid wallet for verified appointment campaigns',
            },
          },
        },
      ],
      success_url: `${base}/brands/${brand.slug || id}?wallet=funded`,
      cancel_url: `${base}/brands/${brand.slug || id}?wallet=cancel`,
      metadata: {
        type: 'brand_wallet_fund',
        brandId: id,
        amountCents: String(amountCents),
        userId: profile.id,
      },
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
