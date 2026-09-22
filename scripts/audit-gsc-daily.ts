/**
 * Daily GSC performance audit: search analytics + sitemap + URL Inspection.
 *
 * Usage:
 *   npx tsx scripts/audit-gsc-daily.ts
 *   npx tsx scripts/audit-gsc-daily.ts --inspect
 *
 * Auth matches audit-google-sitemap.ts (native JWT + fetch; no googleapis).
 */
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUIDE_SLUGS } from '../src/lib/guides';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GSC_BASE = 'https://searchconsole.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

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

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface AnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local (see docs/site-ops/search-indexing.md).`);
  }
  return value;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = signer.sign(key.private_key).toString('base64url');
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Token exchange failed (HTTP ${res.status}): ${body.error_description || body.error || 'no access_token'}`,
    );
  }
  return body.access_token;
}

async function searchAnalytics(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<AnalyticsRow[]> {
  const url = `${GSC_BASE}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`searchAnalytics.query HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { rows?: AnalyticsRow[] };
  return data.rows ?? [];
}

async function listSitemaps(token: string, siteUrl: string) {
  const url = `${GSC_BASE}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`sitemaps.list HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { sitemap?: Array<Record<string, unknown>> };
  return data.sitemap ?? [];
}

async function inspectUrl(token: string, siteUrl: string, inspectionUrl: string) {
  const url = `${GSC_BASE}/v1/urlInspection/index:inspect`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (!res.ok) throw new Error(`urlInspection HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        coverageState?: string;
        verdict?: string;
        lastCrawlTime?: string;
        pageFetchState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        googleCanonical?: string;
        userCanonical?: string;
      };
    };
  };
}

function mapRow(r: AnalyticsRow, dims: 'totals' | 'query' | 'page' | 'date' | 'country' | 'device' | 'qp') {
  const keys = r.keys || [];
  const base = {
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  };
  if (dims === 'query') return { query: keys[0] || '', ...base };
  if (dims === 'page') return { page: keys[0] || '', ...base };
  if (dims === 'date') return { date: keys[0] || '', ...base };
  if (dims === 'country') return { country: keys[0] || '', ...base };
  if (dims === 'device') return { device: keys[0] || '', ...base };
  if (dims === 'qp') return { query: keys[0] || '', page: keys[1] || '', ...base };
  return base;
}

async function main() {
  const inspect = process.argv.includes('--inspect');
  const credentialsPath = resolve(process.cwd(), requireEnv('GOOGLE_APPLICATION_CREDENTIALS'));
  const siteUrl = requireEnv('GSC_SITE_URL');
  const sitemapUrl = requireEnv('GSC_SITEMAP_URL');
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');

  if (!existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at ${credentialsPath}.`);
  }
  const key = JSON.parse(readFileSync(credentialsPath, 'utf8')) as ServiceAccountKey;
  const token = await getAccessToken(key);

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start28 = new Date(end);
  start28.setUTCDate(start28.getUTCDate() - 27);
  const start90 = new Date(end);
  start90.setUTCDate(start90.getUTCDate() - 89);
  const start28s = ymd(start28);
  const start90s = ymd(start90);
  const ends = ymd(end);

  const [
    totals28,
    totals90,
    queries28,
    queries90,
    pages28,
    pages90,
    queryPage28,
    dates28,
    countries28,
    devices28,
    sitemaps,
  ] = await Promise.all([
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: [] }),
    searchAnalytics(token, siteUrl, { startDate: start90s, endDate: ends, dimensions: [] }),
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: ['query'], rowLimit: 250 }),
    searchAnalytics(token, siteUrl, { startDate: start90s, endDate: ends, dimensions: ['query'], rowLimit: 250 }),
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: ['page'], rowLimit: 100 }),
    searchAnalytics(token, siteUrl, { startDate: start90s, endDate: ends, dimensions: ['page'], rowLimit: 100 }),
    searchAnalytics(token, siteUrl, {
      startDate: start28s,
      endDate: ends,
      dimensions: ['query', 'page'],
      rowLimit: 250,
    }),
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: ['date'] }),
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: ['country'], rowLimit: 50 }),
    searchAnalytics(token, siteUrl, { startDate: start28s, endDate: ends, dimensions: ['device'] }),
    listSitemaps(token, siteUrl),
  ]);

  const liveRes = await fetch(sitemapUrl, {
    headers: { 'user-agent': 'coldcallreps-site-ops-audit/1.0' },
  });
  if (!liveRes.ok) throw new Error(`Live sitemap fetch failed: HTTP ${liveRes.status}`);
  const liveXml = await liveRes.text();
  const liveUrls: string[] = [];
  for (const match of liveXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) liveUrls.push(match[1].trim());

  const inspectTargets = [
    `${appOrigin}/`,
    `${appOrigin}/for/reps`,
    `${appOrigin}/pricing`,
    `${appOrigin}/guides`,
    ...GUIDE_SLUGS.map((slug) => `${appOrigin}/guides/${slug}`),
  ];

  const inspections: Array<Record<string, unknown>> = [];
  if (inspect) {
    for (const inspectionUrl of inspectTargets) {
      try {
        const result = await inspectUrl(token, siteUrl, inspectionUrl);
        const indexStatus = result.inspectionResult?.indexStatusResult;
        inspections.push({
          url: inspectionUrl,
          status: 'pass',
          coverageState: indexStatus?.coverageState ?? null,
          indexStatusVerdict: indexStatus?.verdict ?? null,
          indexingState: indexStatus?.indexingState ?? null,
          lastCrawlTime: indexStatus?.lastCrawlTime ?? null,
          pageFetchState: indexStatus?.pageFetchState ?? null,
          robotsTxtState: indexStatus?.robotsTxtState ?? null,
          googleCanonical: indexStatus?.googleCanonical ?? null,
          userCanonical: indexStatus?.userCanonical ?? null,
          error: null,
        });
      } catch (error) {
        inspections.push({
          url: inspectionUrl,
          status: 'blocked',
          coverageState: null,
          indexStatusVerdict: null,
          indexingState: null,
          lastCrawlTime: null,
          pageFetchState: null,
          robotsTxtState: null,
          googleCanonical: null,
          userCanonical: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const checkedAt = new Date().toISOString();
  const runId = `run-${checkedAt.replace(/[:.]/g, '-')}`;
  const runDir = resolve(process.cwd(), 'reports/site-ops', runId);
  mkdirSync(runDir, { recursive: true });

  const sitemapMatch =
    sitemaps.find((item) => item.path === sitemapUrl) ??
    sitemaps.find((item) => String(item.path || '').includes('sitemap.xml')) ??
    null;

  const report = {
    runId,
    checkedAt,
    mode: 'audit-gsc-daily',
    siteUrl,
    sitemapUrl,
    range28: { start: start28s, end: ends },
    range90: { start: start90s, end: ends },
    totals28: mapRow(totals28[0] || {}, 'totals'),
    totals90: mapRow(totals90[0] || {}, 'totals'),
    queries28: queries28.map((r) => mapRow(r, 'query')),
    queries90: queries90.map((r) => mapRow(r, 'query')),
    pages28: pages28.map((r) => mapRow(r, 'page')),
    pages90: pages90.map((r) => mapRow(r, 'page')),
    queryPage28: queryPage28.map((r) => mapRow(r, 'qp')),
    dates28: dates28.map((r) => mapRow(r, 'date')),
    countries28: countries28.map((r) => mapRow(r, 'country')),
    devices28: devices28.map((r) => mapRow(r, 'device')),
    liveSitemap: {
      urlCount: liveUrls.length,
      urls: liveUrls,
    },
    searchConsoleSitemaps: sitemaps.map((s) => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      lastDownloaded: s.lastDownloaded,
      isPending: s.isPending,
      errors: s.errors,
      warnings: s.warnings,
      contents: s.contents,
    })),
    sitemapMatch,
    inspections,
    notes: [
      'Search Analytics is lagged ~2 days; URL Inspection is a sampled crawl snapshot, not a guarantee of ranking.',
      'Google anonymizes queries below a privacy threshold; disclosed query count can be far below impression count.',
    ],
  };

  const outPath = resolve(runDir, 'gsc-queries.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        runDir,
        totals28: report.totals28,
        totals90: report.totals90,
        queryCount28: report.queries28.length,
        queryCount90: report.queries90.length,
        pageCount28: report.pages28.length,
        liveUrlCount: liveUrls.length,
        sitemapErrors: sitemapMatch ? sitemapMatch.errors : null,
        inspectionCount: inspections.length,
        topQueries: report.queries28.slice(0, 25),
        topPages: report.pages28.slice(0, 20),
        countries: report.countries28,
        devices: report.devices28,
        inspectionSummary: inspections.map((i) => ({
          url: i.url,
          coverageState: i.coverageState,
          lastCrawlTime: i.lastCrawlTime,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
