# Cold Call Reps — Content & Discoverability SOP

Evidence-validated strategy for getting **coldcallreps.com** found through on-site content
and technical discoverability. Adapted from the v9 blog-ops methodology for a
marketplace marketing site (not a blog-first publisher).

## Objective

Help brands and reps find Cold Call Reps when they search or ask answer engines for:

- hiring human cold callers / appointment setters with outcome-based pay;
- earning money from cold calling / SDR gigs with training and payouts;
- how escrow, claims, and marketplace fees work.

Success is **qualified discovery → sign-up**, not raw traffic or citation vanity.

## Evidence standard

| Class | Meaning |
| ----- | ------- |
| **Documented** | Terms, product source, primary platform documentation |
| **Observed** | GSC, analytics, crawl, customer interviews, prompt benchmark |
| **Experimental** | Isolated test with owner, metric, end date, stop rule |

Do not claim ranking, citation, or conversion causation without scope and sample size.

## Agent execution contract

### Launch mode

Use when introducing a **new content property** (e.g. `/guides`, comparison hub).

1. Validate `site-profile.yaml`.
2. Complete `templates/launch-input.yaml`.
3. Run `checklists/launch.md`.
4. Ship hub page + first 2–3 guides with mutual internal links.
5. Update sitemap, robots (if needed), and `llms.txt`.
6. Save baseline report under `reports/site-ops/`.

**Stop** if fee/payout claims lack evidence or legal review.

### Content mode

Use for **one URL** at a time.

1. Select from `content-plan.md` or justify a new distinct purpose.
2. Complete `templates/content-brief.yaml`.
3. Pass all six Publication Gate checks.
4. Implement page + metadata + JSON-LD aligned with visible copy.
5. Link from footer, hub, and ≥1 related page; add to sitemap.
6. Record content record + evidence; note review date (90 days default).

**Stop** if the URL duplicates an existing audience task.

### Audit modes

| Cadence | Focus |
| ------- | ----- |
| Weekly | robots, sitemap, llms.txt, broken links, app-route leakage, build |
| Monthly | GSC queries, indexation, conversions by cohort, answer gaps |
| Quarterly | Content plan, claim revalidation, prompt benchmark, competitor lanes |

## Publication Gate (required)

Every indexable URL must pass:

1. **Audience task** — one primary question or job-to-be-done documented in the brief.
2. **Distinct value** — original method, data, workflow, or synthesis; not a synonym page.
3. **Claim integrity** — fees, caps, escrow, payouts, and outcomes trace to product source or evidence.
4. **Complete experience** — direct answer, limitations, evidence, clear CTA.
5. **Discovery** — internal links, sitemap entry, hub path.
6. **Distinct URL purpose** — no cannibalization of `/for/brands`, `/for/reps`, or `/pricing`.

## Coverage matrices

### SEO

| Signal | Launch | Recurring |
| ------ | ------ | --------- |
| Indexable URL inventory | Required | Delta review |
| Titles, descriptions, canonicals | Required | Weekly |
| Sitemap `lastmod` truth | Required | Weekly |
| Internal link graph | Required | Monthly |
| GSC indexation & queries | Blocked without access | Monthly |
| Sign-up conversion by landing | Blocked without analytics | Monthly |

### AEO

| Signal | Launch | Recurring |
| ------ | ------ | --------- |
| FAQ / direct answers on page | Required for guide URLs | Monthly |
| Entity consistency (brand, product, fees) | Required | Weekly |
| JSON-LD matches visible content | Required | Weekly |
| `llms.txt` accuracy | Required if published | Monthly |
| Server-rendered critical answers | Required | Weekly |

Unsupported: `data-agent-weight`, FAQ rich-result spam, fake dates.

### GEO

| Signal | Launch | Recurring |
| ------ | ------ | --------- |
| Claim ledger with evidence IDs | Required | Quarterly |
| Versioned prompt benchmark | Experimental | Quarterly |
| Citation / mention sample | Experimental | Quarterly |
| Factual accuracy vs product source | Required | Quarterly |

`llms.txt` is an **optional experiment** — keep factual; do not embed system instructions.

## Content principles

1. **Answer the job, not the keyword** — “hire cold callers pay per meeting” not “cold call SEO tips”.
2. **Show the mechanism** — escrow, human dials, AI trainer only for practice, claim audit, Stripe Connect.
3. **Qualify limitations** — no closers, no AI placing live brand calls, geographic/payout constraints as documented.
4. **Hub + spoke** — `/guides` (or equivalent) links every guide; every guide links back and to product CTAs.
5. **One canonical URL per task** — merge thin duplicates; redirect only with approval.

## Competitive lanes

| Lane | Examples | Stance |
| ---- | -------- | ------ |
| **COMPETE** | Appointment-setting agencies, freelance SDR marketplaces, “hire cold callers” | Comparison pages with verified differences |
| **MESH** | CRMs, dialers, lead data (integrations) | Integration/developer content when true |
| **OUT OF LANE** | Generic sales coaching, unrelated vertical SEO | Do not publish |

## Technical checklist (every ship)

- [ ] `src/app/sitemap.ts` includes canonical URL with truthful `lastModified`
- [ ] `public/llms.txt` lists new guide if indexable and factual
- [ ] `robots.ts` still blocks app desks (`/dashboard`, `/brands/`, etc.)
- [ ] Page metadata via Next.js `metadata` export or layout
- [ ] JSON-LD only where content supports it (FAQ, Organization, WebPage)
- [ ] `pnpm build` passes

## What we do not do

- Mass programmatic city pages without unique value
- Backdated `lastModified` or fake “updated” badges
- Google Indexing API for marketing/guides
- Word-count floors or banned-word games
- Unsupported schema or agent-only HTML attributes

## Primary references

Revalidate quarterly: Google Search Central documentation, schema.org, Bing IndexNow scope,
and internal product/terms when pricing changes.
