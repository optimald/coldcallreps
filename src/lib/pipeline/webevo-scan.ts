/**
 * Opt-in WebEvo / UILensAI pro-scan for a Prospect.
 * Does NOT run in the P1→P2→P3 phone orchestrator — call explicitly.
 */

import { prisma } from '@/lib/prisma';
import {
  parseHooks,
  parseIntel,
  serializeHooksPayload,
  type ProspectIntel,
} from '@/lib/prospect-intel';
import { scanWebsite, uilensaiConfigured, type ScanResult } from '@/lib/pipeline/uilensai-scanner';

export type WebevoScanOutcome = {
  prospectId: string;
  success: boolean;
  overallScore: number | null;
  rating: string | null;
  durationMs: number;
  costEstimated: number;
  error?: string;
  missingKeys?: string[];
  scan: ScanResult | null;
};

export async function runWebevoScanForProspect(
  prospectId: string,
  opts?: { force?: boolean }
): Promise<WebevoScanOutcome> {
  const cfg = uilensaiConfigured();
  if (!cfg.ok) {
    return {
      prospectId,
      success: false,
      overallScore: null,
      rating: null,
      durationMs: 0,
      costEstimated: 0,
      error: `UILensAI not configured: missing ${cfg.missing.join(', ')}`,
      missingKeys: cfg.missing,
      scan: null,
    };
  }

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) {
    return {
      prospectId,
      success: false,
      overallScore: null,
      rating: null,
      durationMs: 0,
      costEstimated: 0,
      error: 'Prospect not found',
      scan: null,
    };
  }

  const website = prospect.website?.trim();
  if (!website) {
    return {
      prospectId,
      success: false,
      overallScore: null,
      rating: null,
      durationMs: 0,
      costEstimated: 0,
      error: 'No website on prospect',
      scan: null,
    };
  }

  const existing = parseIntel(prospect.hooksJSON);
  if (existing?.webEvoSource === 'uilensai' && existing.webEvoScore != null && !opts?.force) {
    return {
      prospectId,
      success: true,
      overallScore: existing.webEvoScore,
      rating: existing.webEvoRating || null,
      durationMs: 0,
      costEstimated: 0,
      scan: null,
    };
  }

  const scan = await scanWebsite(website, {
    tier: 'Basic',
    depth: 'basic',
    moduleConcurrency: 3,
    timeoutMs: 5 * 60 * 1000,
  });

  if (!scan.success) {
    return {
      prospectId,
      success: false,
      overallScore: null,
      rating: null,
      durationMs: scan.durationMs,
      costEstimated: scan.costEstimated,
      error: scan.error || 'Scan failed',
      scan,
    };
  }

  const hooks = parseHooks(prospect.hooksJSON);
  const prev = existing || {};
  const intel: ProspectIntel = {
    ...prev,
    hasWebsite: true,
    webEvoScore: scan.overallScore,
    webEvoSource: 'uilensai',
    webEvoRating: scan.overallRating,
    webEvoModules: {
      ui: scan.uiScore,
      performance: scan.performanceScore,
      seo: scan.seoScore,
      security: scan.securityScore,
      privacy: scan.privacyScore,
      compatibility: scan.compatibilityScore,
      marketing: scan.marketingScore,
      conversion: scan.conversionScore,
      accessibility: scan.accessibilityScore,
      siteHealth: scan.siteHealthScore,
    },
    screenshots: scan.screenshotUrls,
    health: scan.siteHealthScore ?? prev.health ?? null,
    score: prev.score ?? scan.overallScore,
    cms: prev.cms,
    copyrightYear: prev.copyrightYear,
    signals: [
      ...(prev.signals || []).filter((s) => !s.startsWith('WebEvo')),
      scan.overallRating ? `WebEvo ${scan.overallRating}` : 'WebEvo scanned',
    ],
  };

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      hooksJSON: serializeHooksPayload(hooks, intel),
      industry: prospect.industry || scan.industryDetected || undefined,
    },
  });

  return {
    prospectId,
    success: true,
    overallScore: scan.overallScore,
    rating: scan.overallRating,
    durationMs: scan.durationMs,
    costEstimated: scan.costEstimated,
    scan,
  };
}
