/** Notification event keys and shared context types. */

export const NOTIFICATION_EVENTS = [
  // Application funnel
  'campaign.application.submitted',
  'campaign.application.accepted',
  'campaign.application.rejected',
  'campaign.apply.blocked',
  // Campaign lifecycle
  'campaign.opened',
  'campaign.paused',
  'campaign.ended',
  'campaign.budget.low',
  'campaign.budget.exhausted',
  'campaign.dial.blocked',
  'campaign.callback.locked',
  // Brand ops readiness
  'brand.phone_pool.empty',
  'brand.escrow.insufficient',
  // Sales outcomes
  'appointment.booked',
  'appointment.verified',
  'appointment.failed_audit',
  'lead.assigned',
  // Money
  'payout.ready',
  'payout.paid',
  'payout.failed',
  'wallet.funded',
  'escrow.locked',
  // Platform account
  'welcome.sdr',
  'welcome.brand',
  'connect.required',
  'connect.ready',
  // Talent / recruit
  'talent.interested',
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationContextKind = 'platform' | 'brand';

export type NotifyRecipient = {
  userId?: string;
  email?: string | null;
  displayName?: string | null;
};

export type BrandNotifyContext = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  replyToEmail?: string | null;
};

export type NotifyPayload = {
  /** Primary CTA URL (absolute or path). */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Freeform brand/custom message paragraph. */
  customMessage?: string;
  campaignTitle?: string;
  campaignId?: string;
  applicationId?: string;
  amountLabel?: string;
  prospectName?: string;
  companyName?: string;
  meetingAtLabel?: string;
  reason?: string;
  sdrName?: string;
  practiceHref?: string;
  gateCode?: string;
  forAudience?: 'sdr' | 'brand';
  /** Override or supplement auto recommendations. */
  recommendations?: Recommendation[];
  [key: string]: unknown;
};

export type Recommendation = {
  title: string;
  detail?: string;
  href?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type TemplateRenderInput = {
  eventKey: NotificationEventKey;
  context: NotificationContextKind;
  recipient: NotifyRecipient;
  brand?: BrandNotifyContext | null;
  payload: NotifyPayload;
  appOrigin: string;
};
