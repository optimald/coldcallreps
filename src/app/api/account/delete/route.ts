import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

/** Soft-delete: cancel Stripe, wipe PII, deactivate hiring; keeps anonymized session aggregates. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return NextResponse.json(
        { error: 'Send { "confirm": "DELETE" } to proceed.' },
        { status: 400 }
      );
    }

    await writeAudit({
      actorId: profile.id,
      action: 'account.delete',
      targetType: 'UserProfile',
      targetId: profile.id,
    });

    // Cancel Stripe subscription before clearing local IDs
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && (profile.stripeSubscriptionId || profile.stripeCustomerId)) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
        if (profile.stripeSubscriptionId) {
          await stripe.subscriptions.cancel(profile.stripeSubscriptionId).catch(async (err) => {
            // Already canceled is fine
            if (err?.code !== 'resource_missing') {
              console.error('Stripe cancel subscription failed', err);
            }
          });
        }
      } catch (e) {
        console.error('Stripe cancel on account delete failed', e);
      }
    }

    await prisma.$transaction([
      prisma.repProfile.deleteMany({ where: { userId: profile.id } }),
      prisma.recruiterSeat.deleteMany({ where: { userId: profile.id } }),
      prisma.apiKey.deleteMany({ where: { userId: profile.id } }),
      prisma.webhookEndpoint.deleteMany({ where: { userId: profile.id } }),
      prisma.coachMemory.deleteMany({ where: { userId: profile.id } }),
      prisma.crmConnection.deleteMany({ where: { userId: profile.id } }),
      prisma.digestSubscription.deleteMany({ where: { userId: profile.id } }),
      prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          email: null,
          displayName: 'Deleted user',
          hiringBoardOptIn: false,
          hiringHeadline: null,
          hiringBio: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeConnectAccountId: null,
          stripeConnectDetailsSubmitted: false,
          stripeConnectPayoutsEnabled: false,
          minutesRemaining: 0,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      notice: 'Account data cleared. Sign out to finish.',
      signOut: true,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
