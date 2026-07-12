import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  connectStatusFromAccount,
  createConnectAccount,
  createConnectOnboardingLink,
  getStripe,
} from '@/lib/stripe';

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

/** GET — Connect status for the signed-in user (SDRs receive campaign payouts). */
export async function GET() {
  try {
    const profile = await requireUser();

    // Refresh from Stripe when we have an account id
    if (profile.stripeConnectAccountId) {
      try {
        const stripe = getStripe();
        const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);
        const status = connectStatusFromAccount(account);
        if (
          status.detailsSubmitted !== profile.stripeConnectDetailsSubmitted ||
          status.payoutsEnabled !== profile.stripeConnectPayoutsEnabled
        ) {
          const updated = await prisma.userProfile.update({
            where: { id: profile.id },
            data: {
              stripeConnectDetailsSubmitted: status.detailsSubmitted,
              stripeConnectPayoutsEnabled: status.payoutsEnabled,
            },
          });
          return NextResponse.json({ connect: serializeConnect(updated) });
        }
      } catch (e) {
        console.warn('Connect account retrieve failed', e);
      }
    }

    return NextResponse.json({ connect: serializeConnect(profile) });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — start or resume Stripe Connect onboarding (Account Link).
 * Body: { action?: 'onboard' | 'dashboard', returnPath?: string, refreshPath?: string }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = body.action === 'dashboard' ? 'dashboard' : 'onboard';
    const returnPath =
      typeof body.returnPath === 'string' && body.returnPath.startsWith('/')
        ? body.returnPath
        : undefined;
    const refreshPath =
      typeof body.refreshPath === 'string' && body.refreshPath.startsWith('/')
        ? body.refreshPath
        : undefined;

    let accountId = profile.stripeConnectAccountId;

    if (!accountId) {
      const account = await createConnectAccount({
        email: profile.email,
        userId: profile.id,
      });
      accountId = account.id;
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          stripeConnectAccountId: accountId,
          stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
          stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
        },
      });
    }

    if (action === 'dashboard') {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.details_submitted) {
        const link = await createConnectOnboardingLink({
          accountId,
          returnPath,
          refreshPath,
        });
        return NextResponse.json({
          url: link.url,
          connect: serializeConnect({
            stripeConnectAccountId: accountId,
            stripeConnectDetailsSubmitted: false,
            stripeConnectPayoutsEnabled: false,
          }),
          notice: 'Finish onboarding before opening the payout dashboard.',
        });
      }
      const login = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({
        url: login.url,
        connect: serializeConnect({
          stripeConnectAccountId: accountId,
          stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
          stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
        }),
      });
    }

    const link = await createConnectOnboardingLink({
      accountId,
      returnPath,
      refreshPath,
    });
    return NextResponse.json({
      url: link.url,
      connect: serializeConnect({
        stripeConnectAccountId: accountId,
        stripeConnectDetailsSubmitted: profile.stripeConnectDetailsSubmitted,
        stripeConnectPayoutsEnabled: profile.stripeConnectPayoutsEnabled,
      }),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Connect onboard error:', error);
    return NextResponse.json({ error: error.message || 'Connect failed' }, { status: 500 });
  }
}
