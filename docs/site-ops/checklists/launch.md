# Launch checklist — Cold Call Reps

Critical failures block launch. Record `pass`, `partial`, `fail`, `blocked`, or `not_applicable` with evidence.

## Intake and safety

- [ ] Site profile validates; production origin is `https://coldcallreps.com`.
- [ ] Fee, payout, and escrow claims trace to product source or evidence.
- [ ] Deployment and legal copy changes have named approver.

## Audience and architecture

- [ ] Each new indexable URL maps to one audience task from `site-profile.yaml`.
- [ ] Publication Gate passes for every launch URL.
- [ ] No duplicate purpose vs `/for/brands`, `/for/reps`, `/pricing`.
- [ ] Hub `/guides` links all launch guides; footer includes Guides link.

## SEO

- [ ] URLs return 200 in preview/production.
- [ ] Canonicals and robots directives intentional.
- [ ] `robots.ts` blocks app desks (`/dashboard`, `/brands/`, `/api/`, etc.).
- [ ] `sitemap.ts` lists all launch URLs with truthful dates.
- [ ] Titles, descriptions, Open Graph accurate.
- [ ] Internal links resolve.

## AEO

- [ ] High-value questions have on-page direct answers.
- [ ] Entity facts match `llms.txt`, pricing, and terms.
- [ ] JSON-LD matches visible content.
- [ ] `llms.txt` is factual — no system instructions.

## GEO

- [ ] Claim ledger with evidence IDs for fee and escrow statements.
- [ ] Prompt benchmark template filled for quarterly experiment (optional at launch).
- [ ] Publication dates truthful.

## Release

- [ ] `pnpm build` passes.
- [ ] Human approves production deploy.
- [ ] Immutable report under `reports/site-ops/`.
- [ ] Review cadence assigned.
