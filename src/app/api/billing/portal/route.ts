import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * Stripe Customer Portal — payment methods, invoices, billing details.
 * Creates a Stripe customer if the user only has wallet checkouts so far.
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const stripe = getStripe();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
      /\/$/,
      ''
    );

    let body: { returnPath?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const returnPath = String(body.returnPath || '/billing').startsWith('/')
      ? String(body.returnPath || '/billing')
      : '/billing';

    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      if (!profile.email) {
        return NextResponse.json(
          { error: 'Add an email to your account before opening billing portal' },
          { status: 400 }
        );
      }
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}${returnPath}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Portal failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
