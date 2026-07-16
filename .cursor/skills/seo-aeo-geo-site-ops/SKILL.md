---
name: seo-aeo-geo-site-ops
description: >-
  Plans and ships on-site content for coldcallreps.com and runs evidence-based
  SEO, AEO, and GEO launch and audit workflows. Use when creating guides or
  landing pages, improving discoverability, updating llms.txt/sitemap/robots,
  auditing indexation or answer coverage, measuring citations, or executing
  docs/site-ops.
disable-model-invocation: true
---

# Cold Call Reps — SEO/AEO/GEO Site Operations

Invoke only when the user asks for content generation, discoverability work, or
site-ops audits. Policy: `docs/site-ops/SOP.md`. Executable contract:
`docs/site-ops/README.md`.

## Select One Mode

- `launch`: new content property (blog/guides section, comparison hub, vertical landing pages).
- `content`: ship one new or materially revised indexable URL.
- `audit-weekly`: regression and safety on public URLs.
- `audit-monthly`: cohort performance, answer coverage, retrieval, conversions.
- `audit-quarterly`: strategy, evidence, platform, and claim revalidation.

Ask one focused question if the mode is unclear. Do not mix launch state with audit state.

## Required Files

1. `docs/site-ops/README.md`
2. `docs/site-ops/SOP.md` — strategy, content clusters, Publication Gate
3. `docs/site-ops/site-profile.yaml` — brand, audiences, products (do not invent facts)
4. `docs/site-ops/content-plan.md` — priority URLs and cohorts
5. Matching checklist in `docs/site-ops/checklists/`
6. Schemas in `docs/site-ops/schemas/` when emitting records or reports
7. Prior state in `docs/site-ops/state/` and `reports/site-ops/`

## Content Mode Workflow

1. Pick the next URL from `content-plan.md` or confirm a new URL with distinct purpose.
2. Complete `templates/content-brief.yaml`; get approval on consequential claims.
3. Trace fee, payout, escrow, and outcome claims to `src/lib/product.ts`,
   `src/lib/platform-fees.ts`, `public/llms.txt`, and terms — never invent pricing.
4. Implement as a marketing route (`src/app/(marketing)/...`) or guide MDX when the
   blog/guides route exists. Match existing layout, metadata, and component patterns.
5. Add internal links from footer, hub page, and at least one related URL.
6. Update `src/app/sitemap.ts` and `public/llms.txt` when the URL is indexable.
7. Run Publication Gate on the content record before merge/deploy.
8. Save evidence records for material claims; emit audit report to `reports/site-ops/`.

## Publication Gate

No indexable URL ships unless all six pass:

1. documented audience task;
2. distinct value (not a thin rephrase of an existing page);
3. claim integrity (evidence for fees, payouts, escrow, outcomes);
4. complete experience (answer, scope, limitations, next step);
5. discovery (internal links + sitemap + hub path);
6. distinct canonical URL purpose.

Mark unverifiable checks `blocked`. Never pass from word count or component count alone.

## Evidence Rules

- `documented`: primary platform docs, terms, product source, standards.
- `observed`: GSC, analytics, crawl, customer research, controlled prompt test.
- `experimental`: falsifiable test with owner, baseline, metric, end date, stop rule.

Financial and marketplace claims require human review. Do not state competitor facts
without corroboration and approval.

## Hard Stops

Request human review before:

- changing production fees, payout rules, or legal copy without product owner sign-off;
- competitor comparisons with legal/reputational risk;
- crawler-policy, redirect, or broad content deletion changes;
- deploying, purchasing, messaging, or account changes;
- publishing without evidence for escrow, platform fee cap, or outcome-pay mechanics.

## Repo Commands

```bash
pnpm build
pnpm lint
pnpm test
```

Inspect (read-only): `src/app/sitemap.ts`, `src/app/robots.ts`, `public/llms.txt`,
marketing pages under `src/app/(marketing)/`, metadata in layouts and `page.tsx` files.

GSC and production crawl checks are `blocked` without credentials. Do not use Google's
Indexing API for marketing pages or guides.

## Output Requirements

Reports match `schemas/audit-report.schema.json`. Keep SEO, AEO, and GEO scorecards
separate. Save immutable runs under `reports/site-ops/run-<timestamp>/`. Never overwrite
prior reports.

## Cold Call Reps Content Priorities

When choosing what to build next, prefer URLs that match real search and answer tasks.
Follow `docs/site-ops/content-plan.md` — **12 guides in 3 waves** after the `/guides` hub.

1. Brand hire intent — guides 1, 5, 9, 10, 11
2. Rep earn intent — guides 2, 6, 8, 12
3. Mechanism trust — guides 3, 4, 7
4. Ship order: hub → wave 1 (1–4) → wave 2 (5–8) → wave 3 (9–12)
