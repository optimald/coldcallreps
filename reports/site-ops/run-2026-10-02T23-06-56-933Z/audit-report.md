# Daily GSC audit — 2026-10-02

**Status: blocked** (no Search Console credentials in this Cloud Agent environment)

## Verdict

Cannot pull live clicks, impressions, positions, or URL Inspection. Last successful GSC snapshot is **38 days stale** (2026-08-25). Live crawl checks below are observed, not guessed.

## How we were performing (last GSC: 2026-08-25)

| Window | Clicks | Impressions | Avg position |
| ------ | ------ | ----------- | ------------ |
| 28d | **0** | **64** | **20.2** |

Interpretation (historical only): tiny impression volume, deep SERP (page 2+), zero organic clicks. Brand was barely visible in Google search.

## Keywords we ranked for (disclosed queries, 2026-08-25)

Google anonymizes low-volume queries; only these were disclosed:

1. **hire cold callers**
2. **callreps** (near-brand)
3. **hire cold caller**
4. **hire cold calling**
5. **cost to rep**

Note: since that run, CCR SEO was consolidated onto **rep recruiting**. Brand-hire guides now **308 → MarketPounce**. Those “hire cold callers” impressions may now attach to MarketPounce or to the new CCR `/hire-cold-callers` landing — **unverified without live GSC**.

## Live site inventory (observed today)

12 sitemap URLs; all return 200 except brand guide paths which correctly 308 to MarketPounce.

**Indexable CCR surfaces:** `/`, `/for/reps`, `/hire-cold-callers`, `/pricing`, `/guides` + 4 rep guides.

**www → apex:** 301 pass (prior www/apex split finding likely mitigated).

**`/for/reps`:** 200 + self-canonical (prior “duplicate of `/for`” finding likely resolved).

## What we could be doing better

### Unblock measurement (blocker)
Add to the Cloud Agent environment:
- Service-account JSON → `.secrets/google-search-console.json`
- `GOOGLE_APPLICATION_CREDENTIALS=.secrets/google-search-console.json`
- `GSC_SITE_URL=sc-domain:coldcallreps.com`
- `GSC_SITEMAP_URL=https://coldcallreps.com/sitemap.xml`

Then re-run `pnpm seo:audit-gsc -- --inspect`.

### Fix self-inflicted SEO bugs (high)
Root `layout.tsx` sets `alternates.canonical: '/'`, so pages that do not override inherit the homepage:

| URL | Live canonical | Expected |
| --- | -------------- | -------- |
| `/pricing` | `https://coldcallreps.com/` | `/pricing` |
| `/terms` | homepage | `/terms` |
| `/privacy` | homepage | `/privacy` |

Google may treat `/pricing` as a duplicate of home and drop it from results.

### Content / ranking priorities (once GSC is live)
1. Confirm whether **hire cold callers** still impresses on CCR `/hire-cold-callers` vs MarketPounce guide.
2. Push **rep-earn** queries the live guides target: *cold calling gigs*, *get paid per meeting cold calling*, *AI cold call practice*, *SDR applications*.
3. Average position ~20 historically → need title/H1 alignment + internal links from `/` and `/for/reps` into the 4 guides (already partially present).
4. Re-inspect indexation for the 4 remaining guides; prior run had discovered-not-indexed guides that may still lag.

## Prior open findings — carry-forward

| ID | Severity | Status this run |
| -- | -------- | --------------- |
| finding-for-reps-duplicate | high | **likely resolved** (live 200 + self-canonical); confirm with URL Inspection when unblocked |
| finding-four-guides-not-indexed | high | **stale inventory** — brand guides moved to MP; re-check 4 remaining CCR guides with `--inspect` |
| finding-www-apex-split | medium | **likely resolved** (www 301 → apex); confirm in GSC |
| finding-homepage-stale-crawl | medium | **unknown** — needs URL Inspection |
| finding-pricing-canonical-home | high | **new** — `/pricing` (and terms/privacy) canonicalize to `/` |

## Next action

Provide GSC service-account credentials in the agent environment and re-run this audit with `--inspect`.
