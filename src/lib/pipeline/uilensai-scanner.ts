/**
 * UILensAI scanner — wraps @optimald/uilensai (same engine as Trojan WebEvo).
 *
 * Lazy-loaded via createRequire so Next/Webpack cannot statically bundle the
 * worker package. Runs outside the P1→P2→P3 phone chain (opt-in Phase 4).
 *
 * Env:
 *   OPENROUTER_API_KEY
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_BR_API_TOKEN
 *   GOOGLE_PSI_API_KEY (optional — Lighthouse/performance)
 */

import { createRequire } from 'module';
import path from 'path';

let _analyzeWebsite: ((opts: Record<string, unknown>) => Promise<Record<string, unknown>>) | null =
  null;
let _generateReport:
  | ((analysis: Record<string, unknown>, opts: Record<string, unknown>) => Promise<Record<string, unknown>>)
  | null = null;

function loadUilensai() {
  if (_analyzeWebsite) return;
  const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const workerDir = path.dirname(
    nodeRequire.resolve('@optimald/uilensai/packages/worker/uilensai')
  );
  const analyze = nodeRequire(path.join(workerDir, 'analyze'));
  const report = nodeRequire(path.join(workerDir, 'report'));
  _analyzeWebsite = analyze.analyzeWebsite;
  _generateReport = report.generateReport;
}

export type ScanOptions = {
  tier?: 'Basic' | 'Pro' | 'Enterprise';
  depth?: 'basic' | 'advanced' | 'comprehensive';
  modules?: string[];
  verbose?: boolean;
  moduleConcurrency?: number;
  timeoutMs?: number;
};

export type ScanResult = {
  success: boolean;
  url: string;
  overallScore: number;
  uiScore: number | null;
  performanceScore: number | null;
  seoScore: number | null;
  securityScore: number | null;
  privacyScore: number | null;
  compatibilityScore: number | null;
  marketingScore: number | null;
  conversionScore: number | null;
  accessibilityScore: number | null;
  siteHealthScore: number | null;
  overallRating: string | null;
  industryDetected: string | null;
  industryConfidence: number | null;
  report: Record<string, unknown> | null;
  error?: string;
  durationMs: number;
  costEstimated: number;
  screenshotUrls: { viewport: string; url: string }[] | null;
};

const ALL_MODULES = [
  'ui',
  'performance',
  'seoContent',
  'security',
  'privacy',
  'compatibility',
  'marketing',
  'conversion',
  'accessibility',
  'siteHealth',
];

function extractModuleScore(
  analysisResult: Record<string, unknown>,
  moduleName: string
): number | null {
  const modules = analysisResult?.modules as
    | Record<string, { summary?: { score?: number }; usage?: { fallbackUsed?: boolean } }>
    | undefined;
  const mod = modules?.[moduleName];
  if (mod?.usage?.fallbackUsed === true) return null;
  if (mod?.summary?.score != null && !Number.isNaN(Number(mod.summary.score))) {
    return Math.round(Number(mod.summary.score));
  }
  return null;
}

function extractScreenshotUrls(
  analysisResult: Record<string, unknown>
): { viewport: string; url: string }[] | null {
  const results: { viewport: string; url: string }[] = [];
  const seen = new Set<string>();
  const ui = (analysisResult?.modules as Record<string, unknown> | undefined)?.ui as
    | { screenshots?: { items?: { path?: string; viewport?: string }[] } }
    | undefined;
  const items = ui?.screenshots?.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item?.path) continue;
      if (item.path.startsWith('/tmp/') || item.path.startsWith('/var/')) continue;
      const vp = item.viewport || 'unknown';
      results.push({ viewport: vp, url: item.path });
      seen.add(vp);
    }
  }
  return results.length > 0 ? results : null;
}

export function uilensaiConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.OPENROUTER_API_KEY?.trim()) missing.push('OPENROUTER_API_KEY');
  if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!process.env.CLOUDFLARE_BR_API_TOKEN?.trim()) missing.push('CLOUDFLARE_BR_API_TOKEN');
  return { ok: missing.length === 0, missing };
}

export async function scanWebsite(url: string, options: ScanOptions = {}): Promise<ScanResult> {
  const startMs = Date.now();
  loadUilensai();
  if (!_analyzeWebsite) {
    return {
      success: false,
      url,
      overallScore: 0,
      uiScore: null,
      performanceScore: null,
      seoScore: null,
      securityScore: null,
      privacyScore: null,
      compatibilityScore: null,
      marketingScore: null,
      conversionScore: null,
      accessibilityScore: null,
      siteHealthScore: null,
      overallRating: null,
      industryDetected: null,
      industryConfidence: null,
      report: null,
      error: 'UILensAI failed to load',
      durationMs: Date.now() - startMs,
      costEstimated: 0,
      screenshotUrls: null,
    };
  }

  const {
    tier = 'Basic',
    depth: analysisDepth = 'basic',
    modules = ALL_MODULES,
    verbose = false,
    moduleConcurrency = 3,
    timeoutMs = 5 * 60 * 1000,
  } = options;

  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const analysisResult = (await Promise.race([
      _analyzeWebsite({
        url: normalizedUrl,
        page: null,
        browser: null,
        modulesToRun: modules,
        tier,
        analysisDepth,
        captureOptions: {
          viewports: ['desktop', 'tablet', 'mobile'],
          captureFullPage: true,
          captureStealthLevel: 'basic',
          captureDisableAnimations: true,
          captureTimeout: 60_000,
        },
        cfScreenshots: true,
        intelligentBotProtection: true,
        verbose,
        moduleConcurrency,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Scan timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ])) as Record<string, unknown>;

    const uiScore = extractModuleScore(analysisResult, 'ui');
    const performanceScore = extractModuleScore(analysisResult, 'performance');
    const seoScore = extractModuleScore(analysisResult, 'seoContent');
    const securityScore = extractModuleScore(analysisResult, 'security');
    const privacyScore = extractModuleScore(analysisResult, 'privacy');
    const compatibilityScore = extractModuleScore(analysisResult, 'compatibility');
    const marketingScore = extractModuleScore(analysisResult, 'marketing');
    const conversionScore = extractModuleScore(analysisResult, 'conversion');
    const accessibilityScore = extractModuleScore(analysisResult, 'accessibility');
    let siteHealthScore = extractModuleScore(analysisResult, 'siteHealth');
    if (siteHealthScore == null) {
      const fallback = [performanceScore, securityScore, accessibilityScore].filter(
        (s): s is number => s != null
      );
      siteHealthScore =
        fallback.length > 0
          ? Math.round(fallback.reduce((a, b) => a + b, 0) / fallback.length)
          : null;
    }

    const scores = [
      uiScore,
      performanceScore,
      seoScore,
      securityScore,
      privacyScore,
      compatibilityScore,
      marketingScore,
      conversionScore,
      accessibilityScore,
      siteHealthScore,
    ].filter((s): s is number => s != null);
    const overallScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    let report: Record<string, unknown> | null = null;
    try {
      if (_generateReport) {
        report = await _generateReport(analysisResult, {
          url: normalizedUrl,
          tier,
          testParameters: { analysisDepth },
        });
      }
    } catch {
      /* non-fatal */
    }

    const adminMeta = analysisResult?._adminMeta as { totalCostUSD?: number } | undefined;
    const industryContext = analysisResult?.industryContext as
      | { primaryIndustry?: string; confidence?: number }
      | undefined;

    let overallRating =
      (analysisResult?.overallRating as string | undefined) ||
      (overallScore >= 80
        ? 'Excellent'
        : overallScore >= 60
          ? 'Good'
          : overallScore >= 40
            ? 'Fair'
            : overallScore > 0
              ? 'Poor'
              : null);

    return {
      success: true,
      url: normalizedUrl,
      overallScore,
      uiScore,
      performanceScore,
      seoScore,
      securityScore,
      privacyScore,
      compatibilityScore,
      marketingScore,
      conversionScore,
      accessibilityScore,
      siteHealthScore,
      overallRating,
      industryDetected: industryContext?.primaryIndustry || null,
      industryConfidence: industryContext?.confidence ?? null,
      report,
      durationMs:
        (analysisResult?.analysisDurationMs as number | undefined) || Date.now() - startMs,
      costEstimated: adminMeta?.totalCostUSD ?? 0,
      screenshotUrls: extractScreenshotUrls(analysisResult),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[uilensai] scan failed:', errMsg);
    return {
      success: false,
      url,
      overallScore: 0,
      uiScore: null,
      performanceScore: null,
      seoScore: null,
      securityScore: null,
      privacyScore: null,
      compatibilityScore: null,
      marketingScore: null,
      conversionScore: null,
      accessibilityScore: null,
      siteHealthScore: null,
      overallRating: null,
      industryDetected: null,
      industryConfidence: null,
      report: null,
      error: errMsg,
      durationMs: Date.now() - startMs,
      costEstimated: 0,
      screenshotUrls: null,
    };
  }
}
