import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { payBaseForCampaign, periodKeyFor } from '@/lib/base-payout';
import { isBasePayCadence } from '@/lib/platform-fees';

/**
 * POST — brand pays base for the current (or specified) period for ACTIVE SDRs.
 * Body: { periodKey? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { ownerId: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!campaign.basePayCents || !campaign.basePayCadence) {
      return NextResponse.json(
        { error: 'Campaign has no base pay configured', code: 'NO_BASE' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cadence = isBasePayCadence(campaign.basePayCadence)
      ? campaign.basePayCadence
      : 'MONTHLY';
    const periodKey =
      typeof body.periodKey === 'string' && body.periodKey.trim()
        ? String(body.periodKey).trim()
        : periodKeyFor(cadence);

    const result = await payBaseForCampaign(id, periodKey);
    if (!result.ok && result.error) {
      return NextResponse.json(
        { error: result.error, periodKey: result.periodKey, results: result.results },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[campaigns/base-pay]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
