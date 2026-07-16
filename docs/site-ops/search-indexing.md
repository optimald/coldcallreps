# Search Console Audit and IndexNow Submission

This runbook defines the two indexing-support scripts that may be created for
Cold Call Reps:

- `scripts/audit-google-sitemap.ts` — read-only Google Search Console and sitemap audit.
- `scripts/submit-indexnow.ts` — dry-run-first URL submission to IndexNow participants.

These scripts serve different systems. There is no supported Google “force index”
API for ordinary marketing or guide pages. Google’s Indexing API is limited to
eligible `JobPosting` and livestream `BroadcastEvent` pages. Sitemap submission
and URL Inspection do not guarantee indexing.

## 1. Local credentials

Store the Google service-account key outside version control:

```text
.secrets/google-search-console.json
```

`.secrets/` must remain in `.gitignore`. Configure only `.env.local`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=.secrets/google-search-console.json
GSC_SITE_URL=sc-domain:coldcallreps.com
GSC_SITEMAP_URL=https://coldcallreps.com/sitemap.xml
```

Before the audit can work:

1. Enable the Google Search Console API in the key’s Google Cloud project.
2. Add the service account’s `client_email` as a user on the exact Search
   Console property represented by `GSC_SITE_URL`.
3. Do not print, copy into reports, or commit the private key.

## 2. Create the Google sitemap audit script

Create `scripts/audit-google-sitemap.ts`.

### Dependencies

Use `googleapis` for service-account authentication:

```bash
npm install --save-dev googleapis
```

Use the existing `npx tsx` convention to run TypeScript scripts.

### Required behavior

The script must:

1. Load `.env.local` without logging secret values.
2. Require `GOOGLE_APPLICATION_CREDENTIALS`, `GSC_SITE_URL`, and
   `GSC_SITEMAP_URL`.
3. Fetch the live `/sitemap.xml`; fail clearly on a non-2xx response or invalid
   XML.
4. Extract and normalize canonical URLs, rejecting URLs on another host.
5. Confirm the hub and all 12 `GUIDE_SLUGS` from `src/lib/guides.ts` are present.
6. Use Search Console’s Sitemaps API to read the submitted sitemap and its
   reported errors/warnings.
7. Use URL Inspection for sitemap URLs only when requested with `--inspect`.
   Record missing permission or exhausted quota as `blocked`, not `pass`.
8. Never mutate the sitemap, request indexing, or submit external URLs in the
   default audit.
9. Write a new immutable report; never overwrite a previous run.

### Output

Write:

```text
reports/site-ops/run-<ISO-timestamp>/google-sitemap-audit.json
```

The JSON should contain:

```json
{
  "runId": "run-...",
  "checkedAt": "2026-07-16T00:00:00.000Z",
  "siteUrl": "sc-domain:coldcallreps.com",
  "sitemapUrl": "https://coldcallreps.com/sitemap.xml",
  "liveUrlCount": 0,
  "requiredGuideUrls": [],
  "missingGuideUrls": [],
  "foreignHostUrls": [],
  "searchConsole": {
    "status": "pass",
    "submitted": true,
    "errors": 0,
    "warnings": 0
  },
  "inspections": [],
  "blockedChecks": []
}
```

Each inspection must preserve Google’s reported verdicts and last crawl time;
do not collapse them into a guessed “indexed” boolean.

### Commands

```bash
# Read-only sitemap and Search Console audit
npx tsx scripts/audit-google-sitemap.ts

# Include URL Inspection (quota-consuming, still read-only)
npx tsx scripts/audit-google-sitemap.ts --inspect
```

If the sitemap has never been submitted, report that fact. A separate,
explicitly approved `--submit-sitemap` option may call the Sitemaps API, but it
must not be part of the default audit.

## 3. Create the IndexNow key file

IndexNow uses a public verification key, not the private Google service-account
key.

Generate a dedicated IndexNow key and configure:

```bash
INDEXNOW_KEY=replace-with-indexnow-key
INDEXNOW_KEY_LOCATION=https://coldcallreps.com/replace-with-indexnow-key.txt
```

Create:

```text
public/<INDEXNOW_KEY>.txt
```

The file must contain only the IndexNow key:

```text
replace-with-indexnow-key
```

The deployed key file must return HTTP 200 at the exact
`INDEXNOW_KEY_LOCATION`. This key is intentionally public; never reuse the
Google private key, an application secret, or a customer credential.

## 4. Create the IndexNow submission script

Create `scripts/submit-indexnow.ts` using Node’s built-in `fetch`.

### Required behavior

The script must:

1. Load `INDEXNOW_KEY`, `INDEXNOW_KEY_LOCATION`, and
   `NEXT_PUBLIC_APP_URL=https://coldcallreps.com`.
2. Build candidate URLs from `/guides`, all 12 `GUIDE_SLUGS`, or explicit
   `--url` arguments.
3. Reject URLs that are not HTTPS, do not use `coldcallreps.com`, are
   disallowed by `robots.ts`, or are app/private routes.
4. Verify the deployed key file before a live submission.
5. Default to dry-run and print only the URL list and destination endpoint.
6. Require `--send` for the network POST.
7. POST batches to `https://api.indexnow.org/indexnow` using:

```json
{
  "host": "coldcallreps.com",
  "key": "<INDEXNOW_KEY>",
  "keyLocation": "https://coldcallreps.com/<INDEXNOW_KEY>.txt",
  "urlList": ["https://coldcallreps.com/guides"]
}
```

8. Treat accepted submission as `submitted`, not `indexed`.
9. Record HTTP status, response body, submitted URLs, failures, and timestamp
   in a new immutable report.

### Output

Write:

```text
reports/site-ops/run-<ISO-timestamp>/indexnow-submission.json
```

### Commands

```bash
# Safe preview
npx tsx scripts/submit-indexnow.ts

# Submit the hub and all guides after deployment
npx tsx scripts/submit-indexnow.ts --send

# Submit one changed URL
npx tsx scripts/submit-indexnow.ts \
  --url https://coldcallreps.com/guides/hire-cold-callers \
  --send
```

Only submit new, materially updated, or removed URLs. Do not repeatedly submit
unchanged pages or use “blast” loops.

## 5. Package commands

After implementing and testing both scripts, add:

```json
{
  "scripts": {
    "seo:audit-sitemap": "npx tsx scripts/audit-google-sitemap.ts",
    "seo:indexnow": "npx tsx scripts/submit-indexnow.ts"
  }
}
```

Do not add a `force-google-index` command. For Google, fix discovery and quality
issues, maintain the sitemap, inspect representative URLs, and use Search
Console’s manual request feature sparingly when appropriate.

## 6. Acceptance checks

- [ ] Google private key is ignored and has local file permissions `0600`.
- [ ] Audit runs without exposing credentials.
- [ ] All 13 guide URLs appear in the live sitemap audit.
- [ ] Missing GSC access becomes `blocked`.
- [ ] IndexNow defaults to dry-run.
- [ ] IndexNow rejects private, foreign-host, and HTTP URLs.
- [ ] Live IndexNow submission verifies the public key location first.
- [ ] Reports are immutable and keep SEO, AEO, and GEO evidence separate.
- [ ] Neither script claims that submission guarantees indexing.
