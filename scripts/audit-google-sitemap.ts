/**
 * Read-only Google Search Console + live sitemap audit.
 *
 * Usage:
 *   npx tsx scripts/audit-google-sitemap.ts
 *   npx tsx scripts/audit-google-sitemap.ts --inspect
 *   npx tsx scripts/audit-google-sitemap.ts --submit-sitemap
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';
import { GUIDE_SLUGS } from '../src/lib/guides';

function loadEnvLocal() {
  const loadEnvFile = (process as NodeJS.Process & {
    loadEnvFile?: (path: string) => void;
  }).loadEnvFile;
  if (typeof loadEnvFile !== 'function') return;
  for (const name of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    try {
      loadEnvFile(path);
    } catch {
      /* ignore */
    }
  }
}

loadEnvLocal();

type Status = 'pass' | 'partial' | 'fail' | 'blocked';

interface BlockedCheck {
  checkId: string;
  reason: string;
  needed: string;
}

interface InspectionRow {
  url: string;
  status: Status;
  coverageState: string | null;
  indexStatusVerdict: string | null;
  lastCrawlTime: string | null;
  pageFetchState: string | null;
  robotsTxtState: string | null;
  error: string | null;
}

function parseArgs(argv: string[]) {
  return {
    inspect: argv.includes('--inspect'),
    submitSitemap: argv.includes('--submit-sitemap'),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local (see docs/site-ops/search-indexing.md).`);
  }
  return value;
}

function resolveCredentialsPath(raw: string): string {
  return resolve(process.cwd(), raw);
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  for (const match of xml.matchAll(re)) locs.push(match[1].trim());
  return locs;
}

function hostAllowed(url: string, expectedHost: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === expectedHost || parsed.hostname === `www.${expectedHost}`);
  } catch {
    return false;
  }
}

async function main() {
  const { inspect, submitSitemap } = parseArgs(process.argv.slice(2));
  const credentialsPath = resolveCredentialsPath(requireEnv('GOOGLE_APPLICATION_CREDENTIALS'));
  const siteUrl = requireEnv('GSC_SITE_URL');
  const sitemapUrl = requireEnv('GSC_SITEMAP_URL');
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
  const expectedHost = new URL(appOrigin).hostname.replace(/^www\./, '');

  if (!existsSync(credentialsPath)) {
    throw new Error(
      `Credentials file not found at ${credentialsPath}. Copy the service-account JSON there first.`,
    );
  }

  const checkedAt = new Date().toISOString();
  const runId = `run-${checkedAt.replace(/[:.]/g, '-')}`;
  const runDir = resolve(process.cwd(), 'reports/site-ops', runId);
  if (existsSync(runDir)) throw new Error(`Refusing to overwrite existing run: ${runDir}`);
  mkdirSync(runDir, { recursive: true });

  const blockedChecks: BlockedCheck[] = [];
  const requiredGuideUrls = [
    `${appOrigin}/guides`,
    ...GUIDE_SLUGS.map((slug) => `${appOrigin}/guides/${slug}`),
  ];

  const liveRes = await fetch(sitemapUrl, {
    headers: { 'user-agent': 'coldcallreps-site-ops-audit/1.0' },
  });
  if (!liveRes.ok) {
    throw new Error(`Live sitemap fetch failed: HTTP ${liveRes.status} for ${sitemapUrl}`);
  }
  const liveXml = await liveRes.text();
  if (!/<urlset[\s>]/i.test(liveXml) && !/<sitemapindex[\s>]/i.test(liveXml)) {
    throw new Error('Live sitemap response did not look like valid sitemap XML.');
  }

  const liveUrls = extractLocs(liveXml);
  const foreignHostUrls = liveUrls.filter((url) => !hostAllowed(url, expectedHost));
  const normalizedLive = new Set(liveUrls.map((url) => url.replace(/\/$/, '')));
  const missingGuideUrls = requiredGuideUrls.filter(
    (url) => !normalizedLive.has(url.replace(/\/$/, '')),
  );

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  let searchConsole: {
    status: Status;
    submitted: boolean;
    errors: number | null;
    warnings: number | null;
    lastSubmitted: string | null;
    lastDownloaded: string | null;
    contents: unknown;
    submitResult: string | null;
  } = {
    status: 'blocked',
    submitted: false,
    errors: null,
    warnings: null,
    lastSubmitted: null,
    lastDownloaded: null,
    contents: null,
    submitResult: null,
  };

  try {
    if (submitSitemap) {
      await searchconsole.sitemaps.submit({ siteUrl, feedpath: sitemapUrl });
      searchConsole.submitResult = 'submitted';
      console.log(`Submitted sitemap to Search Console: ${sitemapUrl}`);
    }

    const listed = await searchconsole.sitemaps.list({ siteUrl });
    const match =
      listed.data.sitemap?.find((item) => item.path === sitemapUrl) ??
      listed.data.sitemap?.find((item) => (item.path || '').includes('sitemap.xml')) ??
      null;

    if (!match) {
      searchConsole = {
        ...searchConsole,
        status: submitSitemap ? 'partial' : 'fail',
        submitted: false,
        submitResult: searchConsole.submitResult,
      };
      blockedChecks.push({
        checkId: 'gsc-sitemap-listed',
        reason: submitSitemap
          ? 'Sitemap submit succeeded, but the property has not yet listed the feed.'
          : 'Sitemap is not listed on this Search Console property.',
        needed: submitSitemap
          ? 'Re-run the audit in a few minutes, or confirm the property URL matches production.'
          : 'Run with --submit-sitemap after confirming GSC_SITE_URL and service-account access.',
      });
    } else {
      const errors = Number(match.errors ?? 0);
      const warnings = Number(match.warnings ?? 0);
      searchConsole = {
        status: errors > 0 ? 'fail' : warnings > 0 ? 'partial' : 'pass',
        submitted: true,
        errors,
        warnings,
        lastSubmitted: match.lastSubmitted ?? null,
        lastDownloaded: match.lastDownloaded ?? null,
        contents: match.contents ?? null,
        submitResult: searchConsole.submitResult,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    searchConsole = {
      ...searchConsole,
      status: 'blocked',
      submitResult: submitSitemap ? `submit_error: ${message}` : searchConsole.submitResult,
    };
    blockedChecks.push({
      checkId: 'gsc-sitemaps-api',
      reason: message,
      needed:
        'Confirm Search Console API is enabled and the service-account email is a user on GSC_SITE_URL.',
    });
  }

  const inspections: InspectionRow[] = [];
  if (inspect) {
    const sample = requiredGuideUrls.slice(0, 5);
    for (const url of sample) {
      try {
        const result = await searchconsole.urlInspection.index.inspect({
          requestBody: {
            inspectionUrl: url,
            siteUrl,
          },
        });
        const indexStatus = result.data.inspectionResult?.indexStatusResult;
        inspections.push({
          url,
          status: 'pass',
          coverageState: indexStatus?.coverageState ?? null,
          indexStatusVerdict: indexStatus?.verdict ?? null,
          lastCrawlTime: indexStatus?.lastCrawlTime ?? null,
          pageFetchState: indexStatus?.pageFetchState ?? null,
          robotsTxtState: indexStatus?.robotsTxtState ?? null,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        inspections.push({
          url,
          status: 'blocked',
          coverageState: null,
          indexStatusVerdict: null,
          lastCrawlTime: null,
          pageFetchState: null,
          robotsTxtState: null,
          error: message,
        });
        blockedChecks.push({
          checkId: `url-inspection:${url}`,
          reason: message,
          needed: 'URL Inspection permission/quota, or re-run without --inspect.',
        });
      }
    }
  }

  const report = {
    runId,
    checkedAt,
    siteUrl,
    sitemapUrl,
    liveUrlCount: liveUrls.length,
    requiredGuideUrls,
    missingGuideUrls,
    foreignHostUrls,
    searchConsole,
    inspections,
    blockedChecks,
    notes: [
      'Submission and inspection do not guarantee indexing.',
      'Google Indexing API must not be used for ordinary marketing or guide pages.',
    ],
  };

  const outPath = resolve(runDir, 'google-sitemap-audit.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Audit complete: ${outPath}`);
  console.log(`Live sitemap URLs: ${liveUrls.length}`);
  console.log(`Missing guide URLs: ${missingGuideUrls.length}`);
  console.log(`Search Console status: ${searchConsole.status}`);
  if (missingGuideUrls.length) {
    for (const url of missingGuideUrls) console.log(`  missing: ${url}`);
  }
  if (blockedChecks.length) {
    console.log(`Blocked checks: ${blockedChecks.length}`);
    for (const item of blockedChecks) console.log(`  ${item.checkId}: ${item.reason}`);
  }

  if (missingGuideUrls.length || foreignHostUrls.length || searchConsole.status === 'fail') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
