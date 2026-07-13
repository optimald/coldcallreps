import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  BRAND_LEAD_PLAN,
  priceIdForBrandLeadPlan,
  type BrandLeadPlanKey,
} from '@/lib/product';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/** Subscribe brand to Brand Lead Plan (monthly or annual). */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const brandId = String(body.brandId || '').trim();
    const interval = body.interval === 'year' ? 'year' : 'month';
    const planKey: Exclude<BrandLeadPlanKey, 'FREE'> =
      interval === 'year' ? 'LEAD_ANNUAL' : 'LEAD_MONTHLY';

    if (!brandId) {
      return NextResponse.json({ error: 'brandId required' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const priceId = priceIdForBrandLeadPlan(planKey);
    const plan = BRAND_LEAD_PLAN[planKey];
    if (!priceId) {
      return NextResponse.json(
        {
          error: 'Stripe price not configured',
          hint: `Create a $${plan.priceUsd} ${plan.interval}ly product and set ${plan.priceEnv}`,
          catalog: {
            key: planKey,
            priceUsd: plan.priceUsd,
            allotment: plan.allotment,
          },
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

    // Checkout promo codes (LAUNCH20 / BRAND50). Optional direct coupon id.
    const couponId =
      typeof body.couponId === 'string' && body.couponId.trim()
        ? body.couponId.trim()
        : null;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: !couponId,
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      success_url: `${appUrl}/subscribe/brand?lead_plan=success&brand=${encodeURIComponent(brand.slug || brandId)}`,
      cancel_url: `${appUrl}/subscribe/brand?lead_plan=cancel&brand=${encodeURIComponent(brand.slug || brandId)}`,
      metadata: {
        userId: profile.id,
        brandId,
        kind: 'brand_lead_plan',
        leadPlan: planKey,
      },
      subscription_data: {
        metadata: {
          brandId,
          kind: 'brand_lead_plan',
          leadPlan: planKey,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('lead-plan checkout', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
