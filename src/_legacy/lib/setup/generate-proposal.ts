/**
 * Generate / refine AI setup proposals via runLLM (JSON mode).
 */

import { runLLM } from '@/lib/llm-client';
import {
  sanitizeSetupProposal,
  type SetupProposal,
} from '@/lib/setup/proposal-schema';
import type { WebsiteSetupContext } from '@/lib/setup/website-context';
import { normalizeWebsiteUrl } from '@/lib/fetch-brand-logo';

const SYSTEM_PROMPT = `You are the Cold Call Reps campaign setup assistant.
Given a company website and a short brand brief, produce a complete outbound setup as JSON.

Output ONLY a JSON object with this shape:
{
  "brand": { "name": string, "websiteUrl": string, "description": string },
  "pack": {
    "name": string,
    "icp": {
      "vertical": string,
      "titles": string[],
      "companySize": string,
      "acv": string,
      "pain": string,
      "trigger": string,
      "offer": string
    },
    "scripts": string[],
    "objections": string[]
  },
  "playbook": {
    "title": string,
    "productUrl": string,
    "steps": [
      { "title": string, "script": string, "objections": string[] }
    ]
  },
  "campaign": {
    "title": string,
    "description": string,
    "icpText": string,
    "targetVertical": string | null,
    "targetLocation": string | null,
    "earningsModel": "PER_BOOKED_MEETING",
    "payoutCents": number,
    "meetingDurationMinutes": 20,
    "bookingLink": null,
    "budgetMode": "OVERALL",
    "budgetCents": number,
    "maxAwards": number,
    "callingHoursStartMin": 540,
    "callingHoursEndMin": 1020,
    "callingTimezone": "America/Los_Angeles"
  },
  "assumptions": string[],
  "missing": string[],
  "confidence": "low" | "medium" | "high"
}

Quality bar (example style — do NOT copy DispatchNode content unless the site is DispatchNode):
- Goal: booked discovery meeting, not a demo dump.
- Playbook steps MUST be Open → Qualify → Pitch → Close (exactly 4).
- Each step has a concrete talk track and step-specific objections.
- Pack scripts: 3 short positioning lines. Objections: 6–10 real ones.
- Campaign title like "$40 booked discovery · {Brand}" unless brief specifies another payout.
- Default payoutCents 4000 ($40) unless brief says otherwise (clamp mentally $5–$500).
- budgetCents ≈ payoutCents * maxAwards (default maxAwards 25).
- targetVertical / targetLocation: only if brief or site clearly implies local Maps-style hunting; else null.
- If the brief includes a product / offer landing URL that differs from the homepage, set playbook.productUrl to that URL (not the homepage).
- Never invent a booking link, phone number, wallet balance, pricing not on the site, or fake logos.
- Put human-required gaps in "missing" (especially booking link).
- Put guesses in "assumptions".
- Conservative claims; founder-led outbound tone.
- brand.description ≤ 2–3 sentences.
- If site fetch failed or brief is thin, set confidence "low".`;

function buildUserPrompt(opts: {
  websiteUrl: string;
  brief: string;
  site?: WebsiteSetupContext | null;
  existingBrand?: { name: string; description?: string | null } | null;
}): string {
  const parts = [
    `Website URL: ${opts.websiteUrl}`,
    opts.brief.trim()
      ? `Brand brief:\n${opts.brief.trim().slice(0, 2000)}`
      : 'Brand brief: (none — infer from website)',
    opts.existingBrand
      ? `Existing brand name: ${opts.existingBrand.name}${
          opts.existingBrand.description
            ? `\nExisting description: ${opts.existingBrand.description}`
            : ''
        }`
      : 'No existing brand yet — invent name from the site if needed.',
    opts.site?.fetched
      ? `Website research:\n${opts.site.promptText}`
      : 'Website research: fetch failed or empty — rely on URL hostname + brief. Set confidence low.',
    'Return the full JSON proposal now.',
  ];
  return parts.join('\n\n');
}

/** Prefer a distinct product/landing URL from the brief over the homepage. */
export function productUrlFromBrief(brief: string, websiteUrl: string): string | null {
  const home = normalizeWebsiteUrl(websiteUrl);
  if (!home) return null;
  const matches = brief.match(/https?:\/\/[^\s)\]>'"]+/gi) || [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?]+$/g, '');
    const url = normalizeWebsiteUrl(cleaned);
    if (!url || url === home) continue;
    try {
      const homeHost = new URL(home).hostname.replace(/^www\./, '');
      const urlHost = new URL(url).hostname.replace(/^www\./, '');
      if (urlHost === homeHost && url.length > home.length) return url;
      if (urlHost === homeHost) return url;
    } catch {
      /* ignore bad URL */
    }
  }
  return null;
}

export async function generateSetupProposal(opts: {
  websiteUrl: string;
  brief: string;
  site?: WebsiteSetupContext | null;
  existingBrand?: { name: string; description?: string | null } | null;
}): Promise<{ proposal: SetupProposal; raw: string }> {
  const raw = await runLLM(
    SYSTEM_PROMPT,
    buildUserPrompt(opts),
    { jsonMode: true, temperature: 0.35 }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned invalid JSON — try again');
  }

  // Prefer known website URL / logo from fetch over model invention.
  const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const brand = root.brand && typeof root.brand === 'object' ? (root.brand as Record<string, unknown>) : {};
  brand.websiteUrl = opts.websiteUrl;
  if (opts.site?.logoUrl) brand.logoUrl = opts.site.logoUrl;
  if (opts.existingBrand?.name && !brand.name) brand.name = opts.existingBrand.name;
  root.brand = brand;

  const briefProductUrl = productUrlFromBrief(opts.brief, opts.websiteUrl);
  if (briefProductUrl) {
    const playbook =
      root.playbook && typeof root.playbook === 'object'
        ? (root.playbook as Record<string, unknown>)
        : {};
    const current = typeof playbook.productUrl === 'string' ? playbook.productUrl : '';
    const currentNorm = normalizeWebsiteUrl(current) || '';
    const homeNorm = normalizeWebsiteUrl(opts.websiteUrl) || '';
    // Prefer brief product URL when model omitted it or fell back to homepage.
    if (!currentNorm || currentNorm === homeNorm) {
      playbook.productUrl = briefProductUrl;
      root.playbook = playbook;
    }
  }

  const validated = sanitizeSetupProposal(root);
  if (!validated.ok) throw new Error(validated.error);

  if (opts.site && !opts.site.fetched) {
    validated.proposal.confidence = 'low';
  }
  if (opts.site?.logoUrl) {
    validated.proposal.brand.logoUrl = opts.site.logoUrl;
  }
  validated.proposal.brand.websiteUrl = opts.websiteUrl;
  if (briefProductUrl) {
    const homeNorm = normalizeWebsiteUrl(opts.websiteUrl) || '';
    const applied = normalizeWebsiteUrl(validated.proposal.playbook.productUrl || '') || '';
    if (!applied || applied === homeNorm) {
      validated.proposal.playbook.productUrl = briefProductUrl;
    }
  }

  return { proposal: validated.proposal, raw };
}

export async function refineSetupProposal(opts: {
  proposal: SetupProposal;
  instruction: string;
}): Promise<{ proposal: SetupProposal; raw: string }> {
  const instruction = opts.instruction.trim().slice(0, 1500);
  if (!instruction) throw new Error('Refinement instruction required');

  const refineSystem = `${SYSTEM_PROMPT}

You are refining an existing proposal. Apply the user's instruction.
Keep fields the user did not ask to change.
Never invent a booking link unless the instruction explicitly provides one.
Return the FULL updated JSON object (not a patch).`;

  const raw = await runLLM(
    refineSystem,
    `Current proposal JSON:\n${JSON.stringify(opts.proposal).slice(0, 10000)}\n\nUser instruction:\n${instruction}\n\nReturn the full updated JSON.`,
    { jsonMode: true, temperature: 0.3 }
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned invalid JSON — try again');
  }

  const validated = sanitizeSetupProposal(parsed);
  if (!validated.ok) throw new Error(validated.error);

  // Preserve website unless instruction clearly changed it via model + validation.
  validated.proposal.brand.websiteUrl = opts.proposal.brand.websiteUrl;
  if (!validated.proposal.brand.logoUrl && opts.proposal.brand.logoUrl) {
    validated.proposal.brand.logoUrl = opts.proposal.brand.logoUrl;
  }

  return { proposal: validated.proposal, raw };
}
