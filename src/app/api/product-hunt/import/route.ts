import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, effectiveRole } from '@/lib/roles';
import { fetchRecentProductHuntLaunches } from '@/lib/product-hunt';

/**
 * POST /api/product-hunt/import
 * Body: { brandId?: string, limit?: number }
 * Ingests PH launches into ProductHuntImport (+ optional Prospects for brand).
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);
    if (role !== 'BRAND' && role !== 'SUPERADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Brand / admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const brandId = body.brandId ? String(body.brandId) : null;
    const limit = Math.min(50, Math.max(5, Number(body.limit) || 25));

    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      if (!canManageBrand(profile, brand.ownerId) && role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const launches = await fetchRecentProductHuntLaunches(limit);
    let imported = 0;
    let prospectsCreated = 0;

    for (const launch of launches) {
      const row = await prisma.productHuntImport.upsert({
        where: { phId: launch.phId },
        create: {
          phId: launch.phId,
          brandId,
          name: launch.name,
          tagline: launch.tagline,
          url: launch.url,
          votesCount: launch.votesCount,
          featuredAt: launch.featuredAt ? new Date(launch.featuredAt) : null,
          rawJSON: JSON.stringify(launch),
        },
        update: {
          name: launch.name,
          tagline: launch.tagline,
          votesCount: launch.votesCount,
          brandId: brandId || undefined,
        },
      });
      imported += 1;

      if (brandId && !row.prospectId) {
        const prospect = await prisma.prospect.create({
          data: {
            userId: profile.id,
            brandId,
            companyName: launch.name,
            website: launch.url,
            industry: 'SaaS / Product Hunt',
            notes: `PH launch: ${launch.tagline || ''} · votes ${launch.votesCount}`,
            hooksJSON: JSON.stringify([
              launch.tagline || 'Recent Product Hunt launch',
              'Bootstrapped / early GTM — likely capital-aware',
            ]),
            source: 'producthunt',
            enrichmentStatus: 'none',
            status: 'new',
          },
        });
        await prisma.productHuntImport.update({
          where: { id: row.id },
          data: { prospectId: prospect.id },
        });
        prospectsCreated += 1;
      }
    }

    return NextResponse.json({
      imported,
      prospectsCreated,
      launches: launches.length,
      notice: process.env.PRODUCTHUNT_API_TOKEN
        ? 'Live Product Hunt data imported.'
        : 'Demo PH ingest (set PRODUCTHUNT_API_TOKEN for live GraphQL).',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[product-hunt/import]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET — list recent imports */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const brandId = req.nextUrl.searchParams.get('brandId');
    const rows = await prisma.productHuntImport.findMany({
      where: brandId ? { brandId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ imports: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
