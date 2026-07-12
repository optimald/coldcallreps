import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { PLAN, priceIdForTier, type PaidPlanKey } from '@/lib/product';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

const VALID: PaidPlanKey[] = ['STARTER', 'PRO', 'TEAM'];

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    if (body.tier === 'RECRUITER') {
      return NextResponse.json(
        {
          error: 'Recruiter desk was demoted — sign up as Brand / Founder to post campaigns and review SDRs.',
          code: 'ROLE_DEMOTED',
          activatePath: '/sign-up?role=BRAND',
        },
        { status: 400 }
      );
    }
    const tier = (VALID.includes(body.tier) ? body.tier : 'STARTER') as PaidPlanKey;
    const plan = PLAN[tier];
    const priceId = priceIdForTier(tier);

    if (!priceId) {
      const priceHint =
        tier === 'TEAM'
          ? `Create a $${PLAN.TEAM.price}/user/mo seat price in Stripe and set STRIPE_TEAM_PRICE_ID`
          : `Create $${plan.price}/mo product in Stripe and set STRIPE_${tier}_PRICE_ID`;
      return NextResponse.json(
        {
          error: 'Stripe price IDs not configured',
          hint: priceHint,
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

    const seats =
      tier === 'TEAM'
        ? Math.min(Math.max(Number(body.seats) || PLAN.TEAM.seats || 5, 1), 100)
        : 1;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        tier === 'TEAM'
          ? {
              price: priceId,
              quantity: seats,
              adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
            }
          : { price: priceId, quantity: 1 },
      ],
      success_url: `${appUrl}/dashboard?checkout=success&tier=${tier}`,
      cancel_url: `${appUrl}/billing?checkout=cancel`,
      metadata: {
        userId: profile.id,
        tier,
        ...(tier === 'TEAM' ? { seats: String(seats) } : {}),
      },
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
