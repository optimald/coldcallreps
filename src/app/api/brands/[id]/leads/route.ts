import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canManageBrand } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { PROSPECT_LIST_SELECT } from '@/lib/brand-leads';
import { TRAINING_SOURCE } from '@/lib/training-leads';

/**
 * GET /api/brands/[id]/leads — brand CRM list (alias of /api/prospects?brandId=…).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const { brand, deskMode } = await requireDeskBrand(id);
    const isDemoBrand =
      deskMode === 'demo' &&
      Boolean(brand.slug?.startsWith('demo-')) &&
      ['BRAND', 'RECRUITER', 'SUPERADMIN'].includes(profile.platformRole);
    if (!canManageBrand(profile, brand.ownerId) && !isDemoBrand) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();
    const source = searchParams.get('source');
    const campaignId = searchParams.get('campaignId')?.trim();
    const includeTraining = searchParams.get('training') === '1' || source === TRAINING_SOURCE;
    const take = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const skip = Math.max(
      parseInt(searchParams.get('skip') || searchParams.get('offset') || '0', 10) || 0,
      0
    );

    const qFilter = q
      ? {
          OR: [
            { companyName: { contains: q } },
            { city: { contains: q } },
            { industry: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

    const where = {
      brandId: brand.id,
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status } : {}),
      ...(includeTraining
        ? { source: TRAINING_SOURCE }
        : source
          ? { source }
          : { NOT: { source: TRAINING_SOURCE } }),
      ...qFilter,
    };

    const [total, prospects] = await Promise.all([
      prisma.prospect.count({ where }),
      prisma.prospect.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        select: PROSPECT_LIST_SELECT,
      }),
    ]);

    return NextResponse.json({
      prospects,
      brand: { id: brand.id, slug: brand.slug, name: brand.name },
      purpose: includeTraining ? 'training' : 'campaign',
      hasMore: skip + prospects.length < total,
      total,
      skip,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
