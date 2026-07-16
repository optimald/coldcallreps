# Cold Call Reps — Site Operations

Agent-executable SEO, AEO, and GEO for **coldcallreps.com**. Generate on-site content,
expand discoverability, and audit public URLs without inventing marketplace claims.

| Resource | Purpose |
| -------- | ------- |
| [`SOP.md`](./SOP.md) | Strategy, Publication Gate, coverage matrices |
| [`site-profile.yaml`](./site-profile.yaml) | Brand, audiences, products, approvers |
| [`content-plan.md`](./content-plan.md) | Priority URL backlog and cohorts |
| [`scorecards.md`](./scorecards.md) | Separate SEO / AEO / GEO measurement |
| [`automation-contract.md`](./automation-contract.md) | Safe repo commands and boundaries |
| [`.cursor/skills/seo-aeo-geo-site-ops/SKILL.md`](../../.cursor/skills/seo-aeo-geo-site-ops/SKILL.md) | Agent router |

## Modes

| Mode | When to use |
| ---- | ----------- |
| `launch` | First guides section, comparison hub, or major new content property |
| `content` | One new or materially revised indexable URL |
| `audit-weekly` | Sitemap, robots, llms.txt, links, accidental app indexation |
| `audit-monthly` | GSC queries, conversions, answer coverage, retrieval sample |
| `audit-quarterly` | Fee/payout claim revalidation, content plan refresh, platform docs |

## Execution order

1. Load `site-profile.yaml` and prior state from `state/` or latest `reports/site-ops/` run.
2. For **content** mode: complete `templates/content-brief.yaml` before drafting.
3. Create `evidence/` records for consequential claims (`schemas/evidence-record.schema.json`).
4. Create one **content record** per canonical URL (`schemas/content-record.schema.json`).
5. Run the matching checklist in `checklists/`.
6. Implement or propose changes; request approval for consequential edits.
7. Emit immutable report to `reports/site-ops/run-<timestamp>/`.
8. Update `state/latest.json` pointer only after the run completes (append-only history).

## Where content lives

| Type | Location | Notes |
| ---- | -------- | ----- |
| Core marketing | `src/app/(marketing)/` | Home, pricing, for/*, developers |
| Public listings | `/gigs`, profile slugs | Index only intentional public URLs |
| **New guides** | `src/app/(marketing)/guides/[slug]/page.tsx` (create when launching) | Preferred scalable pattern |
| Discovery files | `src/app/sitemap.ts`, `src/app/robots.ts`, `public/llms.txt` | Update on every new indexable URL |
| Product truth | `src/lib/product.ts`, `src/lib/platform-fees.ts`, terms | Source for claim ledger |

Do not publish volume without passing Publication Gate. Quality and distinct URL purpose
beat post count.

## Safe defaults

- Read-only inspection first.
- Reports are immutable; never overwrite `reports/site-ops/run-*`.
- Missing GSC/analytics → `blocked`, not guessed.
- Real publication dates only.
- Separate SEO, AEO, and GEO scorecards — no blended “AI visibility” score.

## Invoke the skill

In Cursor chat (this repo):

> Use **seo-aeo-geo-site-ops** in **content** mode. Ship the next URL from the content plan.

Or:

> Run **audit-weekly** for coldcallreps.com public URLs.

A window reload is enough if the skill does not appear; full Cursor restart is not required.
