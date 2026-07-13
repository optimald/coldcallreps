import * as cheerio from 'cheerio';
import {
  computeTrojanScore,
  type ProspectIntel,
} from '@/lib/prospect-intel';

export interface WebsiteHooks {
  title?: string;
  description?: string;
  hooks: string[];
  hasWebsite: boolean;
  /** Best-effort contacts found on the page (1-step enrich). */
  emails?: string[];
  phones?: string[];
  /** Quick Intel fields derived in the same scrape pass. */
  intel?: ProspectIntel;
}

type CheerioRoot = ReturnType<typeof cheerio.load>;

const CMS_PATTERNS: { name: string; test: (html: string, $: CheerioRoot) => boolean }[] = [
  {
    name: 'WordPress',
    test: (html, $) =>
      /wp-content|wp-includes|wordpress/i.test(html) ||
      ($('meta[name="generator"]').attr('content') || '').toLowerCase().includes('wordpress'),
  },
  {
    name: 'Squarespace',
    test: (html, $) =>
      /squarespace/i.test(html) ||
      ($('meta[name="generator"]').attr('content') || '').toLowerCase().includes('squarespace'),
  },
  {
    name: 'Wix',
    test: (html, $) =>
      /wix\.com|wixstatic|X-Wix/i.test(html) ||
      ($('meta[name="generator"]').attr('content') || '').toLowerCase().includes('wix'),
  },
  {
    name: 'Shopify',
    test: (html) => /cdn\.shopify|Shopify\.theme|myshopify/i.test(html),
  },
  {
    name: 'Webflow',
    test: (html, $) =>
      /webflow/i.test(html) ||
      ($('meta[name="generator"]').attr('content') || '').toLowerCase().includes('webflow'),
  },
  {
    name: 'GoDaddy',
    test: (html) => /godaddy|secureserver\.net/i.test(html),
  },
  {
    name: 'HubSpot',
    test: (html) => /hs-scripts\.com|hubspot/i.test(html),
  },
  {
    name: 'Drupal',
    test: (html, $) =>
      /drupal/i.test(html) ||
      ($('meta[name="generator"]').attr('content') || '').toLowerCase().includes('drupal'),
  },
];

const BOOKING_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Calendly', re: /calendly\.com/i },
  { name: 'Cal.com', re: /cal\.com\//i },
  { name: 'Acuity', re: /acuityscheduling|squareup\.com\/appointments/i },
  { name: 'Mindbody', re: /mindbodyonline|mindbody\.io/i },
  { name: 'Vagaro', re: /vagaro\.com/i },
  { name: 'Boulevard', re: /joinblvd|boulevard\.io/i },
  { name: 'Jane', re: /jane\.app/i },
  { name: 'Setmore', re: /setmore\.com/i },
];

function detectCms(html: string, $: CheerioRoot): string | null {
  for (const p of CMS_PATTERNS) {
    if (p.test(html, $)) return p.name;
  }
  const gen = $('meta[name="generator"]').attr('content')?.trim();
  if (gen) return gen.slice(0, 40);
  return null;
}

function detectCopyrightYear(html: string, $: CheerioRoot): number | null {
  const footerText = $('footer, .footer, [class*="footer"], [id*="footer"]')
    .text()
    .slice(0, 2000);
  const hay = `${footerText} ${html.slice(-8000)}`;
  const matches = [...hay.matchAll(/(?:©|copyright|&copy;)\s*(?:19|20)\d{2}/gi)];
  const years = matches
    .map((m) => {
      const y = m[0].match(/(19|20)\d{2}/);
      return y ? parseInt(y[0], 10) : null;
    })
    .filter((y): y is number => y != null && y >= 1990 && y <= new Date().getFullYear() + 1);
  if (years.length === 0) {
    const bare = [...hay.matchAll(/\b(20[0-2]\d)\b/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((y) => y >= 2005 && y <= new Date().getFullYear());
    if (bare.length) return Math.max(...bare);
    return null;
  }
  return Math.max(...years);
}

function detectBooking(html: string): string | null {
  for (const b of BOOKING_PATTERNS) {
    if (b.re.test(html)) return b.name;
  }
  return null;
}

function detectSignals(
  html: string,
  $: CheerioRoot,
  opts: { booking: string | null; mobile: boolean; https: boolean }
): string[] {
  const signals: string[] = [];
  const lower = html.toLowerCase();
  // Match Trojan LeadSignals labels where practical
  if (
    /facebook\.net\/.*fbevents|fbq\s*\(|meta pixel|facebook\.com\/tr/i.test(html)
  ) {
    signals.push('Meta PI');
  }
  if (/googletagmanager|gtag\(|google-analytics|GoogleAnalyticsObject/i.test(html)) {
    signals.push('GA');
  }
  if (
    /googleadservices|google_conversion|gtag\/js\?id=AW-|adsbygoogle|googlesyndication/i.test(
      html
    )
  ) {
    signals.push('Google Ads');
  }
  if (opts.booking) signals.push(opts.booking);
  if (/intercom|drift\.com|tidio|crisp\.chat|zendesk|livechat|tawk\.to/i.test(html)) {
    signals.push('Chat');
  }
  if (
    /before.?after|before.?&.?after|transformation|results.?gallery|our.?work/i.test(lower) ||
    /gallery|portfolio|before|after/i.test(
      $('a[href], img[alt]')
        .toArray()
        .slice(0, 40)
        .map((el) => `${$(el).attr('href') || ''} ${$(el).attr('alt') || ''}`)
        .join(' ')
    )
  ) {
    signals.push('Gallery');
  }
  if (
    /coolsculpting|morpheus8|inmode|emsculpt|hydrafacial|botox|allergan|juvederm/i.test(lower)
  ) {
    signals.push('Brands');
  }
  if (opts.mobile) signals.push('Mobile');
  else signals.push('No Mobile');
  if (!opts.https) signals.push('Broken');
  if ($('script[type="application/ld+json"]').length > 0) signals.push('Schema');
  if ($('meta[property="og:title"]').length > 0) signals.push('OG');
  return [...new Set(signals)].slice(0, 6);
}

/** Lightweight health score from one HTML fetch (Trojan seed-style, not full SEO/DNS). */
function computeHealth(opts: {
  hasWebsite: boolean;
  https: boolean;
  mobile: boolean;
  copyrightYear: number | null;
  metaPixel: boolean;
  cms: string | null;
  thinContent: boolean;
}): number {
  if (!opts.hasWebsite) return 0;
  let score = 100;
  if (!opts.https) score -= 15;
  if (!opts.mobile) score -= 10;
  const year = new Date().getFullYear();
  if (opts.copyrightYear && opts.copyrightYear < year - 1) score -= 10;
  if (!opts.metaPixel) score -= 20;
  if (opts.thinContent) score -= 15;
  if (!opts.cms) score -= 5;
  return Math.max(0, Math.min(100, score));
}

/** Heuristic site-quality 0–100 for WebEvo column (not a real WebEvo pro scan). */
function computeWebEvoProxy(opts: {
  hasWebsite: boolean;
  https: boolean;
  mobile: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  hasH1: boolean;
  hasSchema: boolean;
  hasOg: boolean;
  copyrightYear: number | null;
  cms: string | null;
}): number | null {
  if (!opts.hasWebsite) return null;
  let score = 40;
  if (opts.https) score += 12;
  if (opts.mobile) score += 10;
  if (opts.hasTitle) score += 8;
  if (opts.hasDescription) score += 8;
  if (opts.hasH1) score += 6;
  if (opts.hasSchema) score += 6;
  if (opts.hasOg) score += 5;
  if (opts.cms) score += 5;
  const year = new Date().getFullYear();
  if (opts.copyrightYear && opts.copyrightYear >= year - 1) score += 5;
  else if (opts.copyrightYear && opts.copyrightYear < year - 3) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type ScrapeIntelContext = {
  reviewCount?: number | null;
  reviewRating?: number | null;
};

/**
 * Website scraper for talking-point hooks + Quick Intel fields.
 * Single fetch — no multi-phase leadgen.
 */
export async function scrapeWebsiteHooks(
  url: string,
  ctx: ScrapeIntelContext = {}
): Promise<WebsiteHooks> {
  let normalized = url.trim();
  if (!normalized) {
    return { hooks: [], hasWebsite: false, intel: { hasWebsite: false, health: 0, score: 0 } };
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  const https = /^https:/i.test(normalized);

  try {
    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ColdCallRepsBot/1.0; +https://coldcallreps.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!res.ok) {
      const health = computeHealth({
        hasWebsite: true,
        https,
        mobile: false,
        copyrightYear: null,
        metaPixel: false,
        cms: null,
        thinContent: true,
      });
      const intel: ProspectIntel = {
        hasWebsite: true,
        https,
        health,
        webEvoScore: Math.max(10, health - 20),
        score: computeTrojanScore(ctx.reviewCount, health, ctx.reviewRating),
        signals: ['Broken', `HTTP ${res.status}`],
      };
      return {
        hooks: [`Site returned HTTP ${res.status} — possible broken or slow website.`],
        hasWebsite: true,
        intel,
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim() || undefined;
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      undefined;

    const headlines: string[] = [];
    $('h1, h2').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && t.length > 8 && t.length < 120) headlines.push(t);
    });

    const emailSet = new Set<string>();
    const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
    for (const m of mailto) {
      const e = m.replace(/^mailto:/i, '').toLowerCase();
      if (!e.includes('example.') && !e.includes('sentry.')) emailSet.add(e);
    }
    const bareEmails =
      html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const e of bareEmails.slice(0, 20)) {
      const low = e.toLowerCase();
      if (
        low.includes('example.') ||
        low.includes('sentry.') ||
        low.includes('wixpress') ||
        low.endsWith('.png') ||
        low.endsWith('.jpg')
      ) {
        continue;
      }
      emailSet.add(low);
    }
    const emails = [...emailSet].slice(0, 5);

    const phoneSet = new Set<string>();
    const tel = html.match(/tel:([+\d()\s.-]{7,})/gi) || [];
    for (const t of tel) {
      const p = t.replace(/^tel:/i, '').trim();
      if (p.replace(/\D/g, '').length >= 7) phoneSet.add(p);
    }
    const phones = [...phoneSet].slice(0, 5);

    const cms = detectCms(html, $);
    const copyrightYear = detectCopyrightYear(html, $);
    const booking = detectBooking(html);
    const mobile = Boolean($('meta[name="viewport"]').attr('content'));
    const signals = detectSignals(html, $, { booking, mobile, https });
    const metaPixel = signals.includes('Meta PI');
    const thinContent = !title && !description && headlines.length === 0;

    const health = computeHealth({
      hasWebsite: true,
      https,
      mobile,
      copyrightYear,
      metaPixel,
      cms,
      thinContent,
    });
    const webEvoScore = computeWebEvoProxy({
      hasWebsite: true,
      https,
      mobile,
      hasTitle: Boolean(title),
      hasDescription: Boolean(description),
      hasH1: $('h1').length > 0,
      hasSchema: signals.includes('Schema'),
      hasOg: signals.includes('OG'),
      copyrightYear,
      cms,
    });
    const score = computeTrojanScore(ctx.reviewCount, health, ctx.reviewRating);

    const intel: ProspectIntel = {
      hasWebsite: true,
      https,
      mobile,
      cms,
      copyrightYear,
      bookingSystem: booking,
      signals,
      health,
      webEvoScore,
      score,
      lastReviewAt: null,
    };

    const hooks: string[] = [];
    if (title) hooks.push(`Site title: "${title}"`);
    if (description) hooks.push(`Meta: "${description.slice(0, 160)}"`);
    for (const h of headlines.slice(0, 4)) {
      hooks.push(`Headline: "${h}"`);
    }
    if (cms) hooks.push(`CMS: ${cms}`);
    if (copyrightYear) hooks.push(`Copyright year: ${copyrightYear}`);
    if (booking) hooks.push(`Booking: ${booking}`);
    for (const s of signals.slice(0, 3)) {
      if (s !== booking) hooks.push(`Signal: ${s}`);
    }
    if (emails[0]) hooks.push(`Contact email on site: ${emails[0]}`);
    if (phones[0]) hooks.push(`Phone on site: ${phones[0]}`);
    if (hooks.length === 0) {
      hooks.push('Website exists but has thin/unclear messaging — easy pitch angle.');
    }

    return { title, description, hooks, hasWebsite: true, emails, phones, intel };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'fetch failed';
    const health = 15;
    return {
      hooks: [`Could not load website (${msg}) — strong "no working site" angle.`],
      hasWebsite: false,
      intel: {
        hasWebsite: false,
        https,
        health,
        webEvoScore: null,
        score: computeTrojanScore(ctx.reviewCount, health, ctx.reviewRating),
        signals: ['Unreachable', 'Broken'],
      },
    };
  }
}
