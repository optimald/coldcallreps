# Weekly Site-Ops Audit — coldcallreps.com

- **Run:** `run-2026-07-20T19-45-46-000Z`
- **Cadence:** weekly
- **Previous run:** `run-2026-07-16T23-15-50-956Z`
- **Revision:** `a755237`
- **Status:** conditional_pass (0 critical · 1 high · 2 medium · 1 low)

## Summary

Weekly regression audit following a human-centric homepage revision (real SDR imagery,
a new "Fair & transparent" section, and proof-bar copy edits). Core technical signals
pass. Three process/discoverability gaps were found and remediated in this run; GSC
remains blocked (no credentials).

## Checks

| Check | Domain | Status |
| ----- | ------ | ------ |
| Production build (`next build`) | cross | pass |
| robots app-route leakage | seo | pass |
| Sitemap coverage (hub + 12 guides) | seo | pass |
| llms.txt URL accuracy | aeo | pass (fixed) |
| Broken internal links | seo | pass |
| Home FAQ JSON-LD matches copy | aeo | pass |
| Material claim edits recorded | geo | pass |
| GSC queries / indexation | seo | **blocked** |

## Findings & remediation

1. **[high] llms.txt listed dead/redirecting URLs** — `/gigs` (404) and `/for/brands`
   (307) removed from Key URLs; `/guides` added. Fixed in `public/llms.txt`.
2. **[medium] state pointer stale** — `state/latest.json` updated with this run id,
   cadence dates, and 13 published guide URLs.
3. **[medium] IndexNow not implemented** — added `scripts/submit-indexnow.ts`
   (dry-run default), the public key file, and `seo:*` package scripts.
4. **[low] homepage revision shipped outside content mode** — recorded in
   `content-records/content-home.json`; claims verified against product truth.

## Blocked

- **GSC** — no Search Console credentials. Provide
  `.secrets/google-search-console.json` + `GSC_SITE_URL` to enable indexation checks.

## Next

- Weekly: 2026-07-27 · Monthly: 2026-08-20 · Quarterly: 2026-10-20
