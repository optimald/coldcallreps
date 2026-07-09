import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { PLAN } from '@/lib/product';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const { tier = 'STARTER' } = await req.json();
    const plan = tier === 'PRO' ? PLAN.PRO : PLAN.STARTER;
    const priceId =
      tier === 'PRO'
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_STARTER_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        {
          error: 'Stripe price IDs not configured',
          hint: `Create $${plan.price}/mo products in Stripe and set STRIPE_*_PRICE_ID`,
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
      const { prisma } = await import('@/lib/prisma');
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      metadata: { userId: profile.id, tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
