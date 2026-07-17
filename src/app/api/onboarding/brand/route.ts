import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildRoleModeState,
  serializeUnlockedRoles,
} from '@/lib/role-mode';
import {
  normalizeWebsiteUrl,
  resolveBrandLogoFromWebsite,
} from '@/lib/fetch-brand-logo';
import { normalizeLogoUrlInput } from '@/lib/brand-logo-upload';
import { identifyBrandGroup, syncPersonProfile, trackEvent } from '@/lib/posthog/analytics';

/**
 * POST /api/onboarding/brand
 * Unlock Brand mode + create the brand (no campaign / no wallet funding).
 *
 * Body: { accept: true, brandName, websiteUrl, description, logoUrl? }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));

    if (body.accept !== true && !profile.brandOnboardedAt) {
      return NextResponse.json(
        {
          error: 'Choose Brand on the account type screen to continue.',
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

      return { brand, updated };
    });

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

      trackEvent(profile.id, 'onboarding_completed', {
        role: 'BRAND',
        brandId: result.brand.id,
        brandSlug: result.brand.slug,
        redirectTo: `/brands/${result.brand.slug}`,
      });
      identifyBrandGroup(result.brand.id, {
        name: result.brand.name,
        slug: result.brand.slug,
      });
      syncPersonProfile(result.updated);
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
      redirectTo: `/brands/${result.brand.slug}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (/Unique constraint/i.test(message)) {
      return NextResponse.json(
        { error: 'Brand slug taken — try a different name' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
