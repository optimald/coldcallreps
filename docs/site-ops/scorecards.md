# Scorecards — Cold Call Reps

Three independent scorecards per audit run. Never blend into one “AI visibility” number.

## SEO

**Question:** Can the right people find the right public URL in organic search?

| Metric | Source |
| ------ | ------ |
| Indexable URL count vs plan | Content plan + sitemap |
| Title/description present | Page metadata audit |
| Sitemap coverage | `src/app/sitemap.ts` |
| Internal links to new URLs | Crawl / manual |
| GSC impressions/clicks by cohort | Search Console (often blocked) |
| Sign-up conversion by landing | PostHog (often blocked) |

## AEO

**Question:** Can answer engines extract accurate, complete answers about Cold Call Reps?

| Metric | Source |
| ------ | ------ |
| Direct answer on guide pages | Content review |
| FAQ / structured data vs visible copy | Render + schema check |
| Entity consistency (fees, escrow, humans dial) | vs `llms.txt`, pricing, product lib |
| `llms.txt` factual drift | Diff vs product source |
| Critical content server-rendered | Build / curl preview |

## GEO

**Question:** When cited in retrieval, are claims accurate and stable?

| Metric | Source |
| ------ | ------ |
| Evidence ID coverage on consequential claims | Content records |
| Publication Gate pass rate | Audit run |
| Prompt benchmark citation rate | Experimental quarterly sample |
| Factual error rate in samples | Manual review vs evidence |
| Referral traffic from AI surfaces | Analytics (often blocked) |

## Status values

- `pass` — checks in scope succeeded
- `partial` — incomplete evidence, no hidden assumptions
- `fail` — failed check with remediation
- `blocked` — missing access or human review
- `not_applicable` — with documented reason
