import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { MINUTE_PACKS, priceIdForPack, type MinutePackKey } from '@/lib/product';
import { trackEvent } from '@/lib/posthog/analytics';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/** One-time minute pack checkout (personal or org pool). */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const packKey = String(body.pack || 'pack_60') as MinutePackKey;
    const pack = MINUTE_PACKS.find((p) => p.key === packKey);
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
    }

    const priceId = priceIdForPack(pack.key);
    if (!priceId) {
      return NextResponse.json(
        {
          error: 'Minute pack price not configured',
          hint: `Set ${pack.priceEnv} in env`,
        },
        { status: 500 }
      );
    }

    const target =
      body.target === 'org_pool' && profile.orgId && profile.plan === 'TEAM'
        ? 'org_pool'
        : 'personal';

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || undefined,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;
      const { prisma } = await import('@/lib/prisma');
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
      success_url: `${appUrl}/subscribe/sdr?pack=success&minutes=${pack.minutes}`,
      cancel_url: `${appUrl}/subscribe/sdr?pack=cancel`,
      metadata: {
        userId: profile.id,
        kind: 'minute_pack',
        minutes: String(pack.minutes),
        pack: pack.key,
        target,
      },
    });

    trackEvent(profile.id, 'subscription_checkout_started', {
      role: 'REP',
      checkoutKind: 'minute_pack',
      pack: pack.key,
      minutes: pack.minutes,
      target,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
