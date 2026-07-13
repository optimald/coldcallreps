import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPayout, serializePayout } from '@/lib/campaigns';
import { effectiveRole } from '@/lib/roles';
import { connectStatusFromAccount, getStripe } from '@/lib/stripe';

function serializeConnect(profile: {
  stripeConnectAccountId: string | null;
  stripeConnectDetailsSubmitted: boolean;
  stripeConnectPayoutsEnabled: boolean;
}) {
  const hasAccount = Boolean(profile.stripeConnectAccountId);
  const ready = Boolean(
    profile.stripeConnectAccountId && profile.stripeConnectPayoutsEnabled
  );
  return {
    hasAccount,
    accountId: profile.stripeConnectAccountId,
    detailsSubmitted: profile.stripeConnectDetailsSubmitted,
    payoutsEnabled: profile.stripeConnectPayoutsEnabled,
    ready,
    statusLabel: !hasAccount
      ? 'Not connected'
      : ready
        ? 'Ready for payouts'
        : profile.stripeConnectDetailsSubmitted
          ? 'Under review'
          : 'Onboarding incomplete',
  };
}

/**
 * GET — SDR/Manager earnings: Connect status + CampaignPayout ledger + summary chips.
 * Brand / Recruiter roles are hidden from this surface.
 */
export async function GET() {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);

    if (role === 'BRAND' || role === 'RECRUITER') {
      return NextResponse.json(
        { error: 'Earnings is for SDRs. Brands pay from Campaigns.' },
        { status: 403 }
      );
    }

    let connectProfile = profile;
    if (profile.stripeConnectAccountId) {
      try {
        const stripe = getStripe();
        const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);
        const status = connectStatusFromAccount(account);
        if (
          status.detailsSubmitted !== profile.stripeConnectDetailsSubmitted ||
          status.payoutsEnabled !== profile.stripeConnectPayoutsEnabled
        ) {
          connectProfile = await prisma.userProfile.update({
            where: { id: profile.id },
            data: {
              stripeConnectDetailsSubmitted: status.detailsSubmitted,
              stripeConnectPayoutsEnabled: status.payoutsEnabled,
            },
          });
        }
      } catch (e) {
        console.warn('Earnings Connect refresh failed', e);
      }
    }

    const connect = serializeConnect(connectProfile);

    let availableCents: number | null = null;
    if (connectProfile.stripeConnectAccountId && connect.ready) {
      try {
        const stripe = getStripe();
        const balance = await stripe.balance.retrieve({
          stripeAccount: connectProfile.stripeConnectAccountId,
        });
        availableCents = balance.available
          .filter((b) => b.currency === 'usd')
          .reduce((sum, b) => sum + b.amount, 0);
      } catch (e) {
        console.warn('Earnings Stripe balance failed', e);
      }
    }

    // Guard stale Prisma clients (pre-CampaignPayout generate) so /earnings still loads.
    const payoutDelegate = (prisma as any).campaignPayout as
      | typeof prisma.campaignPayout
      | undefined;
    const payouts = payoutDelegate
      ? await payoutDelegate.findMany({
          where: { repUserId: profile.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            campaign: {
              select: {
                id: true,
                title: true,
                brand: { select: { name: true, slug: true } },
              },
            },
          },
        })
      : [];

    let pendingCents = 0;
    let lifetimePaidCents = 0;
    for (const p of payouts) {
      if (p.status === 'PENDING') pendingCents += p.netCents;
      else if (p.status === 'PAID') lifetimePaidCents += p.netCents;
    }

    return NextResponse.json({
      connect,
      summary: {
        availableCents,
        availableLabel:
          availableCents != null ? formatPayout(availableCents) : connect.ready ? '—' : null,
        pendingCents,
        pendingLabel: formatPayout(pendingCents),
        lifetimePaidCents,
        lifetimePaidLabel: formatPayout(lifetimePaidCents),
      },
      payouts: payouts.map((p) => ({
        ...serializePayout(p),
        createdAt: p.createdAt,
        campaign: {
          id: p.campaign.id,
          title: p.campaign.title,
          brandName: p.campaign.brand?.name || 'Brand',
          brandSlug: p.campaign.brand?.slug || null,
        },
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
