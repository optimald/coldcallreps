import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canAccessBrandDesk } from '@/lib/roles';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';

/** GET payouts for a brand (account Payouts page). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const { brand, deskMode } = await requireDeskBrand(id);
    if (!canAccessBrandDesk(profile, brand, deskMode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [payouts, wallet] = await Promise.all([
      prisma.campaignPayout.findMany({
        where: { campaign: { brandId: brand.id } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          campaign: { select: { id: true, title: true } },
          application: {
            include: { user: { select: { id: true, displayName: true } } },
          },
        },
      }),
      getOrCreateBrandWallet(brand.id),
    ]);

    return NextResponse.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        status: p.status,
        grossCents: p.grossCents,
        campaignId: p.campaign.id,
        campaignTitle: p.campaign.title,
        sdrName: p.application?.user?.displayName || 'Rep',
        sdrId: p.application?.user?.id || p.application?.userId || null,
        createdAt: p.createdAt.toISOString(),
      })),
      brandId: brand.id,
      escrowLabel: `$${(wallet.balanceCents / 100).toFixed(2)}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
