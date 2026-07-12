import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export async function POST() {
  try {
    const profile = await requireUser();
    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account yet — subscribe first' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
