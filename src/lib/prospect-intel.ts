/**
 * Quick Intel payload stored inside Prospect.hooksJSON.
 *
 * Legacy: JSON string[] of talking points.
 * v2: { v: 2, hooks: string[], intel: ProspectIntel }
 *
 * Field map (Trojan SalesLeadsView → CCR):
 *   digitalGravityScore → intel.score ("Trojan")
 *   siteHealthScore     → intel.health
 *   siteScore           → intel.webEvoScore (heuristic HTML proxy only; Phase 4 WebEvo removed)
 *   copyrightYear       → intel.copyrightYear ("© Year")
 *   cmsUsed             → intel.cms
 *   LeadSignals pills   → intel.signals[]
 *   lastGoogleReviewDate→ intel.lastReviewAt (rarely set; Maps API has no last-review date)
 *   googleReviewRating/Count stay on Prospect columns (not in intel)
 *
 * Real vs heuristic (1-step enrich):
 *   REAL: CMS detect, © year, HTTPS, viewport/mobile, booking, pixels/GA/ads/schema/OG,
 *         review rating/count (from Maps on Prospect), talking-point hooks
 *   HEURISTIC: health, score (Trojan), webEvoScore — lightweight HTML signals only
 *   UNAVAILABLE in 1-step: DNS/SEO full health, lastGoogleReviewDate
 */

export type ProspectIntel = {
  /** digitalGravityScore proxy — Trojan column. */
  score?: number | null;
  /** siteHealthScore proxy — Health column. */
  health?: number | null;
  /** Site quality score — heuristic HTML proxy (Phase 4 WebEvo removed). */
  webEvoScore?: number | null;
  /** Always 'heuristic' after Phase 4 purge; legacy 'uilensai' may remain in stored JSON. */
  webEvoSource?: 'uilensai' | 'heuristic' | null;
  /** Excellent | Good | Fair | Poor (legacy UILensAI; heuristic may omit). */
  webEvoRating?: string | null;
  /** Module scores (legacy UILensAI storage; optional). */
  webEvoModules?: {
    ui?: number | null;
    performance?: number | null;
    seo?: number | null;
    security?: number | null;
    privacy?: number | null;
    compatibility?: number | null;
    marketing?: number | null;
    conversion?: number | null;
    accessibility?: number | null;
    siteHealth?: number | null;
  } | null;
  /** Screenshots by viewport (legacy captures may remain). */
  screenshots?: { viewport: string; url: string }[] | null;
  /** Trojan copyrightYear (footer ©), not founding year. */
  copyrightYear?: number | null;
  /** cmsUsed */
  cms?: string | null;
  /** Derived signal pills (Meta Pixel, Gallery, Mobile, …). */
  signals?: string[];
  /** lastGoogleReviewDate ISO — usually null without OpenClaw-style backfill. */
  lastReviewAt?: string | null;
  https?: boolean | null;
  mobile?: boolean | null;
  bookingSystem?: string | null;
  hasWebsite?: boolean | null;
  /** Geo / Maps */
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  /** Google Business Profile-ish */
  googleCategory?: string | null;
  googlePhone?: string | null;
  googleMapsUrl?: string | null;
  openingHours?: string | null;
};

export type HooksPayloadV2 = {
  v: 2;
  hooks: string[];
  intel: ProspectIntel;
};

export function parseHooks(hooksJSON?: string | null): string[] {
  if (!hooksJSON) return [];
  try {
    const parsed = JSON.parse(hooksJSON);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.hooks)) {
      return parsed.hooks.map(String);
    }
    return [];
  } catch {
    return [];
  }
}

export function parseIntel(hooksJSON?: string | null): ProspectIntel | null {
  if (!hooksJSON) return null;
  try {
    const parsed = JSON.parse(hooksJSON);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.intel) {
      return parsed.intel as ProspectIntel;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeHooksPayload(hooks: string[], intel?: ProspectIntel | null): string {
  if (!intel || Object.keys(intel).length === 0) {
    return JSON.stringify(hooks);
  }
  const payload: HooksPayloadV2 = { v: 2, hooks, intel };
  return JSON.stringify(payload);
}

/**
 * Trojan-style composite (0–100-ish).
 * Blends Maps reputation (log reviews + star rating) with site health from the HTML scrape.
 */
export function computeTrojanScore(
  reviewCount: number | null | undefined,
  health: number,
  reviewRating?: number | null
): number {
  const reviews = Math.max(0, reviewCount || 0);
  const rating = Math.max(0, Math.min(5, reviewRating || 0));
  const reviewWeight = (Math.min(Math.log10(reviews + 1), 3.0) / 3.0) * 45;
  const ratingWeight = (rating / 5.0) * 25;
  const techWeight = (health / 100) * 30;
  return Math.round((reviewWeight + ratingWeight + techWeight) * 100) / 100;
}

/** CSS modifier for signal pills (colored tags like Trojan LeadSignals). */
export function signalTone(label: string): 'meta' | 'ads' | 'book' | 'warn' | 'ok' | 'bad' | 'muted' {
  const s = label.toLowerCase();
  if (s.includes('meta')) return 'meta';
  if (s.includes('google ads') || s === 'ga') return 'ads';
  if (
    s.includes('calendly') ||
    s.includes('acuity') ||
    s.includes('mindbody') ||
    s.includes('vagaro') ||
    s.includes('boulevard') ||
    s.includes('jane') ||
    s.includes('setmore') ||
    s.includes('book')
  ) {
    return 'book';
  }
  if (s.includes('gallery') || s.includes('brands')) return 'warn';
  if (s.includes('broken') || s.includes('unreachable') || s.includes('http ') || s.includes('no mobile') || s.includes('no website')) {
    return 'bad';
  }
  if (s.includes('mobile') || s.includes('schema') || s.includes('chat')) return 'ok';
  return 'muted';
}

/** Letter grade bands matching Trojan getGrade (WebEvoReportViewer). */
export function getGrade(score: number | null | undefined): { grade: string; tone: 'ok' | 'mid' | 'warn' | 'bad' | 'muted' } {
  if (score == null) return { grade: '—', tone: 'muted' };
  if (score >= 90) return { grade: score >= 97 ? 'A+' : score >= 93 ? 'A' : 'A-', tone: 'ok' };
  if (score >= 80) return { grade: score >= 87 ? 'B+' : score >= 83 ? 'B' : 'B-', tone: 'ok' };
  if (score >= 70) return { grade: score >= 77 ? 'C+' : score >= 73 ? 'C' : 'C-', tone: 'mid' };
  if (score >= 60) return { grade: score >= 67 ? 'D+' : score >= 63 ? 'D' : 'D-', tone: 'warn' };
  return { grade: 'F', tone: 'bad' };
}

export function healthTone(score: number | null | undefined): 'ok' | 'mid' | 'bad' | 'muted' {
  if (score == null || score <= 0) return 'muted';
  if (score >= 75) return 'ok';
  if (score >= 50) return 'mid';
  return 'bad';
}

export function scoreTone(score: number | null | undefined): 'ok' | 'mid' | 'bad' | 'muted' {
  if (score == null) return 'muted';
  if (score >= 70) return 'ok';
  if (score >= 40) return 'mid';
  return 'bad';
}

export function formatRelativeReview(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 0) return null;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function modScore(h: number, shift: number, base: number, span: number) {
  return base + ((h >> shift) % span);
}

/**
 * Demo enrichment vitals when training hooks are still a legacy string[].
 * Matches Lead Detail so Practice Lead Intel shows the same enrichment surface.
 */
export function synthesizeTrainingIntel(p: {
  companyName?: string | null;
  website?: string | null;
  phone?: string | null;
}): ProspectIntel {
  const name = String(p.companyName || 'x');
  const h = hashName(name);
  const health = 55 + (h % 35);
  const webEvo = 40 + ((h >> 3) % 50);
  const score = 50 + ((h >> 5) % 40);
  const lat = Math.round((41.88 + ((h % 100) - 50) * 0.001) * 10000) / 10000;
  const lon = Math.round((-87.63 + (((h >> 4) % 100) - 50) * 0.001) * 10000) / 10000;
  const company = String(p.companyName || 'Business');
  const phone = String(p.phone || '(312) 555-0142');
  const streetNo = 100 + (h % 800);
  const label = encodeURIComponent(company.slice(0, 18) || 'Site');

  return {
    hasWebsite: Boolean(p.website),
    https: true,
    mobile: true,
    health,
    webEvoScore: webEvo,
    webEvoSource: 'heuristic',
    score,
    cms: ['Webflow', 'WordPress', 'HubSpot CMS', 'Next.js'][h % 4],
    copyrightYear: 2019 + (h % 6),
    bookingSystem: h % 3 === 0 ? 'Calendly' : null,
    signals: [
      'Mobile',
      h % 2 === 0 ? 'Schema' : 'OG',
      h % 3 === 0 ? 'Meta Pixel' : 'GA',
      h % 4 === 0 ? 'Calendly' : 'Chat',
    ],
    lastReviewAt: new Date(Date.now() - ((h % 90) + 5) * 86400000).toISOString(),
    latitude: lat,
    longitude: lon,
    address: `${streetNo} W Madison St`,
    googleCategory: [
      'Marketing Agency',
      'Business Consultant',
      'Software Company',
      'Advertising Agency',
    ][h % 4],
    googlePhone: phone,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    openingHours: 'Mon–Fri 9:00 AM – 6:00 PM',
    webEvoModules: {
      ui: modScore(h, 1, 45, 50),
      performance: modScore(h, 2, 40, 55),
      seo: modScore(h, 3, 35, 55),
      security: modScore(h, 4, 50, 45),
      privacy: modScore(h, 5, 40, 50),
      compatibility: modScore(h, 6, 55, 40),
      marketing: modScore(h, 7, 30, 60),
      conversion: modScore(h, 8, 35, 55),
      accessibility: modScore(h, 9, 40, 50),
      siteHealth: health,
    },
    screenshots: [
      {
        viewport: 'desktop',
        url: `https://placehold.co/1280x800/1a1a1a/e8e8e8?text=${label}+Desktop`,
      },
      {
        viewport: 'tablet',
        url: `https://placehold.co/768x1024/1a1a1a/e8e8e8?text=${label}+Tablet`,
      },
      {
        viewport: 'mobile',
        url: `https://placehold.co/375x812/1a1a1a/e8e8e8?text=${label}+Mobile`,
      },
    ],
  };
}

/** Prefer stored v2 intel; for training leads, synthesize enrichment vitals. */
export function resolveProspectIntel(
  hooksJSON: string | null | undefined,
  opts?: {
    purpose?: 'training' | 'brand' | string | null;
    companyName?: string | null;
    website?: string | null;
    phone?: string | null;
  }
): ProspectIntel | null {
  const stored = parseIntel(hooksJSON);
  if (stored) return stored;
  if (opts?.purpose === 'training') {
    return synthesizeTrainingIntel({
      companyName: opts.companyName,
      website: opts.website,
      phone: opts.phone,
    });
  }
  return null;
}

