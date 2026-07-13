import type { NotificationEventKey } from './types';

export type CatalogEntry = {
  eventKey: NotificationEventKey;
  context: 'platform' | 'brand';
  audience: 'sdr' | 'brand' | 'both';
  mirrorInApp: boolean;
  description: string;
};

export const NOTIFICATION_CATALOG: Record<NotificationEventKey, CatalogEntry> = {
  'campaign.application.submitted': {
    eventKey: 'campaign.application.submitted',
    context: 'brand',
    audience: 'brand',
    mirrorInApp: true,
    description: 'SDR applied to a brand campaign',
  },
  'campaign.application.accepted': {
    eventKey: 'campaign.application.accepted',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Brand accepted / activated an SDR on a campaign',
  },
  'campaign.application.rejected': {
    eventKey: 'campaign.application.rejected',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Brand rejected an SDR application',
  },
  'campaign.apply.blocked': {
    eventKey: 'campaign.apply.blocked',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'SDR hit practice/score/cert gate on apply',
  },
  'campaign.opened': {
    eventKey: 'campaign.opened',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'Campaign activated for dialing',
  },
  'campaign.paused': {
    eventKey: 'campaign.paused',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'Campaign paused — new dials stopped',
  },
  'campaign.ended': {
    eventKey: 'campaign.ended',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'Campaign schedule ended or closed',
  },
  'campaign.budget.low': {
    eventKey: 'campaign.budget.low',
    context: 'brand',
    audience: 'brand',
    mirrorInApp: true,
    description: 'Campaign spend nearing cap',
  },
  'campaign.budget.exhausted': {
    eventKey: 'campaign.budget.exhausted',
    context: 'brand',
    audience: 'brand',
    mirrorInApp: true,
    description: 'Campaign spend cap reached',
  },
  'campaign.dial.blocked': {
    eventKey: 'campaign.dial.blocked',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'SDR attempted dial while campaign ineligible',
  },
  'campaign.callback.locked': {
    eventKey: 'campaign.callback.locked',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'Lead callback lock held by another rep',
  },
  'brand.phone_pool.empty': {
    eventKey: 'brand.phone_pool.empty',
    context: 'brand',
    audience: 'brand',
    mirrorInApp: true,
    description: 'Cannot open campaign — no brand DIDs',
  },
  'brand.escrow.insufficient': {
    eventKey: 'brand.escrow.insufficient',
    context: 'platform',
    audience: 'brand',
    mirrorInApp: true,
    description: 'Cannot open campaign — wallet short',
  },
  'appointment.booked': {
    eventKey: 'appointment.booked',
    context: 'brand',
    audience: 'both',
    mirrorInApp: true,
    description: 'Meeting booked on a campaign',
  },
  'appointment.verified': {
    eventKey: 'appointment.verified',
    context: 'brand',
    audience: 'both',
    mirrorInApp: true,
    description: 'Appointment verified — payout path',
  },
  'appointment.failed_audit': {
    eventKey: 'appointment.failed_audit',
    context: 'brand',
    audience: 'both',
    mirrorInApp: true,
    description: 'Appointment failed AI audit',
  },
  'lead.assigned': {
    eventKey: 'lead.assigned',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'Lead assigned to campaign for dialing',
  },
  'payout.ready': {
    eventKey: 'payout.ready',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Brand started a payout checkout',
  },
  'payout.paid': {
    eventKey: 'payout.paid',
    context: 'brand',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Payout completed to SDR',
  },
  'payout.failed': {
    eventKey: 'payout.failed',
    context: 'platform',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Payout failed or checkout expired',
  },
  'wallet.funded': {
    eventKey: 'wallet.funded',
    context: 'platform',
    audience: 'brand',
    mirrorInApp: true,
    description: 'Brand wallet funded',
  },
  'escrow.locked': {
    eventKey: 'escrow.locked',
    context: 'platform',
    audience: 'brand',
    mirrorInApp: false,
    description: 'Escrow locked for campaign open',
  },
  'welcome.sdr': {
    eventKey: 'welcome.sdr',
    context: 'platform',
    audience: 'sdr',
    mirrorInApp: false,
    description: 'SDR onboarding welcome',
  },
  'welcome.brand': {
    eventKey: 'welcome.brand',
    context: 'platform',
    audience: 'brand',
    mirrorInApp: false,
    description: 'Brand onboarding welcome',
  },
  'connect.required': {
    eventKey: 'connect.required',
    context: 'platform',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Stripe Connect needed for payouts',
  },
  'connect.ready': {
    eventKey: 'connect.ready',
    context: 'platform',
    audience: 'sdr',
    mirrorInApp: true,
    description: 'Stripe Connect payouts enabled',
  },
};
