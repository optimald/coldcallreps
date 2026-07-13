import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_CAMPAIGN_MIN_SCORE,
  DEFAULT_MIN_PRACTICE_SESSIONS,
  DEFAULT_REQUIRE_CERTIFICATION,
  resolvePayoutCents,
} from '@/lib/campaign-tiers';
import {
  defaultPlaybookContent,
  defaultPlaybookTitle,
} from '@/lib/playbooks/default';
import {
  buildRoleModeState,
  homeForMode,
  serializeUnlockedRoles,
} from '@/lib/role-mode';
import {
  normalizeWebsiteUrl,
  resolveBrandLogoFromWebsite,
} from '@/lib/fetch-brand-logo';
import { normalizeLogoUrlInput } from '@/lib/brand-logo-upload';

/**
 * POST /api/onboarding/brand
 * Accept Brand role + create brand, starter campaign (DRAFT), starter playbook.
 * Optional wallet fund handoff via returned walletFundUrl.
 *
 * Body: {
 *   accept: true,
 *   brandName, websiteUrl, description,
 *   logoUrl?, // optional override; otherwise fetched from websiteUrl
 *   campaignTitle?, campaignDescription?, pricingTier?,
 *   fundWalletCents?: number  // optional Stripe Checkout for escrow
 * }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));

    if (body.accept !== true && !profile.brandOnboardedAt) {
      return NextResponse.json(
        {
          error: 'Accept adding the Brand role to continue.',
          code: 'ACCEPT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const brandName = String(body.brandName || body.name || '').trim().slice(0, 120);
    if (!brandName) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const description = body.description
      ? String(body.description).trim().slice(0, 1000)
      : '';
    if (!description) {
      return NextResponse.json({ error: 'A short description is required' }, { status: 400 });
    }

    const websiteUrl = normalizeWebsiteUrl(String(body.websiteUrl || body.website || ''));
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'A valid website URL is required (we use it to fetch your logo)' },
        { status: 400 }
      );
    }

    let logoUrl: string | null = null;
    if (body.logoUrl != null && String(body.logoUrl).trim()) {
      const parsed = normalizeLogoUrlInput(body.logoUrl);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      logoUrl = parsed.logoUrl;
    }
    if (!logoUrl) {
      logoUrl = await resolveBrandLogoFromWebsite(websiteUrl);
    }

    const baseSlug =
      String(body.slug || brandName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || `brand-${Date.now().toString(36)}`;

    let slug = baseSlug;
    for (let i = 0; i < 6; i++) {
      const taken = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
      if (!taken) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const roleMode = buildRoleModeState(profile);
    const unlocked = new Set(roleMode.unlockedRoles.map(String));
    unlocked.add('BRAND');

    const result = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: {
          ownerId: profile.id,
          name: brandName,
          slug,
          description,
          websiteUrl,
          logoUrl,
        },
      });

      const playbook = await tx.playbook.create({
        data: {
          userId: profile.id,
          brandId: brand.id,
          title: defaultPlaybookTitle('foundation'),
          contentJSON: JSON.stringify(defaultPlaybookContent('foundation')),
        },
      });

      const { tierId, payoutCents } = resolvePayoutCents({
        tierId: body.pricingTier || body.tierId || 'TIER2',
        payoutCents:
          body.payoutCents != null ? Math.round(Number(body.payoutCents)) : null,
      });

      const campaignTitle =
        String(body.campaignTitle || `${brandName} outbound`).trim().slice(0, 160) ||
        `${brandName} outbound`;
      const campaignDescription =
        String(
          body.campaignDescription ||
            `Book qualified meetings for ${brandName}. SDRs follow the starter playbook and brand ICP.`
        )
          .trim()
          .slice(0, 8000);

      const campaign = await tx.campaign.create({
        data: {
          brandId: brand.id,
          createdByUserId: profile.id,
          title: campaignTitle,
          description: campaignDescription,
          goalType: 'BOOKED_MEETING',
          payoutCents,
          pricingTier: tierId,
          status: 'DRAFT',
          minScore: DEFAULT_CAMPAIGN_MIN_SCORE,
          requireCertification: DEFAULT_REQUIRE_CERTIFICATION,
          minPracticeSessions: DEFAULT_MIN_PRACTICE_SESSIONS,
          playbookId: playbook.id,
          maxAwards: 10,
          budgetCents: payoutCents * 10,
        },
      });

      await tx.brandWallet.create({
        data: {
          brandId: brand.id,
          balanceCents: 0,
        },
      });

      const updated = await tx.userProfile.update({
        where: { id: profile.id },
        data: {
          platformRole: 'BRAND',
          unlockedRolesJSON: serializeUnlockedRoles(unlocked),
          brandOnboardedAt: profile.brandOnboardedAt || new Date(),
        },
      });

      return { brand, playbook, campaign, updated };
    });

    let walletFundUrl: string | null = null;
    const fundCents = Math.round(Number(body.fundWalletCents) || 0);
    if (fundCents >= 5000) {
      try {
        const { getStripe, appBaseUrl } = await import('@/lib/stripe');
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
                unit_amount: Math.min(fundCents, 500000),
                product_data: {
                  name: `ColdCallReps escrow — ${result.brand.name}`,
                  description: 'Prepaid wallet for verified appointment campaigns',
                },
              },
            },
          ],
          success_url: `${base}/brands/${result.brand.slug}?wallet=funded`,
          cancel_url: `${base}/onboarding/brand?wallet=cancel`,
          metadata: {
            type: 'brand_wallet_fund',
            brandId: result.brand.id,
            amountCents: String(Math.min(fundCents, 500000)),
            userId: profile.id,
          },
        });
        walletFundUrl = session.url;
      } catch (e) {
        console.warn('[onboarding/brand] wallet checkout failed', e);
      }
    }

    if (!profile.brandOnboardedAt) {
      const { notifyAsync } = await import('@/lib/notifications');
      notifyAsync({
        event: 'welcome.brand',
        recipient: {
          userId: profile.id,
          email: profile.email,
          displayName: profile.displayName,
        },
        brand: {
          id: result.brand.id,
          name: result.brand.name,
          slug: result.brand.slug,
          logoUrl: result.brand.logoUrl,
        },
        payload: {
          ctaUrl: `/brands/${result.brand.slug}`,
          forAudience: 'brand',
        },
        idempotencyKey: `welcome.brand:${profile.id}:${result.brand.id}`,
      });
    }

    return NextResponse.json({
      ok: true,
      platformRole: result.updated.platformRole,
      roleMode: buildRoleModeState(result.updated),
      brand: {
        id: result.brand.id,
        name: result.brand.name,
        slug: result.brand.slug,
        logoUrl: result.brand.logoUrl,
      },
      campaign: {
        id: result.campaign.id,
        title: result.campaign.title,
        status: result.campaign.status,
      },
      playbook: {
        id: result.playbook.id,
        title: result.playbook.title,
      },
      walletFundUrl,
      redirectTo: walletFundUrl ? null : homeForMode('BRAND'),
      paymentHint:
        'Campaigns need a funded escrow wallet before going live. You can fund anytime from your brand page.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    // Unique slug race
    if (/Unique constraint/i.test(message)) {
      return NextResponse.json(
        { error: 'Brand slug taken — try a different name' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
