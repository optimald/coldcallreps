import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrandId } from '@/lib/roles';
import { getOrCreateBrandWallet, lockEscrowForCampaign } from '@/lib/escrow';
import { serializeCampaign } from '@/lib/campaigns';
import { loadOneCampaignSpend } from '@/lib/campaign-spend';
import { trackEvent } from '@/lib/posthog/analytics';

/**
 * POST /api/campaigns/[id]/escrow
 * Move prepaid wallet balance into this campaign's escrow (debit wallet, credit campaign lock).
 * Body: { amountCents }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
        pack: { select: { id: true, name: true } },
        playbook: { select: { id: true, title: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const amountCents = Math.max(0, Math.round(Number(body.amountCents) || 0));
    if (amountCents < 1000) {
      return NextResponse.json({ error: 'Minimum allocate is $10' }, { status: 400 });
    }

    const wallet = await getOrCreateBrandWallet(campaign.brandId);
    if (wallet.balanceCents < amountCents) {
      return NextResponse.json(
        {
          error: `Wallet has $${(wallet.balanceCents / 100).toFixed(0)} — fund the wallet or allocate less.`,
          code: 'WALLET_INSUFFICIENT',
          availableCents: wallet.balanceCents,
        },
        { status: 400 }
      );
    }

    await lockEscrowForCampaign({
      brandId: campaign.brandId,
      campaignId: id,
      amountCents,
    });

    const updated = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        pack: { select: { id: true, name: true } },
        playbook: { select: { id: true, title: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const floor = Math.max(updated.budgetCents || 0, updated.escrowLockedCents || 0);
    if (floor > (updated.budgetCents || 0)) {
      await prisma.campaign.update({
        where: { id },
        data: { budgetCents: floor },
      });
      updated.budgetCents = floor;
    }

    const spend = await loadOneCampaignSpend(id);
    trackEvent(profile.id, 'escrow_funded', {
      role: 'BRAND',
      campaignId: id,
      brandId: campaign.brandId,
      amountCents,
      source: 'escrow_allocate',
    });
    return NextResponse.json({
      campaign: serializeCampaign({ ...updated, ...spend }),
      notice: `Locked $${(amountCents / 100).toFixed(0)} to this campaign.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[campaign escrow]', error);
    return NextResponse.json(
      { error: message.includes('Insufficient') ? message : 'Internal server error' },
      { status: message.includes('Insufficient') ? 400 : 500 }
    );
  }
}
