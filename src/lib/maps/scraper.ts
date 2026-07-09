import * as cheerio from 'cheerio';

export interface WebsiteHooks {
  title?: string;
  description?: string;
  hooks: string[];
  hasWebsite: boolean;
}

/**
 * Basic website scraper for personalization hooks.
 * Fetches HTML and extracts title, meta description, and headline-ish text.
 */
export async function scrapeWebsiteHooks(url: string): Promise<WebsiteHooks> {
  let normalized = url.trim();
  if (!normalized) {
    return { hooks: [], hasWebsite: false };
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

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
      return {
        hooks: [`Site returned HTTP ${res.status} — possible broken or slow website.`],
        hasWebsite: true,
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

    const hooks: string[] = [];
    if (title) hooks.push(`Site title: "${title}"`);
    if (description) hooks.push(`Meta: "${description.slice(0, 160)}"`);
    for (const h of headlines.slice(0, 4)) {
      hooks.push(`Headline: "${h}"`);
    }
    if (hooks.length === 0) {
      hooks.push('Website exists but has thin/unclear messaging — easy pitch angle.');
    }

    return { title, description, hooks, hasWebsite: true };
  } catch (err: any) {
    return {
      hooks: [
        `Could not load website (${err?.message || 'fetch failed'}) — strong "no working site" angle.`,
      ],
      hasWebsite: false,
    };
  }
}
