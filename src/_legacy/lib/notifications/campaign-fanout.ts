import { prisma } from '@/lib/prisma';
import { notifyAsync } from './dispatch';
import type { BrandNotifyContext, NotificationEventKey, NotifyPayload } from './types';

/** Email all ACTIVE/ACCEPTED SDRs on a campaign (status / schedule changes). */
export async function notifyCampaignSdrs(opts: {
  campaignId: string;
  event: NotificationEventKey;
  brand: BrandNotifyContext;
  payload: NotifyPayload;
  fromUserId?: string | null;
}) {
  const apps = await prisma.campaignApplication.findMany({
    where: {
      campaignId: opts.campaignId,
      status: { in: ['ACTIVE', 'ACCEPTED'] },
    },
    select: {
      id: true,
      user: { select: { id: true, email: true, displayName: true } },
    },
    take: 200,
  });

  for (const app of apps) {
    notifyAsync({
      event: opts.event,
      recipient: {
        userId: app.user.id,
        email: app.user.email,
        displayName: app.user.displayName,
      },
      brand: opts.brand,
      fromUserId: opts.fromUserId,
      payload: {
        ...opts.payload,
        applicationId: app.id,
      },
      idempotencyKey: `${opts.event}:${opts.campaignId}:${app.user.id}`,
    });
  }
}
