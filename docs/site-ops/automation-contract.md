# Automation contract — Cold Call Reps

## Allowed without approval (read-only or report-only)

| Action | Command / path |
| ------ | -------------- |
| Production build check | `pnpm build` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| Sitemap source review | `src/app/sitemap.ts` |
| Robots review | `src/app/robots.ts` |
| LLM site summary | `public/llms.txt` |
| Marketing route inventory | `src/app/(marketing)/` |
| Product truth for claims | `src/lib/product.ts`, `src/lib/platform-fees.ts` |
| Emit audit report | `reports/site-ops/run-<timestamp>/` (new path only) |
| Search Console sitemap audit | `npx tsx scripts/audit-google-sitemap.ts` (after implementation) |
| IndexNow dry run | `npx tsx scripts/submit-indexnow.ts` (after implementation) |

## Allowed with human approval

- New indexable routes and metadata
- Sitemap and `llms.txt` updates
- JSON-LD additions
- Redirects and canonical changes
- Competitor comparison pages
- Deploy to production

## Blocked for autonomous agents

- Changing Stripe prices, fee logic, or payout rules in code without product owner
- Google Indexing API for marketing/guides
- Mass-generated location or vertical pages without Publication Gate
- Backdating content or sitemap `lastmod`
- `noindex` on core marketing without explicit approval
- Embedding system instructions in `llms.txt`

## GSC / analytics

Mark `blocked` when credentials are missing. Do not guess indexation or conversion rates.
Follow [`search-indexing.md`](./search-indexing.md) when creating or running the sitemap
audit and IndexNow scripts. A live IndexNow POST requires `--send`; the default must
remain dry-run. Do not create a Google force-index script for ordinary pages.

## Report outputs

Each run writes:

```text
reports/site-ops/run-<timestamp>/
  audit-report.json
  audit-report.md          # optional
  content-records/*.json
  run-state.json
```

Immutable history — never overwrite prior runs.
