/**
 * Typed AI setup proposal — brand + pack + playbook + campaign draft.
 * Validated before any persistence; never trust raw LLM JSON.
 */

import {
  BUDGET_MODES,
  clampPayoutCents,
  isBudgetMode,
  isCampaignEarningsModel,
  type BudgetMode,
} from '@/lib/campaigns';
import {
  CALLING_TIMEZONE_OPTIONS,
  DEFAULT_CALLING_TIMEZONE,
  normalizeCallingHoursMinutes,
} from '@/lib/calling-hours';
import { sanitizePlaybookContent, type PlaybookStep } from '@/lib/trainer/playbook-context';
import { normalizeWebsiteUrl } from '@/lib/fetch-brand-logo';
import type { CampaignEarningsModel } from '@prisma/client';

export type SetupIcp = {
  vertical?: string;
  titles?: string[];
  companySize?: string;
  acv?: string;
  pain?: string;
  trigger?: string;
  offer?: string;
};

export type SetupProposalBrand = {
  name: string;
  websiteUrl: string;
  description: string;
  logoUrl?: string | null;
};

export type SetupProposalPack = {
  name: string;
  icp: SetupIcp;
  scripts: string[];
  objections: string[];
};

export type SetupProposalPlaybook = {
  title: string;
  steps: PlaybookStep[];
  productUrl?: string;
};

export type SetupProposalCampaign = {
  title: string;
  description: string;
  icpText: string;
  targetVertical?: string | null;
  targetLocation?: string | null;
  earningsModel: CampaignEarningsModel;
  payoutCents: number;
  meetingDurationMinutes?: number | null;
  bookingLink?: string | null;
  budgetMode: BudgetMode;
  budgetCents?: number | null;
  dailyBudgetCents?: number | null;
  callingHoursStartMin?: number | null;
  callingHoursEndMin?: number | null;
  callingTimezone?: string | null;
  maxAwards?: number | null;
};

export type SetupProposal = {
  brand: SetupProposalBrand;
  pack: SetupProposalPack;
  playbook: SetupProposalPlaybook;
  campaign: SetupProposalCampaign;
  assumptions: string[];
  missing: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type SetupProposalValidation =
  | { ok: true; proposal: SetupProposal }
  | { ok: false; error: string };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, max: number, fallback = ''): string {
  return String(v ?? fallback).trim().slice(0, max);
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeIcp(raw: unknown): SetupIcp {
  const o = asRecord(raw);
  const titles = strList(o.titles, 12, 80);
  const icp: SetupIcp = {};
  if (o.vertical) icp.vertical = str(o.vertical, 160);
  if (titles.length) icp.titles = titles;
  if (o.companySize) icp.companySize = str(o.companySize, 120);
  if (o.acv) icp.acv = str(o.acv, 80);
  if (o.pain) icp.pain = str(o.pain, 400);
  if (o.trigger) icp.trigger = str(o.trigger, 400);
  if (o.offer) icp.offer = str(o.offer, 400);
  return icp;
}

function sanitizeConfidence(v: unknown): 'low' | 'medium' | 'high' {
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'medium';
}

function sanitizeBookingLink(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const link = str(raw, 500);
  if (!link) return null;
  if (!/^https?:\/\//i.test(link)) return null;
  return link;
}

/** Normalize unknown LLM/API JSON into a safe SetupProposal. */
export function sanitizeSetupProposal(input: unknown): SetupProposalValidation {
  const root = asRecord(input);
  const brandRaw = asRecord(root.brand);
  const packRaw = asRecord(root.pack);
  const playbookRaw = asRecord(root.playbook);
  const campaignRaw = asRecord(root.campaign);

  const websiteUrl =
    normalizeWebsiteUrl(str(brandRaw.websiteUrl || brandRaw.website, 500)) || '';
  const brandName = str(brandRaw.name, 120);
  const brandDescription = str(brandRaw.description, 1000);
  if (!brandName) return { ok: false, error: 'Brand name is required in the proposal' };
  if (!websiteUrl) return { ok: false, error: 'A valid brand websiteUrl is required' };
  if (!brandDescription) {
    return { ok: false, error: 'Brand description is required in the proposal' };
  }

  const packName = str(packRaw.name, 160) || `${brandName} outbound`;
  const scripts = strList(packRaw.scripts, 8, 800);
  const objections = strList(packRaw.objections, 16, 400);
  if (scripts.length < 1) {
    return { ok: false, error: 'Pack needs at least one script line' };
  }

  const content = sanitizePlaybookContent({
    steps: playbookRaw.steps,
    productUrl: playbookRaw.productUrl || websiteUrl,
  });
  if (!content.steps.length) {
    return { ok: false, error: 'Playbook needs at least one step' };
  }
  const playbookTitle = str(playbookRaw.title, 160) || `${brandName} — book discovery`;

  const earningsModel: CampaignEarningsModel = isCampaignEarningsModel(
    campaignRaw.earningsModel
  )
    ? campaignRaw.earningsModel
    : 'PER_BOOKED_MEETING';

  const payoutCents = clampPayoutCents(
    campaignRaw.payoutCents != null ? Number(campaignRaw.payoutCents) : 4000
  );

  const title = str(campaignRaw.title, 160);
  const description = str(campaignRaw.description, 8000);
  if (!title) return { ok: false, error: 'Campaign title is required' };
  if (!description) return { ok: false, error: 'Campaign description is required' };

  const budgetMode: BudgetMode = isBudgetMode(campaignRaw.budgetMode)
    ? campaignRaw.budgetMode
    : 'OVERALL';

  const meetingDurationMinutes =
    campaignRaw.meetingDurationMinutes != null && campaignRaw.meetingDurationMinutes !== ''
      ? Math.max(5, Math.min(180, Math.round(Number(campaignRaw.meetingDurationMinutes))))
      : earningsModel === 'PER_QUALIFIED_LEAD'
        ? null
        : 20;

  const maxAwards =
    campaignRaw.maxAwards != null && campaignRaw.maxAwards !== ''
      ? Math.max(1, Math.min(500, Math.round(Number(campaignRaw.maxAwards))))
      : 25;

  let budgetCents =
    campaignRaw.budgetCents != null && campaignRaw.budgetCents !== ''
      ? Math.max(0, Math.round(Number(campaignRaw.budgetCents)))
      : payoutCents * maxAwards;

  let dailyBudgetCents: number | null =
    campaignRaw.dailyBudgetCents != null && campaignRaw.dailyBudgetCents !== ''
      ? Math.max(0, Math.round(Number(campaignRaw.dailyBudgetCents)))
      : null;

  if (budgetMode === 'DAILY') {
    if (dailyBudgetCents == null || dailyBudgetCents <= 0) {
      dailyBudgetCents = Math.max(payoutCents, Math.round(budgetCents / 10));
    }
  } else {
    dailyBudgetCents = null;
  }

  const startMin = normalizeCallingHoursMinutes(campaignRaw.callingHoursStartMin);
  const endMin = normalizeCallingHoursMinutes(campaignRaw.callingHoursEndMin);
  let callingTimezone = str(campaignRaw.callingTimezone, 64) || null;
  if (
    callingTimezone &&
    !(CALLING_TIMEZONE_OPTIONS as readonly string[]).includes(callingTimezone)
  ) {
    callingTimezone = DEFAULT_CALLING_TIMEZONE;
  }

  const bookingLink = sanitizeBookingLink(campaignRaw.bookingLink);
  const assumptions = strList(root.assumptions, 12, 400);
  const missing = strList(root.missing, 12, 200);

  // Surface human-required fields the model should not invent.
  const missingSet = new Set(missing.map((m) => m.toLowerCase()));
  if (!bookingLink && earningsModel !== 'PER_QUALIFIED_LEAD') {
    if (![...missingSet].some((m) => m.includes('booking'))) {
      missing.push('booking link (Cal.com / Calendly / Google Appointment)');
    }
  }

  const proposal: SetupProposal = {
    brand: {
      name: brandName,
      websiteUrl,
      description: brandDescription,
      logoUrl: brandRaw.logoUrl != null ? str(brandRaw.logoUrl, 2000) || null : null,
    },
    pack: {
      name: packName,
      icp: sanitizeIcp(packRaw.icp),
      scripts,
      objections,
    },
    playbook: {
      title: playbookTitle,
      steps: content.steps,
      productUrl: content.productUrl || websiteUrl,
    },
    campaign: {
      title,
      description,
      icpText: str(campaignRaw.icpText, 4000),
      targetVertical: campaignRaw.targetVertical
        ? str(campaignRaw.targetVertical, 160)
        : null,
      targetLocation: campaignRaw.targetLocation
        ? str(campaignRaw.targetLocation, 160)
        : null,
      earningsModel,
      payoutCents,
      meetingDurationMinutes,
      bookingLink,
      budgetMode,
      budgetCents,
      dailyBudgetCents,
      callingHoursStartMin: startMin === undefined ? null : startMin,
      callingHoursEndMin: endMin === undefined ? null : endMin,
      callingTimezone:
        startMin != null && endMin != null
          ? callingTimezone || DEFAULT_CALLING_TIMEZONE
          : null,
      maxAwards,
    },
    assumptions,
    missing,
    confidence: sanitizeConfidence(root.confidence),
  };

  return { ok: true, proposal };
}

export function emptyProposalShell(partial?: {
  websiteUrl?: string;
  brandName?: string;
}): SetupProposal {
  const websiteUrl =
    normalizeWebsiteUrl(partial?.websiteUrl || '') || 'https://example.com';
  const name = (partial?.brandName || 'Your brand').slice(0, 120);
  return {
    brand: {
      name,
      websiteUrl,
      description: 'Outbound campaign for booked discovery meetings.',
    },
    pack: {
      name: `${name} outbound`,
      icp: { vertical: '', titles: [], pain: '' },
      scripts: ['Opening value line'],
      objections: [],
    },
    playbook: {
      title: `${name} — book discovery`,
      steps: [
        { title: 'Open', script: 'Pattern interrupt + relevance.', objections: [] },
        { title: 'Qualify', script: 'Discover pain and authority.', objections: [] },
        { title: 'Pitch', script: 'One outcome, one proof.', objections: [] },
        { title: 'Close', script: 'Two calendar options.', objections: [] },
      ],
      productUrl: websiteUrl,
    },
    campaign: {
      title: `$40 booked discovery · ${name}`,
      description: 'Book a discovery meeting with a qualified decision-maker.',
      icpText: '',
      earningsModel: 'PER_BOOKED_MEETING',
      payoutCents: 4000,
      meetingDurationMinutes: 20,
      bookingLink: null,
      budgetMode: 'OVERALL',
      budgetCents: 100000,
      dailyBudgetCents: null,
      maxAwards: 25,
      callingHoursStartMin: 9 * 60,
      callingHoursEndMin: 17 * 60,
      callingTimezone: DEFAULT_CALLING_TIMEZONE,
    },
    assumptions: [],
    missing: ['booking link (Cal.com / Calendly / Google Appointment)'],
    confidence: 'low',
  };
}

export { BUDGET_MODES };
