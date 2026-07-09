import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLAN } from '@/lib/product';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const tier = (session.metadata?.tier || 'STARTER') as 'STARTER' | 'PRO';
    if (userId) {
      const minutes = tier === 'PRO' ? PLAN.PRO.minutes : PLAN.STARTER.minutes;
      await prisma.userProfile.update({
        where: { id: userId },
        data: {
          plan: tier,
          minutesRemaining: minutes,
          stripeSubscriptionId:
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id || undefined,
        },
      });
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      const profile = await prisma.userProfile.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (profile) {
        const minutes = profile.plan === 'PRO' ? PLAN.PRO.minutes : PLAN.STARTER.minutes;
        await prisma.userProfile.update({
          where: { id: profile.id },
          data: { minutesRemaining: minutes },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
