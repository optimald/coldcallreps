# Launch — Guides / content property

Use when shipping `/guides` or a comparable hub for the first time.

## Intake

- [ ] `site-profile.yaml` and `templates/launch-input.yaml` complete.
- [ ] Product owner approves fee, escrow, and outcome claims used in hub copy.
- [ ] `content-plan.md` Phase 0 items assigned.

## Architecture

- [ ] `/guides` hub route planned under `src/app/(marketing)/guides/`.
- [ ] First 2–3 guides have distinct audience tasks (no overlap with `/for/brands` or `/for/reps` alone).
- [ ] Footer and hub cross-link all launch guides.
- [ ] `sitemap.ts` will include hub + each guide URL.
- [ ] `llms.txt` updated with hub and guide URLs (factual only).

## SEO / AEO / GEO preflight

- [ ] Run items from `checklists/launch.md` (metadata, robots, schema).
- [ ] JSON-LD matches visible FAQ/copy.
- [ ] App routes remain disallowed in `robots.ts`.
- [ ] `pnpm build` passes on preview.

## Release

- [ ] Baseline report saved to `reports/site-ops/run-<timestamp>/`.
- [ ] `state/latest.json` updated with run ID and next review dates.
- [ ] Weekly/monthly/quarterly review dates assigned.
