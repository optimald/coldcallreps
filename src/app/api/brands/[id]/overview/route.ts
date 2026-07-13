import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

/** GET /api/brands/[id]/overview — desk KPI strip. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true, name: true, ownerId: true },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [openCampaigns, pendingApps, leads, callsToday, wallet] = await Promise.all([
      prisma.campaign.count({ where: { brandId: brand.id, status: 'OPEN' } }),
      prisma.campaignApplication.count({
        where: {
          campaign: { brandId: brand.id },
          status: 'APPLIED',
        },
      }),
      prisma.prospect.count({
        where: { brandId: brand.id, NOT: { source: 'training' } },
      }),
      prisma.callLog.count({
        where: { brandId: brand.id, createdAt: { gte: startOfDay } },
      }),
      getOrCreateBrandWallet(brand.id),
    ]);

    return NextResponse.json({
      brand: { id: brand.id, slug: brand.slug, name: brand.name },
      kpis: {
        openCampaigns,
        pendingApplications: pendingApps,
        leads,
        callsToday,
        escrowBalanceCents: wallet.balanceCents,
        escrowLabel: `$${(wallet.balanceCents / 100).toFixed(0)}`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
