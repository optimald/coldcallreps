import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { LEAD_PACKS, priceIdForLeadPack, type LeadPackKey } from '@/lib/product';
import { trackEvent } from '@/lib/posthog/analytics';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/** One-time brand lead credit pack (12-month shelf life). */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const brandId = String(body.brandId || '').trim();
    const packKey = String(body.pack || 'lead_pack_250') as LeadPackKey;
    const pack = LEAD_PACKS.find((p) => p.key === packKey);

    if (!brandId) {
      return NextResponse.json({ error: 'brandId required' }, { status: 400 });
    }
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const priceId = priceIdForLeadPack(pack.key);
    if (!priceId) {
      return NextResponse.json(
        {
          error: 'Lead pack price not configured',
          hint: `Set ${pack.priceEnv} in env ($${pack.priceUsd} one-time for ${pack.credits} credits)`,
          catalog: pack,
        },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || undefined,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const couponId =
      typeof body.couponId === 'string' && body.couponId.trim()
        ? body.couponId.trim()
        : null;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: !couponId,
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      success_url: `${appUrl}/subscribe/brand?lead_pack=success&credits=${pack.credits}&brand=${encodeURIComponent(brand.slug || brandId)}`,
      cancel_url: `${appUrl}/subscribe/brand?lead_pack=cancel&brand=${encodeURIComponent(brand.slug || brandId)}`,
      metadata: {
        userId: profile.id,
        brandId,
        kind: 'lead_pack',
        pack: pack.key,
        credits: String(pack.credits),
      },
    });

    trackEvent(profile.id, 'subscription_checkout_started', {
      role: 'BRAND',
      checkoutKind: 'lead_pack',
      brandId,
      pack: pack.key,
      credits: pack.credits,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
