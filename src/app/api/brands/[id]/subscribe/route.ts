import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk, canManageBrand } from '@/lib/roles';
import { getLeadCreditSnapshot } from '@/lib/lead-credits';
import { BRAND_LEAD_FREE_MONTHLY, BRAND_LEAD_PLAN } from '@/lib/product';
import { getStripe } from '@/lib/stripe';
import { BRAND_DESK_MODE_COOKIE } from '@/lib/brand-context';
import { resolveDeskBrand } from '@/lib/desk-brand';
import { isPlatformDemoSlug } from '@/lib/demo/canonical-brands';

/**
 * GET /api/brands/[id]/subscribe
 * Current lead-plan status for Subscribe. Demo desk brands are readable (checkout disabled).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: raw } = await ctx.params;
    const deskMode =
      (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value === 'demo' ? 'demo' : 'live';

    const resolved = await resolveDeskBrand(raw);
    if (!resolved) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    const { brand } = resolved;

    const canView =
      canManageBrand(profile, brand.ownerId) ||
      canAccessBrandDesk(profile, brand, deskMode) ||
      profile.platformRole === 'SUPERADMIN';
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isDemo = deskMode === 'demo' || isPlatformDemoSlug(brand.slug);
    const canCheckout =
      !isDemo &&
      (canManageBrand(profile, brand.ownerId) || profile.platformRole === 'SUPERADMIN');

    // Demo / synthetic brands: show Free catalog without requiring wallet rows
    if (isDemo) {
      const dbBrand = await prisma.brand.findFirst({
        where: { OR: [{ id: brand.id }, { slug: brand.slug }] },
        select: { id: true },
      });
      if (!dbBrand) {
        return NextResponse.json({
          brand: { id: brand.id, slug: brand.slug, name: brand.name },
          canCheckout: false,
          demo: true,
          credits: {
            plan: 'FREE',
            allotmentRemaining: BRAND_LEAD_FREE_MONTHLY,
            packRemaining: 0,
            totalRemaining: BRAND_LEAD_FREE_MONTHLY,
            usedThisPeriod: 0,
            periodLimit: BRAND_LEAD_FREE_MONTHLY,
          },
          plan: {
            key: 'FREE',
            label: BRAND_LEAD_PLAN.FREE.label,
            priceUsd: 0,
            allotment: BRAND_LEAD_PLAN.FREE.allotment,
          },
          subscription: null,
        });
      }
    }

    const brandId =
      (
        await prisma.brand.findFirst({
          where: { OR: [{ id: brand.id }, { slug: brand.slug }] },
          select: { id: true, stripeLeadSubscriptionId: true },
        })
      )?.id || brand.id;

    const dbRow = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { stripeLeadSubscriptionId: true },
    });

    const credits = await getLeadCreditSnapshot(brandId);
    const planMeta =
      credits.plan === 'LEAD_ANNUAL'
        ? BRAND_LEAD_PLAN.LEAD_ANNUAL
        : credits.plan === 'LEAD_MONTHLY'
          ? BRAND_LEAD_PLAN.LEAD_MONTHLY
          : BRAND_LEAD_PLAN.FREE;

    let subscription: {
      id: string;
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
    } | null = null;

    if (dbRow?.stripeLeadSubscriptionId && canCheckout) {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(dbRow.stripeLeadSubscriptionId);
        subscription = {
          id: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: sub.current_period_end ?? null,
        };
      } catch {
        subscription = null;
      }
    }

    return NextResponse.json({
      brand: { id: brandId, slug: brand.slug, name: brand.name },
      canCheckout,
      demo: isDemo,
      credits,
      plan: {
        key: credits.plan,
        label: planMeta.label,
        priceUsd: planMeta.priceUsd,
        allotment: planMeta.allotment,
      },
      subscription,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('brand subscribe', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
