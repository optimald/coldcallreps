/**
 * Resolve a brand logo from a company website URL.
 * Prefers Logo.dev when LOGO_DEV_PUBLISHABLE_KEY is set; otherwise scrapes
 * common icon / OG tags, then falls back to Google's favicon CDN.
 */

export function normalizeWebsiteUrl(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname || u.hostname === 'localhost') return null;
    u.hash = '';
    return u.toString().replace(/\/$/, '') || null;
  } catch {
    return null;
  }
}

export function hostnameFromWebsite(websiteUrl: string): string | null {
  const normalized = normalizeWebsiteUrl(websiteUrl);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractIconCandidates(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const push = (href: string | undefined | null) => {
    if (!href) return;
    const abs = absolutize(href.trim(), baseUrl);
    if (abs && /^https?:\/\//i.test(abs)) out.push(abs);
  };

  const og =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
  push(og?.[1]);

  const apple = [
    ...html.matchAll(
      /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi
    ),
    ...html.matchAll(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/gi
    ),
  ];
  for (const m of apple) push(m[1]);

  const icons = [
    ...html.matchAll(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/gi),
    ...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/gi),
  ];
  for (const m of icons) push(m[1]);

  return [...new Set(out)];
}

function logoDevUrl(host: string): string | null {
  const token =
    process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim();
  if (!token) return null;
  return `https://img.logo.dev/${encodeURIComponent(host)}?token=${encodeURIComponent(token)}&size=128&format=png`;
}

function googleFaviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

/**
 * Best-effort logo URL for a company website. Safe to call from API routes.
 * Never throws — returns null only when the website URL is invalid.
 */
export async function resolveBrandLogoFromWebsite(
  websiteUrl: string
): Promise<string | null> {
  const normalized = normalizeWebsiteUrl(websiteUrl);
  const host = hostnameFromWebsite(websiteUrl);
  if (!normalized || !host) return null;

  const fromLogoDev = logoDevUrl(host);
  if (fromLogoDev) return fromLogoDev.slice(0, 500);

  try {
    const res = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'ColdCallRepsBrandBot/1.0 (+https://coldcallreps.com)',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const html = (await res.text()).slice(0, 180_000);
      const candidates = extractIconCandidates(html, res.url || normalized);
      const preferred =
        candidates.find((u) => /apple-touch|og:|png|svg|jpg|jpeg|webp/i.test(u)) ||
        candidates[0];
      if (preferred) return preferred.slice(0, 500);
    }
  } catch {
    /* fall through */
  }

  return googleFaviconUrl(host).slice(0, 500);
}
