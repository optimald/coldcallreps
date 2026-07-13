/**
 * Phase 2 — phone-focused web scan.
 * Strips SEO/WebEvo concerns; extracts phones + Cal.com / Calendly booking URLs.
 */

import * as cheerio from 'cheerio';

export type PhoneWebScanResult = {
  phones: string[];
  bookingUrls: string[];
  bookingSystem: string | null;
  ownerNameHint: string | null;
  ownerTitleHint: string | null;
  hasWebsite: boolean;
  https: boolean;
  mobile: boolean;
  rawSnippet?: string;
};

const PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|(?:\+?\d{1,3}[-.\s]?)?\d{7,14}/g;

const BOOKING_URL_RE =
  /https?:\/\/(?:www\.)?(?:calendly\.com|cal\.com)\/[^\s"'<>]{2,120}/gi;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Scan a website HTML blob for direct lines and booking links.
 * Prefer tel: links, then regex in body text / footer.
 */
export function scanWebsiteForPhones(html: string, pageUrl?: string): PhoneWebScanResult {
  const $ = cheerio.load(html);
  const phones: string[] = [];

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const n = normalizePhone(href.replace(/^tel:/i, ''));
    if (n) phones.push(n);
  });

  const text = $('body').text().replace(/\s+/g, ' ').slice(0, 80000);
  const fromText = text.match(PHONE_RE) || [];
  for (const m of fromText) {
    const n = normalizePhone(m);
    if (n) phones.push(n);
  }

  const bookingUrls = uniq([...(html.match(BOOKING_URL_RE) || [])].map((u) => u.replace(/[),.;]+$/, '')));

  let bookingSystem: string | null = null;
  if (bookingUrls.some((u) => /calendly\.com/i.test(u))) bookingSystem = 'Calendly';
  else if (bookingUrls.some((u) => /cal\.com/i.test(u))) bookingSystem = 'Cal.com';

  // Lightweight decision-maker hints from common patterns
  let ownerNameHint: string | null = null;
  let ownerTitleHint: string | null = null;
  const about = $('h1, h2, .team, [class*="founder"], [class*="owner"]').text().slice(0, 400);
  const titleMatch = about.match(
    /\b(owner|founder|ceo|president|managing partner|principal)\b/i
  );
  if (titleMatch) ownerTitleHint = titleMatch[1];

  const https = pageUrl ? pageUrl.startsWith('https') : /https:\/\//i.test(html.slice(0, 500));
  const mobile = /viewport/i.test(html) && /width\s*=\s*device-width/i.test(html);

  return {
    phones: uniq(phones).slice(0, 8),
    bookingUrls: bookingUrls.slice(0, 5),
    bookingSystem,
    ownerNameHint,
    ownerTitleHint,
    hasWebsite: true,
    https,
    mobile,
  };
}

export async function fetchAndScanWebsite(websiteUrl: string): Promise<PhoneWebScanResult> {
  const url = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ColdCallRepsBot/1.0; +https://coldcallreps.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    if (!res.ok) {
      return {
        phones: [],
        bookingUrls: [],
        bookingSystem: null,
        ownerNameHint: null,
        ownerTitleHint: null,
        hasWebsite: true,
        https: url.startsWith('https'),
        mobile: false,
      };
    }
    const html = await res.text();
    return scanWebsiteForPhones(html.slice(0, 500_000), url);
  } catch {
    return {
      phones: [],
      bookingUrls: [],
      bookingSystem: null,
      ownerNameHint: null,
      ownerTitleHint: null,
      hasWebsite: false,
      https: false,
      mobile: false,
    };
  }
}
