import { NOTIFICATION_CATALOG } from './catalog';
import {
  absoluteUrl,
  escapeHtml,
  paragraph,
  quoteBlock,
  recommendationsHtml,
  recommendationsText,
  renderEmailShell,
} from './layout';
import {
  defaultAcceptMessage,
  defaultRejectMessage,
} from './defaults';
import { buildRecommendations } from './recommendations';
import type {
  NotificationEventKey,
  RenderedEmail,
  TemplateRenderInput,
} from './types';

function nameOf(r: TemplateRenderInput['recipient']) {
  return r.displayName?.trim() || 'there';
}

function brandName(input: TemplateRenderInput) {
  return input.brand?.name || 'the brand';
}

export function renderNotificationEmail(input: TemplateRenderInput): RenderedEmail {
  const { eventKey, payload, recipient, appOrigin } = input;
  const catalog = NOTIFICATION_CATALOG[eventKey];
  const hello = `Hi ${nameOf(recipient)},`;
  const brand = brandName(input);
  const campaign = payload.campaignTitle || 'your campaign';
  const audienceOverride = payload.forAudience;
  const audience: 'sdr' | 'brand' =
    audienceOverride === 'brand' || audienceOverride === 'sdr'
      ? audienceOverride
      : catalog.audience === 'brand'
        ? 'brand'
        : 'sdr';
  const recs = buildRecommendations({
    eventKey,
    audience,
    brand: input.brand,
    payload,
  });

  const build = (opts: {
    subject: string;
    headline: string;
    preheader: string;
    parts: string[];
    ctaUrl?: string;
    ctaLabel?: string;
  }): RenderedEmail => {
    const bodyHtml = [
      paragraph(hello),
      ...opts.parts.map((p) => (p.startsWith('<') ? p : paragraph(p))),
      recommendationsHtml(recs, appOrigin),
    ].join('\n');
    const html = renderEmailShell({
      context: catalog.context,
      brand: input.brand,
      preheader: opts.preheader,
      headline: opts.headline,
      bodyHtml,
      ctaUrl: opts.ctaUrl ? absoluteUrl(appOrigin, opts.ctaUrl) : undefined,
      ctaLabel: opts.ctaLabel,
      appOrigin,
    });
    const text = [
      hello,
      '',
      ...opts.parts.map((p) => p.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ')),
      recommendationsText(recs),
      opts.ctaUrl ? `${opts.ctaLabel || 'Open'}: ${absoluteUrl(appOrigin, opts.ctaUrl)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { subject: opts.subject, html, text };
  };

  switch (eventKey as NotificationEventKey) {
    case 'campaign.application.submitted':
      return build({
        subject: `New applicant on ${campaign}`,
        headline: 'New campaign application',
        preheader: `${String(payload.sdrName || 'An SDR')} applied`,
        parts: [
          `${String(payload.sdrName || 'An SDR')} applied to “${campaign}”.`,
          payload.customMessage
            ? quoteBlock(String(payload.customMessage))
            : 'Review their resume and featured calls, then accept or reject from Recruit.',
        ],
        ctaUrl: payload.ctaUrl || (input.brand?.slug ? `/recruit?brand=${encodeURIComponent(input.brand.slug)}` : '/recruit'),
        ctaLabel: 'Review applications',
      });

    case 'campaign.application.accepted':
      return build({
        subject: `You're on ${campaign} · ${brand}`,
        headline: 'Application accepted',
        preheader: `${brand} activated you on ${campaign}`,
        parts: [
          `${brand} accepted you on “${campaign}”.`,
          quoteBlock(
            (payload.customMessage as string)?.trim() ||
              defaultAcceptMessage({ brandName: brand, campaignTitle: campaign })
          ),
        ],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'Open brand deals',
      });

    case 'campaign.application.rejected':
      return build({
        subject: `Update on ${campaign} · ${brand}`,
        headline: 'Application update',
        preheader: `Decision on ${campaign}`,
        parts: [
          quoteBlock(
            (payload.customMessage as string)?.trim() ||
              defaultRejectMessage({ brandName: brand, campaignTitle: campaign })
          ),
        ],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'Browse brand deals',
      });

    case 'campaign.opened':
      return build({
        subject: `${campaign} is live · ${brand}`,
        headline: 'Campaign activated',
        preheader: 'New dials are open',
        parts: [`“${campaign}” is active. You can start new dials when eligible.`],
        ctaUrl: payload.ctaUrl || '/cold_calls',
        ctaLabel: 'Open dialer',
      });

    case 'campaign.paused':
      return build({
        subject: `${campaign} paused · ${brand}`,
        headline: 'Campaign paused',
        preheader: 'New dials are closed; live calls continue',
        parts: [
          `“${campaign}” was paused. New dials are blocked — calls already in progress are not hung up.`,
        ],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'View deals',
      });

    case 'campaign.ended':
      return build({
        subject: `${campaign} ended · ${brand}`,
        headline: 'Campaign ended',
        preheader: 'Schedule window closed',
        parts: [`“${campaign}” reached its end date. New dials are closed.`],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'View deals',
      });

    case 'campaign.budget.low':
      return build({
        subject: `Budget running low · ${campaign}`,
        headline: 'Campaign budget low',
        preheader: payload.amountLabel || 'Spend nearing cap',
        parts: [
          `“${campaign}” is nearing its spend cap${payload.amountLabel ? ` (${payload.amountLabel})` : ''}. Fund wallet or raise the budget to keep awarding results.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Open wallet',
      });

    case 'campaign.budget.exhausted':
      return build({
        subject: `Budget exhausted · ${campaign}`,
        headline: 'Campaign budget exhausted',
        preheader: 'New awards blocked',
        parts: [
          `“${campaign}” has no remaining spend budget. New dials and awards are gated until you raise the cap or wait for the next day (daily mode).`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Manage budget',
      });

    case 'appointment.booked':
      return build({
        subject: `Meeting booked · ${campaign}`,
        headline: 'Meeting booked',
        preheader: payload.prospectName || 'New appointment',
        parts: [
          `A meeting was booked on “${campaign}”${payload.prospectName ? ` with ${payload.prospectName}` : ''}${payload.meetingAtLabel ? ` · ${payload.meetingAtLabel}` : ''}.`,
        ],
        ctaUrl: payload.ctaUrl || '/dashboard',
        ctaLabel: 'View details',
      });

    case 'appointment.verified':
      return build({
        subject: `Appointment verified · ${campaign}`,
        headline: 'Appointment verified',
        preheader: 'Escrow release / payout path',
        parts: [
          `An appointment on “${campaign}” passed verification${payload.amountLabel ? ` · ${payload.amountLabel}` : ''}.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'View payouts',
      });

    case 'appointment.failed_audit':
      return build({
        subject: `Appointment needs review · ${campaign}`,
        headline: 'Appointment audit failed',
        preheader: payload.reason || 'Manual review may be needed',
        parts: [
          `An appointment claim on “${campaign}” failed automated audit${payload.reason ? `: ${payload.reason}` : '.'}`,
        ],
        ctaUrl: payload.ctaUrl || '/dashboard',
        ctaLabel: 'Review',
      });

    case 'campaign.apply.blocked':
      return build({
        subject: `Practice required · ${campaign}`,
        headline: 'Application blocked',
        preheader: payload.reason || 'Complete the practice gate',
        parts: [
          `You can’t apply to “${campaign}” yet${payload.reason ? `: ${payload.reason}` : '.'}`,
        ],
        ctaUrl: payload.practiceHref || payload.ctaUrl || '/practice',
        ctaLabel: 'Practice now',
      });

    case 'campaign.dial.blocked':
      return build({
        subject: `Dial blocked · ${campaign}`,
        headline: 'New dial not allowed',
        preheader: payload.reason || 'Campaign not eligible',
        parts: [
          `A new dial on “${campaign}” was blocked${payload.reason ? `: ${payload.reason}` : '.'}`,
        ],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'View deals',
      });

    case 'campaign.callback.locked':
      return build({
        subject: `Lead locked · ${payload.companyName || campaign}`,
        headline: 'Callback lock',
        preheader: 'Another rep holds this lead',
        parts: [
          `${payload.companyName || 'This lead'} is locked to another rep for the callback window${payload.reason ? `: ${payload.reason}` : '.'}`,
        ],
        ctaUrl: payload.ctaUrl || '/cold_calls',
        ctaLabel: 'Pick another lead',
      });

    case 'brand.phone_pool.empty':
      return build({
        subject: `Add phone numbers · ${brand}`,
        headline: 'Phone pool empty',
        preheader: 'Cannot open campaign without brand DIDs',
        parts: [
          `“${campaign}” can’t go live until local numbers are in the brand phone pool.`,
        ],
        ctaUrl: payload.ctaUrl || `/brands/${input.brand?.slug || ''}/settings`,
        ctaLabel: 'Add numbers',
      });

    case 'brand.escrow.insufficient':
      return build({
        subject: `Fund wallet to open · ${campaign}`,
        headline: 'Insufficient escrow',
        preheader: payload.amountLabel || 'Wallet short',
        parts: [
          `Couldn’t lock escrow for “${campaign}”${payload.reason ? `: ${payload.reason}` : '.'}`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Fund wallet',
      });

    case 'lead.assigned':
      return build({
        subject: `New lead · ${payload.companyName || campaign}`,
        headline: 'Lead assigned',
        preheader: payload.companyName || 'Dial-ready lead',
        parts: [
          `${payload.companyName || 'A lead'} was assigned on “${campaign}” and is ready to dial.`,
        ],
        ctaUrl: payload.ctaUrl || '/cold_calls',
        ctaLabel: 'Open dialer',
      });

    case 'connect.ready':
      return build({
        subject: 'Stripe Connect is ready',
        headline: 'Payouts enabled',
        preheader: 'You can receive campaign payouts',
        parts: [
          'Your Stripe Connect account can receive transfers. Brand campaign payouts can now land in your bank.',
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'View earnings',
      });

    case 'payout.ready':
      return build({
        subject: `Payout started · ${payload.amountLabel || campaign}`,
        headline: 'Payout in progress',
        preheader: 'Brand initiated checkout',
        parts: [
          `${brand} started a payout for “${campaign}”${payload.amountLabel ? ` (${payload.amountLabel})` : ''}. Complete Connect onboarding if prompted.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Check earnings',
      });

    case 'payout.paid':
      return build({
        subject: `You were paid · ${payload.amountLabel || campaign}`,
        headline: 'Payout completed',
        preheader: payload.amountLabel || 'Funds on the way',
        parts: [
          `Payment for “${campaign}” completed${payload.amountLabel ? ` · ${payload.amountLabel}` : ''}.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'View earnings',
      });

    case 'payout.failed':
      return build({
        subject: `Payout failed · ${campaign}`,
        headline: 'Payout failed',
        preheader: payload.reason || 'Action may be required',
        parts: [
          `A payout for “${campaign}” failed${payload.reason ? `: ${payload.reason}` : '.'} Check Connect status under Billing.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Fix payouts',
      });

    case 'wallet.funded':
      return build({
        subject: `Wallet funded · ${payload.amountLabel || brand}`,
        headline: 'Wallet funded',
        preheader: payload.amountLabel || 'Balance updated',
        parts: [
          `Your brand wallet was funded${payload.amountLabel ? ` by ${payload.amountLabel}` : ''}.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Open wallet',
      });

    case 'escrow.locked':
      return build({
        subject: `Escrow locked · ${campaign}`,
        headline: 'Escrow locked',
        preheader: payload.amountLabel || 'Campaign funded',
        parts: [
          `Escrow was locked for “${campaign}”${payload.amountLabel ? ` (${payload.amountLabel})` : ''}.`,
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'View wallet',
      });

    case 'welcome.sdr':
      return build({
        subject: 'Welcome to ColdCallReps',
        headline: 'Welcome, SDR',
        preheader: 'Practice, apply, earn',
        parts: [
          'Your SDR desk is ready. Practice with the AI trainer, build a resume with featured calls, then apply to Brand deals.',
        ],
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'Browse brand deals',
      });

    case 'welcome.brand':
      return build({
        subject: 'Welcome to ColdCallReps Brand',
        headline: 'Welcome, brand',
        preheader: 'Fund, campaign, hire SDRs',
        parts: [
          'Your brand desk is ready. Fund the wallet, open a campaign, and review SDR applications with resume calls.',
        ],
        ctaUrl: payload.ctaUrl || '/dashboard',
        ctaLabel: 'Open brand desk',
      });

    case 'connect.required':
      return build({
        subject: 'Connect Stripe to get paid',
        headline: 'Payout setup needed',
        preheader: 'Finish Stripe Connect',
        parts: [
          'A brand is ready to pay you. Connect Stripe under Billing so transfers can complete.',
        ],
        ctaUrl: payload.ctaUrl || '/billing',
        ctaLabel: 'Connect payouts',
      });

    case 'talent.interested':
      return build({
        subject: `${brand} shortlisted you`,
        headline: 'A brand wants to work with you',
        preheader: `${brand} showed interest`,
        parts: [
          `${brand} shortlisted your profile from Recruit.`,
          'They can see you in their pipeline — open Brand deals to review their open campaigns and apply.',
          payload.customMessage || '',
        ].filter(Boolean),
        ctaUrl: payload.ctaUrl || '/gigs',
        ctaLabel: 'View brand deals',
      });

    default:
      return build({
        subject: 'ColdCallReps update',
        headline: 'Update',
        preheader: eventKey,
        parts: [`You have a new update (${eventKey}).`],
        ctaUrl: '/dashboard',
        ctaLabel: 'Open app',
      });
  }
}
