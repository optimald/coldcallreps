/**
 * Lightweight brand-website context for AI setup proposals.
 * Homepage-only (same fetcher as prospect enrichment) — not a deep crawl.
 */

import { scrapeWebsiteHooks } from '@/lib/maps/scraper';
import {
  normalizeWebsiteUrl,
  resolveBrandLogoFromWebsite,
} from '@/lib/fetch-brand-logo';

export type WebsiteSetupContext = {
  websiteUrl: string;
  logoUrl: string | null;
  title?: string;
  description?: string;
  hooks: string[];
  /** Truncated prompt-safe blob for the LLM. */
  promptText: string;
  fetched: boolean;
};

const MAX_PROMPT_CHARS = 3500;

export async function fetchWebsiteSetupContext(
  rawUrl: string
): Promise<WebsiteSetupContext | null> {
  const websiteUrl = normalizeWebsiteUrl(rawUrl);
  if (!websiteUrl) return null;

  const [hooksResult, logoUrl] = await Promise.all([
    scrapeWebsiteHooks(websiteUrl).catch(() => null),
    resolveBrandLogoFromWebsite(websiteUrl).catch(() => null),
  ]);

  const title = hooksResult?.title?.trim() || undefined;
  const description = hooksResult?.description?.trim() || undefined;
  const hooks = (hooksResult?.hooks || []).slice(0, 12);

  const parts = [
    `URL: ${websiteUrl}`,
    title ? `Title: ${title}` : '',
    description ? `Meta description: ${description}` : '',
    hooks.length ? `Page hooks:\n- ${hooks.join('\n- ')}` : '',
    hooksResult?.emails?.length
      ? `Emails seen (do not invent contacts): ${hooksResult.emails.slice(0, 3).join(', ')}`
      : '',
    hooksResult?.intel?.cms ? `CMS: ${hooksResult.intel.cms}` : '',
    hooksResult?.intel?.bookingSystem
      ? `Booking tool: ${hooksResult.intel.bookingSystem}`
      : '',
  ].filter(Boolean);

  const promptText = parts.join('\n').slice(0, MAX_PROMPT_CHARS);

  return {
    websiteUrl,
    logoUrl: logoUrl || null,
    title,
    description,
    hooks,
    promptText,
    fetched: Boolean(hooksResult?.hasWebsite),
  };
}
