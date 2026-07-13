/**
 * Quick Intel payload stored inside Prospect.hooksJSON.
 *
 * Legacy: JSON string[] of talking points.
 * v2: { v: 2, hooks: string[], intel: ProspectIntel }
 *
 * Field map (Trojan SalesLeadsView → CCR):
 *   digitalGravityScore → intel.score ("Trojan")
 *   siteHealthScore     → intel.health
 *   webevoOverallScore  → intel.webEvoScore (heuristic grade proxy — not uilensai)
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
 *   UNAVAILABLE in 1-step: real WebEvo pro-scan, DNS/SEO full health, lastGoogleReviewDate
 */

export type ProspectIntel = {
  /** digitalGravityScore proxy — Trojan column. */
  score?: number | null;
  /** siteHealthScore proxy — Health column. */
  health?: number | null;
  /** webevoOverallScore proxy — letter grade (not real WebEvo). */
  webEvoScore?: number | null;
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
