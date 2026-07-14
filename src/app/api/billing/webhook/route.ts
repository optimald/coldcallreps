import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  PLAN,
  minutesForTier,
  priceIdForTier,
  brandLeadPlanFromPriceId,
  type PaidPlanKey,
} from '@/lib/product';
import { TRIAL_MINUTES } from '@/lib/product';
import { creditPersonalMinutes, topUpOrgPool } from '@/lib/minutes';
import { connectStatusFromAccount } from '@/lib/stripe';
import {
  applyBrandLeadSubscription,
  downgradeBrandLeadPlan,
  grantLeadPack,
} from '@/lib/lead-credits';

async function markCampaignPayoutPaid(session: Stripe.Checkout.Session) {
  const payoutId = session.metadata?.payoutId;
  if (!payoutId) {
    console.warn('campaign_payout checkout missing payoutId', session.id);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const existing = await prisma.campaignPayout.findUnique({ where: { id: payoutId } });
  if (!existing) {
    console.warn('campaign_payout row missing', payoutId);
    return;
  }
  if (existing.status === 'PAID') return;

  let transferId: string | null = existing.stripeTransferId;
  if (paymentIntentId && !transferId) {
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      if (key) {
        const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['transfer_data', 'latest_charge'],
        });
        const charge =
          typeof pi.latest_charge === 'string'
            ? await stripe.charges.retrieve(pi.latest_charge)
            : pi.latest_charge;
        if (charge && typeof charge.transfer === 'string') {
          transferId = charge.transfer;
        } else if (charge?.transfer && typeof charge.transfer === 'object') {
          transferId = charge.transfer.id;
        }
      }
    } catch (e) {
      console.warn('Could not resolve transfer id for payout', payoutId, e);
    }
  }

  await prisma.campaignPayout.update({
    where: { id: payoutId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      stripeTransferId: transferId,
      failureReason: null,
    },
  });

  await prisma.campaignApplication.updateMany({
    where: { id: existing.applicationId, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED' },
  });

  try {
    const { notifyAsync } = await import('@/lib/notifications');
    const { formatPayout } = await import('@/lib/campaigns');
    const full = await prisma.campaignPayout.findUnique({
      where: { id: payoutId },
      include: {
        campaign: {
          select: {
            title: true,
            brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        },
        repUser: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (full) {
      notifyAsync({
        event: 'payout.paid',
        recipient: {
          userId: full.repUser.id,
          email: full.repUser.email,
          displayName: full.repUser.displayName,
        },
        brand: full.campaign.brand,
        payload: {
          campaignTitle: full.campaign.title,
          campaignId: full.campaignId,
          amountLabel: formatPayout(full.netCents),
          ctaUrl: '/billing',
          forAudience: 'sdr',
        },
        idempotencyKey: `payout.paid:${full.id}`,
      });
    }
  } catch (e) {
    console.warn('[webhook] payout.paid notify failed', e);
  }
}

async function syncConnectAccount(account: Stripe.Account) {
  const userId = account.metadata?.userId;
  const status = connectStatusFromAccount(account);
  if (userId) {
    const before = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { stripeConnectPayoutsEnabled: true, email: true, displayName: true },
    });
    await prisma.userProfile.updateMany({
      where: { id: userId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectDetailsSubmitted: status.detailsSubmitted,
        stripeConnectPayoutsEnabled: status.payoutsEnabled,
      },
    });
    if (status.payoutsEnabled && !before?.stripeConnectPayoutsEnabled) {
      try {
        const { notifyAsync } = await import('@/lib/notifications');
        notifyAsync({
          event: 'connect.ready',
          recipient: {
            userId,
            email: before?.email,
            displayName: before?.displayName,
          },
          payload: { ctaUrl: '/billing', forAudience: 'sdr' },
          idempotencyKey: `connect.ready:${userId}:${account.id}`,
        });
      } catch (e) {
        console.warn('[webhook] connect.ready notify failed', e);
      }
    }
    return;
  }
  await prisma.userProfile.updateMany({
    where: { stripeConnectAccountId: account.id },
    data: {
      stripeConnectDetailsSubmitted: status.detailsSubmitted,
      stripeConnectPayoutsEnabled: status.payoutsEnabled,
    },
  });
}

function asPaidPlanKey(raw: string | undefined | null): PaidPlanKey {
  if (raw === 'PRO' || raw === 'RECRUITER' || raw === 'TEAM' || raw === 'STARTER') return raw;
  return 'STARTER';
}

function tierFromPriceId(priceId: string | undefined | null): PaidPlanKey | null {
  if (!priceId) return null;
  const map: [PaidPlanKey, string | undefined][] = [
    ['STARTER', priceIdForTier('STARTER')],
    ['PRO', priceIdForTier('PRO')],
    ['RECRUITER', priceIdForTier('RECRUITER')],
    ['TEAM', priceIdForTier('TEAM')],
  ];
  for (const [tier, id] of map) {
    if (id && id === priceId) return tier;
  }
  return null;
}

async function findProfileForCheckout(opts: {
  userId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
}) {
  if (opts.userId) {
    const byId = await prisma.userProfile.findUnique({ where: { id: opts.userId } });
    if (byId) return byId;
  }
  if (opts.customerId) {
    const byCustomer = await prisma.userProfile.findFirst({
      where: { stripeCustomerId: opts.customerId },
    });
    if (byCustomer) return byCustomer;
  }
  if (opts.customerEmail) {
    const byEmail = await prisma.userProfile.findFirst({
      where: { email: opts.customerEmail },
    });
    if (byEmail) return byEmail;
  }
  return null;
}

async function applySubscription(opts: {
  userId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  tier: PaidPlanKey;
  subscriptionId?: string | null;
}) {
  let profile = await findProfileForCheckout(opts);
  if (!profile) {
    console.warn('applySubscription: profile not found', {
      userId: opts.userId,
      customerId: opts.customerId,
      email: opts.customerEmail,
    });
    return { ok: false as const, reason: 'profile_missing' };
  }

  const data: Record<string, unknown> = {
    plan: opts.tier,
    stripeSubscriptionId: opts.subscriptionId || profile.stripeSubscriptionId,
    lastPaymentFailedAt: null,
  };
  if (opts.customerId && !profile.stripeCustomerId) {
    data.stripeCustomerId = opts.customerId;
  }

  const mins = minutesForTier(opts.tier);
  if (mins > 0 && opts.tier !== 'TEAM') {
    data.minutesRemaining = mins;
  }

  if (opts.tier === 'RECRUITER') {
    data.platformRole = profile.platformRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'RECRUITER';
    await prisma.recruiterSeat.upsert({
      where: { userId: profile.id },
      create: {
        userId: profile.id,
        active: true,
        paid: true,
        creditsRemaining: PLAN.RECRUITER.credits,
      },
      update: {
        active: true,
        paid: true,
        creditsRemaining: PLAN.RECRUITER.credits,
      },
    });
  }

  if (opts.tier === 'TEAM') {
    data.platformRole = profile.platformRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'MANAGER';
    if (profile.orgId) {
      await topUpOrgPool(profile.orgId, PLAN.TEAM.minutes);
    }
  }

  if (opts.tier === 'STARTER' || opts.tier === 'PRO') {
    if (profile.plan === 'RECRUITER' || profile.plan === 'TEAM') {
      if (profile.platformRole === 'RECRUITER' || profile.platformRole === 'MANAGER') {
        data.platformRole = 'REP';
      }
    }
  }

  await prisma.userProfile.update({ where: { id: profile.id }, data: data as any });
  return { ok: true as const, profileId: profile.id };
}

async function downgradeToFree(customerId: string) {
  const profile = await prisma.userProfile.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!profile) return;

  const roleReset =
    profile.platformRole === 'SUPERADMIN'
      ? 'SUPERADMIN'
      : profile.platformRole === 'BRAND'
        ? 'BRAND'
        : 'REP';

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      platformRole: roleReset,
      minutesRemaining: Math.min(profile.minutesRemaining, TRIAL_MINUTES),
      lastPaymentFailedAt: null,
    },
  });
  await prisma.recruiterSeat.updateMany({
    where: { userId: profile.id },
    data: { paid: false, active: false, creditsRemaining: 0 },
  });
  await prisma.apiKey.updateMany({
    where: { userId: profile.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: skip already-processed Stripe events
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.email ||
      null;

    if (session.mode === 'payment' && session.metadata?.kind === 'minute_pack') {
      const packMinutes = parseInt(session.metadata.minutes || '0', 10) || 0;
      const profile = await findProfileForCheckout({
        userId,
        customerId:
          typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        customerEmail,
      });
      if (profile && packMinutes > 0) {
        if (profile.orgId && session.metadata.target === 'org_pool') {
          const pool = await prisma.orgMinutePool.findUnique({ where: { orgId: profile.orgId } });
          if (pool) {
            await prisma.orgMinutePool.update({
              where: { orgId: profile.orgId },
              data: { minutesRemaining: { increment: packMinutes } },
            });
          } else {
            await topUpOrgPool(profile.orgId, packMinutes);
          }
        } else {
          await creditPersonalMinutes(profile.id, packMinutes);
        }
      } else if (!profile) {
        console.warn('minute_pack checkout: profile missing', { userId, customerEmail });
      }
    } else if (
      session.mode === 'payment' &&
      (session.metadata?.type === 'brand_wallet_fund' || session.metadata?.kind === 'brand_wallet_fund')
    ) {
      const brandId = session.metadata.brandId;
      const amountCents = parseInt(session.metadata.amountCents || '0', 10) || 0;
      const campaignId = String(session.metadata.campaignId || '').trim() || undefined;
      if (brandId && amountCents > 0) {
        const { creditWallet, lockEscrowForCampaign } = await import('@/lib/escrow');
        await creditWallet({
          brandId,
          amountCents,
          type: 'FUND',
          stripeSessionId: session.id,
          campaignId,
          note: campaignId ? 'Stripe campaign fund' : 'Stripe wallet fund',
        });
        if (campaignId) {
          try {
            await lockEscrowForCampaign({ brandId, campaignId, amountCents });
            const camp = await prisma.campaign.findUnique({
              where: { id: campaignId },
              select: { budgetCents: true, escrowLockedCents: true },
            });
            if (camp) {
              const floor = Math.max(camp.budgetCents || 0, camp.escrowLockedCents || 0);
              if (floor > (camp.budgetCents || 0)) {
                await prisma.campaign.update({
                  where: { id: campaignId },
                  data: { budgetCents: floor },
                });
              }
            }
          } catch (e) {
            console.warn('[webhook] campaign escrow lock after fund failed', e);
          }
        }
        try {
          const { notifyAsync } = await import('@/lib/notifications');
          const { formatPayout } = await import('@/lib/campaigns');
          const brand = await prisma.brand.findUnique({
            where: { id: brandId },
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              ownerId: true,
            },
          });
          if (brand?.ownerId) {
            notifyAsync({
              event: 'wallet.funded',
              recipient: { userId: brand.ownerId },
              brand,
              payload: {
                amountLabel: formatPayout(amountCents),
                ctaUrl: campaignId
                  ? `/brands/${brand.slug}/campaigns/${campaignId}`
                  : `/brands/${brand.slug}/campaigns`,
                forAudience: 'brand',
              },
              idempotencyKey: `wallet.funded:${session.id}`,
            });
          }
        } catch (e) {
          console.warn('[webhook] wallet.funded notify failed', e);
        }
      }
    } else if (session.mode === 'payment' && session.metadata?.kind === 'campaign_payout') {
      await markCampaignPayoutPaid(session);
    } else if (session.mode === 'payment' && session.metadata?.kind === 'lead_pack') {
      const brandId = session.metadata.brandId;
      const credits = parseInt(session.metadata.credits || '0', 10) || 0;
      if (brandId && credits > 0) {
        await grantLeadPack(brandId, credits, {
          stripeSessionId: session.id,
          note: `Purchased ${session.metadata.pack || 'lead pack'}`,
        });
      }
    } else if (
      session.mode === 'subscription' &&
      session.metadata?.kind === 'brand_lead_plan'
    ) {
      const brandId = session.metadata.brandId;
      const leadPlan =
        session.metadata.leadPlan === 'LEAD_ANNUAL' ? 'LEAD_ANNUAL' : 'LEAD_MONTHLY';
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null;
      if (brandId) {
        let periodEnd: Date | null = null;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            periodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null;
          } catch {
            /* ignore */
          }
        }
        await applyBrandLeadSubscription({
          brandId,
          plan: leadPlan,
          subscriptionId,
          periodEnd,
        });
      }
    } else if (session.mode === 'subscription' || session.metadata?.tier) {
      // Skip if this was a brand lead plan (handled above)
      if (session.metadata?.kind === 'brand_lead_plan') {
        /* already handled */
      } else {
        const tier = asPaidPlanKey(session.metadata?.tier);
        await applySubscription({
          userId,
          customerId:
            typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          customerEmail,
          tier,
          subscriptionId:
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id || null,
        });
      }
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    await syncConnectAccount(account);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind === 'campaign_payout' && session.metadata.payoutId) {
      await prisma.campaignPayout.updateMany({
        where: {
          id: session.metadata.payoutId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELED',
          failureReason: 'Checkout expired',
        },
      });
      try {
        const { notifyAsync } = await import('@/lib/notifications');
        const payout = await prisma.campaignPayout.findUnique({
          where: { id: session.metadata.payoutId },
          include: {
            campaign: {
              select: {
                title: true,
                brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
              },
            },
            repUser: { select: { id: true, email: true, displayName: true } },
          },
        });
        if (payout) {
          notifyAsync({
            event: 'payout.failed',
            recipient: {
              userId: payout.repUser.id,
              email: payout.repUser.email,
              displayName: payout.repUser.displayName,
            },
            brand: payout.campaign.brand,
            payload: {
              campaignTitle: payout.campaign.title,
              campaignId: payout.campaignId,
              reason: 'Checkout expired before payment completed',
              ctaUrl: '/billing',
              forAudience: 'sdr',
            },
            idempotencyKey: `payout.failed:${payout.id}:expired`,
          });
        }
      } catch (e) {
        console.warn('[webhook] payout.failed notify failed', e);
      }
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const priceId = invoice.lines?.data?.[0]?.price?.id;
    const leadPlanFromPrice = brandLeadPlanFromPriceId(priceId);
    const brandIdFromMeta =
      invoice.lines?.data?.[0]?.metadata?.brandId ||
      (invoice.subscription_details as { metadata?: { brandId?: string } } | null)?.metadata
        ?.brandId;

    if (leadPlanFromPrice && customerId) {
      // Renew brand lead allotment on paid invoice
      let brandId = brandIdFromMeta || null;
      if (!brandId) {
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null;
        if (subId) {
          const hit = await prisma.brand.findFirst({
            where: { stripeLeadSubscriptionId: subId },
            select: { id: true },
          });
          brandId = hit?.id || null;
        }
      }
      if (brandId) {
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null;
        let periodEnd: Date | null = null;
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            periodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null;
          } catch {
            /* ignore */
          }
        }
        await applyBrandLeadSubscription({
          brandId,
          plan: leadPlanFromPrice,
          subscriptionId: subId,
          periodEnd,
        });
      }
    } else if (customerId) {
      const profile = await findProfileForCheckout({
        customerId,
        customerEmail: invoice.customer_email || null,
      });
      if (profile) {
        const fromPrice = tierFromPriceId(priceId);
        const tier = fromPrice || asPaidPlanKey(profile.plan);
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || profile.stripeSubscriptionId;
        await applySubscription({
          userId: profile.id,
          customerId,
          tier,
          subscriptionId: subId,
        });
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const leadPlan = brandLeadPlanFromPriceId(priceId) ||
      (sub.metadata?.kind === 'brand_lead_plan'
        ? sub.metadata.leadPlan === 'LEAD_ANNUAL'
          ? 'LEAD_ANNUAL'
          : 'LEAD_MONTHLY'
        : null);
    const brandId = sub.metadata?.brandId;

    if (leadPlan && brandId && sub.status === 'active') {
      await applyBrandLeadSubscription({
        brandId,
        plan: leadPlan,
        subscriptionId: sub.id,
        periodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null,
      });
    } else if (customerId && sub.status === 'active' && !leadPlan) {
      const tier = tierFromPriceId(priceId) || asPaidPlanKey(sub.metadata?.tier);
      await applySubscription({
        customerId,
        tier,
        subscriptionId: sub.id,
      });
    }
    if (customerId && (sub.status === 'unpaid' || sub.status === 'canceled')) {
      if (brandId || sub.metadata?.kind === 'brand_lead_plan') {
        const id =
          brandId ||
          (
            await prisma.brand.findFirst({
              where: { stripeLeadSubscriptionId: sub.id },
              select: { id: true },
            })
          )?.id;
        if (id) await downgradeBrandLeadPlan(id);
      } else {
        await downgradeToFree(customerId);
      }
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      await prisma.userProfile.updateMany({
        where: { stripeCustomerId: customerId },
        data: { lastPaymentFailedAt: new Date() },
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const brandId = sub.metadata?.brandId;
    if (brandId || sub.metadata?.kind === 'brand_lead_plan') {
      const id =
        brandId ||
        (
          await prisma.brand.findFirst({
            where: { stripeLeadSubscriptionId: sub.id },
            select: { id: true },
          })
        )?.id;
      if (id) await downgradeBrandLeadPlan(id);
    } else if (customerId) {
      await downgradeToFree(customerId);
    }
  }

  // Chargebacks / disputes — surface in admin health & refunds
  if (
    event.type === 'charge.dispute.created' ||
    event.type === 'charge.dispute.updated' ||
    event.type === 'charge.dispute.closed'
  ) {
    const dispute = event.data.object as Stripe.Dispute;
    const evidenceDue =
      dispute.evidence_details?.due_by != null
        ? new Date(dispute.evidence_details.due_by * 1000)
        : null;
    await prisma.stripeDisputeRecord.upsert({
      where: { stripeDisputeId: dispute.id },
      create: {
        stripeDisputeId: dispute.id,
        chargeId: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id,
        paymentIntentId:
          typeof dispute.payment_intent === 'string'
            ? dispute.payment_intent
            : dispute.payment_intent?.id || null,
        amountCents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: evidenceDue,
        rawJSON: JSON.stringify(dispute).slice(0, 8000),
      },
      update: {
        status: dispute.status,
        reason: dispute.reason,
        evidenceDueBy: evidenceDue,
        rawJSON: JSON.stringify(dispute).slice(0, 8000),
      },
    });
  }

  return NextResponse.json({ received: true });
}
