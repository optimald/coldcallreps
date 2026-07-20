/**
 * IndexNow submission — dry-run first.
 *
 * Submits new, materially updated, or removed public URLs to IndexNow
 * participants (Bing, Yandex, etc.). Submission means "please recrawl", NOT
 * "indexed". See docs/site-ops/search-indexing.md.
 *
 * Usage:
 *   npx tsx scripts/submit-indexnow.ts                      # dry-run: hub + all guides
 *   npx tsx scripts/submit-indexnow.ts --send              # live submit hub + all guides
 *   npx tsx scripts/submit-indexnow.ts --url https://coldcallreps.com/guides/hire-cold-callers --send
 *
 * Required env (.env.local):
 *   INDEXNOW_KEY=<public key>
 *   INDEXNOW_KEY_LOCATION=https://coldcallreps.com/<key>.txt
 *   NEXT_PUBLIC_APP_URL=https://coldcallreps.com
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUIDE_SLUGS } from '../src/lib/guides';
import robots from '../src/app/robots';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local (see docs/site-ops/search-indexing.md).`);
  }
  return value;
}

function parseArgs(argv: string[]) {
  const urls: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url' && argv[i + 1]) {
      urls.push(argv[i + 1]);
      i += 1;
    }
  }
  return { send: argv.includes('--send'), urls };
}

/** Disallowed path prefixes pulled from the app's robots.ts (single source of truth). */
function disallowedPrefixes(): string[] {
  const config = robots();
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
  const out = new Set<string>();
  for (const rule of rules) {
    const dis = rule?.disallow;
    if (!dis) continue;
    for (const p of Array.isArray(dis) ? dis : [dis]) {
      if (p && p !== '/') out.add(p);
    }
  }
  return [...out];
}

function makeUrlValidator(appOrigin: string, disallow: string[]) {
  const expectedHost = new URL(appOrigin).hostname.replace(/^www\./, '');
  return (raw: string): { ok: true; url: string } | { ok: false; reason: string } => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return { ok: false, reason: 'not a valid URL' };
    }
    if (parsed.protocol !== 'https:') return { ok: false, reason: 'not HTTPS' };
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== expectedHost) return { ok: false, reason: `foreign host (${parsed.hostname})` };
    if (disallow.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(prefix))) {
      return { ok: false, reason: `robots-disallowed path (${parsed.pathname})` };
    }
    return { ok: true, url: parsed.toString() };
  };
}

async function verifyKeyLocation(keyLocation: string, key: string): Promise<void> {
  const res = await fetch(keyLocation, { headers: { 'user-agent': 'coldcallreps-indexnow/1.0' } });
  if (!res.ok) {
    throw new Error(`Key file not reachable (HTTP ${res.status}) at ${keyLocation}. Deploy it before --send.`);
  }
  const body = (await res.text()).trim();
  if (body !== key) {
    throw new Error(`Key file at ${keyLocation} does not contain the expected key.`);
  }
}

async function main() {
  const { send, urls: explicitUrls } = parseArgs(process.argv.slice(2));
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
  const key = requireEnv('INDEXNOW_KEY');
  const keyLocation = requireEnv('INDEXNOW_KEY_LOCATION');
  const host = new URL(appOrigin).hostname;

  const disallow = disallowedPrefixes();
  const validate = makeUrlValidator(appOrigin, disallow);

  const candidates = explicitUrls.length
    ? explicitUrls
    : [`${appOrigin}/guides`, ...GUIDE_SLUGS.map((slug) => `${appOrigin}/guides/${slug}`)];

  const accepted: string[] = [];
  const rejected: { url: string; reason: string }[] = [];
  for (const candidate of candidates) {
    const result = validate(candidate);
    if (result.ok) accepted.push(result.url);
    else rejected.push({ url: candidate, reason: result.reason });
  }

  console.log(`IndexNow endpoint: ${INDEXNOW_ENDPOINT}`);
  console.log(`Host: ${host}`);
  console.log(`Mode: ${send ? 'LIVE (--send)' : 'dry-run (default)'}`);
  console.log(`Accepted URLs (${accepted.length}):`);
  for (const url of accepted) console.log(`  + ${url}`);
  if (rejected.length) {
    console.log(`Rejected URLs (${rejected.length}):`);
    for (const item of rejected) console.log(`  - ${item.url}  [${item.reason}]`);
  }

  if (accepted.length === 0) {
    throw new Error('No valid URLs to submit.');
  }

  const checkedAt = new Date().toISOString();
  const runId = `run-${checkedAt.replace(/[:.]/g, '-')}`;
  const runDir = resolve(process.cwd(), 'reports/site-ops', runId);

  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let submitted = false;

  if (send) {
    await verifyKeyLocation(keyLocation, key);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': 'coldcallreps-indexnow/1.0' },
      body: JSON.stringify({ host, key, keyLocation, urlList: accepted }),
    });
    httpStatus = res.status;
    responseBody = (await res.text()) || null;
    submitted = res.ok;
    console.log(`Submission HTTP status: ${httpStatus}`);
    console.log('Accepted submission means "please recrawl", NOT "indexed".');
  } else {
    console.log('\nDry-run only. Re-run with --send to POST these URLs.');
  }

  const report = {
    runId,
    checkedAt,
    endpoint: INDEXNOW_ENDPOINT,
    host,
    keyLocation,
    mode: send ? 'send' : 'dry-run',
    submittedUrls: accepted,
    rejectedUrls: rejected,
    httpStatus,
    responseBody,
    submitted,
    notes: [
      'Accepted submission is "submitted", not "indexed".',
      'Only submit new, materially updated, or removed URLs. Do not blast unchanged pages.',
    ],
  };

  if (send) {
    if (existsSync(runDir)) throw new Error(`Refusing to overwrite existing run: ${runDir}`);
    mkdirSync(runDir, { recursive: true });
    const outPath = resolve(runDir, 'indexnow-submission.json');
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${outPath}`);
    if (!submitted) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
