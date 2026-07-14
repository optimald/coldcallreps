import type {
  BrandNotifyContext,
  NotificationEventKey,
  NotifyPayload,
  Recommendation,
} from './types';

type RecCtx = {
  eventKey: NotificationEventKey;
  audience: 'sdr' | 'brand';
  brand?: BrandNotifyContext | null;
  payload: NotifyPayload;
};

/**
 * Contextual next-step recommendations for brand vs SDR.
 * Merged into every email as a “Recommended next steps” checklist.
 */
export function buildRecommendations(ctx: RecCtx): Recommendation[] {
  const brand = ctx.brand?.name || 'the brand';
  const slug = ctx.brand?.slug || '';
  const campaign = ctx.payload.campaignTitle || 'the campaign';
  const practice = ctx.payload.practiceHref || '/practice';
  const brandHome = slug ? `/brands/${slug}` : '/dashboard';
  const apps = slug ? `/recruit?brand=${encodeURIComponent(slug)}` : '/recruit';
  const campaigns = slug ? `/brands/${slug}/campaigns` : '/dashboard';
  const calls = slug ? `/brands/${slug}/calls` : '/dashboard';
  const phones = slug ? `/brands/${slug}/settings` : '/billing';

  const fromPayload = Array.isArray(ctx.payload.recommendations)
    ? ctx.payload.recommendations
    : [];

  let auto: Recommendation[] = [];

  switch (ctx.eventKey) {
    case 'campaign.application.submitted':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Open the resume drawer',
            detail: 'Hear featured practice calls before you decide.',
            href: apps,
          },
          {
            title: 'Accept with a clear first brief',
            detail: 'Tell them ICP, booking link, and dial hours in the accept message.',
            href: apps,
          },
          {
            title: 'Confirm leads are dial-ready',
            detail: 'Pipeline should have outreach-ready numbers before volume ramps.',
            href: slug ? `/brands/${slug}/pipeline` : '/dashboard',
          },
        ];
      }
      break;

    case 'campaign.application.accepted':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Finish any practice gate',
            detail: 'Hit the brand min score / cert if you have not already.',
            href: practice,
          },
          {
            title: 'Open the dialer',
            detail: `Start new dials on “${campaign}” with brand caller ID.`,
            href: '/cold_calls',
          },
          {
            title: 'Connect Stripe (if unpaid yet)',
            detail: 'Payouts need Connect before cash hits your bank.',
            href: '/billing',
          },
        ];
      }
      break;

    case 'campaign.application.rejected':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Practice the brand pack',
            detail: 'Raise score and add a stronger featured call to your resume.',
            href: practice,
          },
          {
            title: 'Browse other Brand deals',
            detail: 'New OPEN campaigns appear on Brand deals daily.',
            href: '/gigs',
          },
        ];
      }
      break;

    case 'campaign.apply.blocked':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Complete required practice',
            detail: ctx.payload.reason || 'Hit the campaign practice / score / cert gate.',
            href: practice,
          },
          {
            title: 'Add a featured call to your resume',
            detail: 'Brands listen to these before accepting.',
            href: '/resume',
          },
          {
            title: 'Re-apply when the gate clears',
            detail: `Return to “${campaign}” on Brand deals.`,
            href: '/gigs',
          },
        ];
      }
      break;

    case 'campaign.opened':
      if (ctx.audience === 'sdr') {
        auto = [
          { title: 'Pull dial-ready leads', detail: 'Use the brand dialer queue.', href: '/cold_calls' },
          {
            title: 'Keep booking attribution on',
            detail: 'Use the in-call book flow so meetings credit you.',
            href: '/cold_calls',
          },
        ];
      }
      break;

    case 'campaign.paused':
    case 'campaign.ended':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Finish only in-flight calls',
            detail: 'New dials are blocked; live legs are not hung up.',
          },
          { title: 'Find another open deal', href: '/gigs' },
        ];
      }
      break;

    case 'campaign.budget.low':
    case 'campaign.budget.exhausted':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Fund the wallet',
            detail: 'Escrow must cover verified awards.',
            href: '/billing',
          },
          {
            title: 'Raise overall or daily spend cap',
            detail: `Edit budget on “${campaign}”.`,
            href: campaigns,
          },
          {
            title: 'Pause if you need to stop new dials',
            detail: 'Activate off — live calls keep going.',
            href: campaigns,
          },
        ];
      }
      break;

    case 'campaign.dial.blocked':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Check campaign status',
            detail: ctx.payload.reason || 'Paused, ended, or out of budget.',
            href: '/gigs',
          },
          {
            title: 'Work another eligible campaign',
            href: '/cold_calls',
          },
        ];
      }
      break;

    case 'campaign.callback.locked':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Pick a different lead',
            detail: 'This number is locked to another rep for the callback window.',
            href: '/cold_calls',
          },
        ];
      }
      break;

    case 'brand.phone_pool.empty':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Add local numbers to the phone pool',
            detail: 'SDRs dial with brand caller ID — not personal phones.',
            href: phones,
          },
          {
            title: 'Retry Activate once DIDs are live',
            href: campaigns,
          },
        ];
      }
      break;

    case 'brand.escrow.insufficient':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Fund the brand wallet',
            detail: ctx.payload.amountLabel
              ? `Need about ${ctx.payload.amountLabel} locked for open.`
              : 'Prepaid escrow is required to open.',
            href: '/billing',
          },
          { title: 'Open the campaign after funding', href: campaigns },
        ];
      }
      break;

    case 'appointment.booked':
      if (ctx.audience === 'brand') {
        auto = [
          { title: 'Confirm the meeting on Live calls', href: calls },
          {
            title: 'Prep for verification',
            detail: 'Verified meetings release escrow to the SDR.',
          },
        ];
      } else {
        auto = [
          {
            title: 'Confirm notes / transcript quality',
            detail: 'Clean attribution helps the claim pass audit.',
          },
          { title: 'Watch for verification + payout', href: '/billing' },
        ];
      }
      break;

    case 'appointment.verified':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Review payout — dispute if wrong',
            href: slug ? `/brands/${slug}/sdrs/payouts` : '/billing',
            detail: 'AI released escrow. File a dispute if the meeting was not valid.',
          },
          { title: 'Keep dialing while budget remains', href: calls },
        ];
      } else {
        auto = [
          { title: 'Confirm Connect is ready', href: '/billing' },
          { title: 'Keep booking quality meetings', href: '/cold_calls' },
        ];
      }
      break;

    case 'appointment.failed_audit':
      if (ctx.audience === 'brand') {
        auto = [
          {
            title: 'Review the rejected claim',
            detail: ctx.payload.reason || 'AI rejected the claim — SDR may dispute.',
            href: calls,
          },
        ];
      } else {
        auto = [
          {
            title: 'Dispute the AI rejection',
            detail: ctx.payload.reason || 'If the meeting was real, dispute from Goals with more context.',
            href: '/goals',
          },
          { title: 'Practice objection handling', href: practice },
        ];
      }
      break;

    case 'lead.assigned':
      if (ctx.audience === 'sdr') {
        auto = [
          {
            title: 'Open the dialer for this lead',
            detail: ctx.payload.companyName
              ? `${ctx.payload.companyName} is ready.`
              : 'New dial-ready lead on your campaign.',
            href: '/cold_calls',
          },
        ];
      }
      break;

    case 'payout.ready':
    case 'payout.paid':
    case 'payout.failed':
    case 'connect.required':
    case 'connect.ready':
      if (ctx.audience === 'sdr') {
        auto = [
          { title: 'Open Billing / Earnings', href: '/billing' },
          ...(ctx.eventKey === 'payout.failed' || ctx.eventKey === 'connect.required'
            ? [
                {
                  title: 'Finish Stripe Connect',
                  detail: 'Payouts cannot land without a ready Connect account.',
                  href: '/billing',
                },
              ]
            : []),
          ...(ctx.eventKey === 'payout.paid'
            ? [{ title: 'Keep dialing eligible campaigns', href: '/cold_calls' }]
            : []),
        ];
      }
      break;

    case 'wallet.funded':
    case 'escrow.locked':
      if (ctx.audience === 'brand') {
        auto = [
          { title: 'Activate an OPEN campaign', href: campaigns },
          { title: 'Review SDR applications', href: apps },
          { title: 'Watch Live calls for meetings', href: calls },
        ];
      }
      break;

    case 'welcome.sdr':
      if (ctx.audience === 'sdr') {
        auto = [
          { title: 'Practice with the AI trainer', href: '/practice' },
          { title: 'Build resume featured calls', href: '/resume' },
          { title: 'Browse Brand deals', href: '/gigs' },
          { title: 'Connect Stripe for payouts', href: '/billing' },
        ];
      }
      break;

    case 'welcome.brand':
      if (ctx.audience === 'brand') {
        auto = [
          { title: 'Fund the wallet', href: '/billing' },
          { title: 'Add phone pool numbers', href: phones },
          { title: 'Open your first campaign', href: campaigns },
          { title: 'Review applicants with resume audio', href: apps },
        ];
      }
      break;

    default:
      auto = [];
  }

  // Dedupe by title
  const seen = new Set<string>();
  const merged: Recommendation[] = [];
  for (const r of [...fromPayload, ...auto]) {
    const key = r.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  return merged.slice(0, 5);
}

export function recommendationsForEmail(
  eventKey: NotificationEventKey,
  audience: 'sdr' | 'brand' | 'both',
  brand: BrandNotifyContext | null | undefined,
  payload: NotifyPayload
): Recommendation[] {
  if (audience === 'both') {
    // Recipient-specific audience is chosen by caller; default to sdr-leaning mix
    return buildRecommendations({ eventKey, audience: 'sdr', brand, payload });
  }
  return buildRecommendations({ eventKey, audience, brand, payload });
}
