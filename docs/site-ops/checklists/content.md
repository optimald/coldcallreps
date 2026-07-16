# Single URL — Content ship checklist

Use in **content** mode for one guide or landing page.

## Brief

- [ ] `templates/content-brief.yaml` complete with owner and cohort.
- [ ] Primary task is unique vs existing URLs (check `content-plan.md` + sitemap).
- [ ] Claim ledger references `src/lib/product.ts`, `platform-fees.ts`, or evidence IDs.

## Publication Gate

- [ ] Audience task documented.
- [ ] Distinct value declared (not duplicate of `/for/*` or `/pricing`).
- [ ] Claim integrity — fees, escrow, payouts verified.
- [ ] Complete experience — answer, limitations, CTA.
- [ ] Discovery — hub link, footer or related guide, sitemap entry.
- [ ] Distinct URL purpose confirmed.

## Implementation

- [ ] Page under `src/app/(marketing)/guides/[slug]/` (or approved path).
- [ ] `metadata` title/description accurate.
- [ ] Internal links to `/pricing`, relevant `/for/*`, sign-up.
- [ ] `sitemap.ts` updated with truthful `lastModified`.
- [ ] `public/llms.txt` updated if indexable.
- [ ] `pnpm build` and `pnpm lint` pass.

## Post-ship

- [ ] Content record JSON saved in latest audit run.
- [ ] Evidence files in `docs/site-ops/evidence/` for new claims.
- [ ] `content-plan.md` status → `published`.
- [ ] Next review date set (90 days).
