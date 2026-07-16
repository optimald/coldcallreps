# Weekly audit — Cold Call Reps

Narrow regression check on **public** surfaces.

## State

- [ ] Load `docs/site-ops/state/latest.json` and last `reports/site-ops/run-*`.
- [ ] New immutable run ID created.

## Technical

- [ ] `pnpm build` passes.
- [ ] `src/app/robots.ts` — no accidental allow of `/dashboard`, `/brands/`, `/api/`.
- [ ] `src/app/sitemap.ts` — all published guides present; no ghost URLs.
- [ ] `public/llms.txt` — URLs and product facts still match pricing/product lib.
- [ ] No new broken internal links on marketing pages.

## AEO

- [ ] Home FAQ JSON-LD still matches visible copy (`src/lib/home-faq`).
- [ ] Guide pages render primary answer without required JS interaction.
- [ ] Fee/escrow statements unchanged without evidence update.

## GEO

- [ ] No material claim edits this week without evidence record.

## Output

- [ ] Report saved; open findings carried forward; next weekly date set.
