# Content plan — Cold Call Reps

**12 high-quality guide pages** (+ `/guides` hub). Each URL owns one audience task, passes
Publication Gate, and ships only after `templates/content-brief.yaml` is complete.

Status: `planned` | `brief` | `draft` | `published` | `update_due`

## Quality bar (every guide)

| Requirement | Standard |
| ----------- | -------- |
| **Original value** | Marketplace-specific mechanism, workflow, or verified comparison — not generic cold-call tips |
| **Direct answer** | Primary task answered in the first screen with scope and limitations |
| **Claim integrity** | Fees, escrow, payouts, outcomes trace to `platform-fees.ts`, `product.ts`, terms, or `evidence/` |
| **Structure** | Direct answer → how CCR handles it → limitations → FAQ (3–6) → related guides → CTA |
| **Depth** | Enough substance to stand alone (~1,200–2,500 words equivalent); tables or checklists where useful |
| **Discovery** | Hub + ≥2 internal links in + ≥2 out; sitemap + `llms.txt` on publish |
| **Schema** | `FAQPage` + `WebPage` only where visible FAQ/content supports it |
| **Review** | 90-day `nextReviewAt`; fee copy revalidated on any pricing change |

---

## Phase 0 — Hub (ship first)

| # | URL | Audience | Primary task | Status |
| - | --- | -------- | ------------ | ------ |
| H | `/guides` | Both | Browse guides by brand hire, rep earn, trust & mechanics | planned |

Hub requirements: category cards, one-line task per guide, links to all 12 pages, footer link,
sitemap entry, `llms.txt` section listing guides.

---

## The 12 guides

### Wave 1 — Core intent (ship with hub)

Highest search and answer-engine demand; establish trust mechanics early.

| # | URL | Cohort | Primary task | Original contribution | Primary query (target) |
| - | --- | ------ | ------------ | --------------------- | ---------------------- |
| 1 | `/guides/hire-cold-callers` | guides-brand | Hire humans for first-touch dials with outcome-based pay | Escrow + application-gated rep pool workflow | how to hire cold callers |
| 2 | `/guides/cold-calling-gigs` | guides-rep | Find paid cold calling campaigns online | Train → apply → dial → claim path on CCR | cold calling gigs |
| 3 | `/guides/campaign-escrow-and-claims` | guides-brand | How brand escrow, claim audit, and disputes work | Step-by-step fund → dial → verify → pay flow | cold calling escrow marketplace |
| 4 | `/guides/platform-fees-and-payouts` | both | What the 20% fee, caps, and Stripe payouts mean in practice | Worked examples from `PLATFORM_FEE_EXAMPLES` | cold call reps fees payouts |

**Wave 1 internal links:** each page links to the other three + `/pricing` + relevant `/for/*`.

---

### Wave 2 — Decision and earn depth

| # | URL | Cohort | Primary task | Original contribution | Primary query (target) |
| - | --- | ------ | ------------ | --------------------- | ---------------------- |
| 5 | `/guides/pay-per-appointment-setting` | guides-brand | When pay-per-meeting beats salary SDRs | Cost model table: salary vs outcome + escrow risk | pay per appointment setting |
| 6 | `/guides/get-paid-per-meeting-cold-calling` | guides-rep | How reps earn on booked meetings and qualified leads | Outcome types, accelerators, optional base pay stacking | get paid cold calling per meeting |
| 7 | `/guides/how-campaigns-work` | both | End-to-end lifecycle: post → apply → dial → claim → payout | Single timeline diagram (brand + rep views) | how cold call campaigns work |
| 8 | `/guides/ai-cold-call-practice` | guides-rep | Use AI voice practice before live brand dials | Trainer vs live dial boundary (humans on brand calls) | AI cold call practice |

---

### Wave 3 — Comparison, marketplace education, applications

| # | URL | Cohort | Primary task | Original contribution | Primary query (target) |
| - | --- | ------ | ------------ | --------------------- | ---------------------- |
| 9 | `/guides/appointment-setting-marketplace` | guides-brand | What an appointment-setting marketplace is and when to use one | Buyer checklist: escrow, humans, outcome definition | appointment setting marketplace |
| 10 | `/guides/hire-outbound-without-in-house-sdr` | guides-brand | Run outbound without a full-time SDR hire first | Decision tree: in-house vs marketplace vs agency | hire outbound without sdr team |
| 11 | `/guides/cold-call-reps-vs-outbound-agency` | guides-brand | Marketplace vs outbound agency (factual comparison) | Side-by-side: cost structure, control, speed, escrow | cold call reps vs agency |
| 12 | `/guides/sdr-applications-and-approval` | guides-rep | How rep applications, quality gate, and campaign access work | What brands see; what gets reps approved or declined | sdr campaign application process |

---

## Cannibalization guardrails

| Do not merge | Because |
| ------------ | ------- |
| #1 vs #10 | #1 is operational hire how-to; #10 is build-vs-buy decision |
| #3 vs #7 | #3 is money safety deep-dive; #7 is full lifecycle |
| #4 vs #5 | #4 is fee/payout facts; #5 is compensation model strategy |
| #2 vs #6 | #2 is finding gigs; #6 is earning mechanics |
| #9 vs #11 | #9 defines marketplace category; #11 compares CCR to agencies |
| Guides vs `/for/brands` | For-pages sell; guides teach one task with evidence |

---

## Internal linking matrix (minimum)

Each guide must link to **hub** and **at least two** others from this row’s “related” set.

| Guide | Related guides | Product CTAs |
| ----- | -------------- | ------------ |
| 1 hire-cold-callers | 3, 5, 9, 11 | `/sign-up?role=BRAND`, `/gigs` |
| 2 cold-calling-gigs | 6, 8, 12 | `/sign-up?role=REP`, `/gigs` |
| 3 campaign-escrow | 4, 7, 1 | `/sign-up?role=BRAND` |
| 4 platform-fees | 3, 6, 7 | `/pricing` |
| 5 pay-per-appointment | 1, 4, 10 | `/pricing`, `/sign-up?role=BRAND` |
| 6 get-paid-per-meeting | 2, 4, 8 | `/sign-up?role=REP`, `/gigs` |
| 7 how-campaigns-work | 3, 4, 12 | `/for/brands`, `/for/reps` |
| 8 ai-cold-call-practice | 2, 12, 6 | `/sign-up?role=REP`, `/pricing` |
| 9 appointment-marketplace | 1, 11, 5 | `/sign-up?role=BRAND` |
| 10 hire-without-sdr | 1, 5, 11 | `/sign-up?role=BRAND` |
| 11 vs-agency | 9, 5, 10 | `/sign-up?role=BRAND` |
| 12 sdr-applications | 2, 7, 8 | `/sign-up?role=REP`, `/gigs` |

---

## Ship order

```text
Phase 0: Hub
Wave 1: Guides 1–4  (4 pages)
Wave 2: Guides 5–8  (4 pages)
Wave 3: Guides 9–12 (4 pages)
```

Total indexable guides: **12** + hub = **13 URLs** under `/guides`.

---

## Cohorts (scorecards)

| Cohort | Guide numbers |
| ------ | ------------- |
| `guides-brand` | 1, 3, 5, 9, 10, 11 |
| `guides-rep` | 2, 6, 8, 12 |
| `guides-both` | 4, 7 |
| `core-marketing` | `/`, `/pricing`, `/for/*`, `/developers` |
| `listings` | `/gigs`, public profiles (index policy TBD) |

---

## Evidence required by topic

| Topic | Evidence IDs |
| ----- | ------------ |
| Platform fees / caps | `ev-platform-fees` |
| Product scope (humans dial, AI practice only) | `ev-llms-product` |
| Escrow / claims | `ev-escrow-claims` (create at Wave 1) |
| Stripe Connect payouts | `ev-stripe-connect` (create at Wave 1) |
| Agency comparison | `ev-comparison-agency` (create at Wave 3; human approval) |

---

## Out of lane (do not add as guides 13+)

- Generic cold calling scripts or opener lists without CCR mechanism
- Vertical playbooks (medspa, dental, etc.) without first-party data
- Closer / AE compensation content
- “AI dialers replace SDRs” narratives
- Thin city or “near me” programmatic pages

---

## After each publish

1. Content record in `reports/site-ops/run-*/content-records/`
2. Brief archived beside guide slug in `docs/site-ops/briefs/` (optional)
3. Update `state/latest.json` → `publishedGuideUrls`
4. Hub card status → published
5. `llms.txt` Key URLs section updated
6. Next review: 90 days
