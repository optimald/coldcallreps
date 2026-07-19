/**
 * Preflight checklist before opening an AI-created (or any) draft campaign.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { brandHref } from '@/lib/brand-context';

export type PreflightItem = {
  code: string;
  ok: boolean;
  message: string;
  href?: string;
};

export type LaunchPreflight = {
  ready: boolean;
  items: PreflightItem[];
  brand: { id: string; name: string; slug: string };
  campaign: {
    id: string;
    title: string;
    status: string;
    targetVertical: string | null;
    targetLocation: string | null;
  };
};

export async function getLaunchPreflight(
  brandId: string,
  campaignId: string
): Promise<LaunchPreflight | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          twilioPhoneE164: true,
        },
      },
      playbook: { select: { id: true, title: true } },
    },
  });
  if (!campaign) return null;

  const brandRef = { id: campaign.brand.id, slug: campaign.brand.slug };
  const brandPath = (...segments: string[]) => brandHref(brandRef, ...segments);

  const items: PreflightItem[] = [];

  items.push({
    code: 'PLAYBOOK',
    ok: Boolean(campaign.playbookId && campaign.playbook),
    message: campaign.playbook
      ? `Playbook attached: ${campaign.playbook.title}`
      : 'Attach a playbook before activating.',
    href: brandPath('playbooks'),
  });

  const wantsMeeting =
    campaign.goalType === 'BOOKED_MEETING' || campaign.goalType === 'BOTH';
  if (wantsMeeting) {
    items.push({
      code: 'BOOKING_LINK',
      ok: Boolean(campaign.bookingLink?.trim()),
      message: campaign.bookingLink?.trim()
        ? 'Booking link set'
        : 'Add a Cal.com / Calendly / Google Appointment link.',
      href: brandPath('campaigns', campaign.id),
    });
    items.push({
      code: 'MEETING_DURATION',
      ok: Boolean(campaign.meetingDurationMinutes && campaign.meetingDurationMinutes > 0),
      message: campaign.meetingDurationMinutes
        ? `Meeting length: ${campaign.meetingDurationMinutes} min`
        : 'Set meeting duration minutes.',
      href: brandPath('campaigns', campaign.id),
    });
  }

  const poolCount = await prisma.brandPhoneNumber.count({
    where: { brandId, isActive: true },
  });
  const hasPhone = poolCount > 0 || Boolean(campaign.brand.twilioPhoneE164?.trim());
  items.push({
    code: 'PHONE_POOL',
    ok: hasPhone,
    message: hasPhone
      ? `Caller ID ready (${poolCount || 1} number${poolCount === 1 ? '' : 's'})`
      : 'Add local numbers to the brand phone pool before opening.',
    href: brandPath('settings'),
  });

  const meeting = campaign.payoutCents ?? 0;
  const qualified = campaign.qualifiedPayoutCents ?? 0;
  const minPayout = Math.max(meeting, qualified || 0, 0);
  const wallet = await getOrCreateBrandWallet(brandId);
  const available = wallet.balanceCents + (campaign.escrowLockedCents || 0);
  items.push({
    code: 'WALLET',
    ok: minPayout <= 0 || available >= minPayout,
    message:
      minPayout <= 0
        ? 'No payout minimum'
        : available >= minPayout
          ? `Wallet funded ($${(available / 100).toFixed(0)} available)`
          : `Wallet needs at least $${(minPayout / 100).toFixed(0)} (one highest goal payout).`,
    href: brandPath('settings'),
  });

  return {
    ready: items.every((i) => i.ok),
    items,
    brand: {
      id: campaign.brand.id,
      name: campaign.brand.name,
      slug: campaign.brand.slug,
    },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      targetVertical: campaign.targetVertical,
      targetLocation: campaign.targetLocation,
    },
  };
}
