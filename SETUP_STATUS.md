# ColdCallReps provisioning status

## Product
- Vanity profiles: `coldcallreps.com/{handle}` (legacy `/r/` and `/t/` redirect)
- Pooled Team minutes via `OrgMinutePool` (members draw from org pool first)
- Minute packs (one-time overage top-up): 60 min / $9, 200 min / $25
- Audio highlights → Cloudflare R2 bucket `coldcallreps-clips`
- CRM: HubSpot + Google Calendar OAuth when env configured (UI: Coming soon if keys missing)

## Minute tracker & overage
- **Tracker:** yes — personal `minutesRemaining` + org pool; shown in trainer/billing/dashboard
- **Hard stop:** session gate + scorecard 402 when balance is 0
- **Overage:** not automatic metered billing — buy minute packs when empty

## Infra checklist
### Done
- **Turso (libSQL)** — Prisma `sqlite` + `@prisma/adapter-libsql`; app uses `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (`.env.local`); CLI uses `DATABASE_URL=file:./prisma/dev.db`. Push: `npm run db:push:turso`
- Clerk live keys + Organizations
- Stripe webhook + Recruiter/Team prices + minute pack prices
- R2 bucket `coldcallreps-clips` created
- Voice worker deployed with gate fail-closed

### REQUIRED — Clerk production DNS (fixes blank /sign-in + /sign-up)
Publishable key points at `clerk.coldcallreps.com`, but that host is **NXDOMAIN**.
DNS is on Cloudflare (`sharon.ns` / `brett.ns`). Add **DNS only** (grey cloud):

```
Type: CNAME
Name: clerk
Target: frontend-api.clerk.services
Proxy: Off (DNS only)
```

Optional: `accounts` → `accounts.clerk.services` (DNS only).
Then Clerk Dashboard → Domains → **Deploy certificates**.
(Local `CLOUDFLARE_API_TOKEN` is invalid/expired — cannot automate this.)

### Done — clips R2 via Worker binding (no S3 API token needed)
- Worker: `https://coldcallreps-clips-r2.ezhalloween.workers.dev` → bucket `coldcallreps-clips`
- Env on Vercel + `.env.local`: `CLIPS_WORKER_URL`, `CLIPS_UPLOAD_SECRET`
- App uploads with `PUT /upload` + `x-clips-secret`; playback via `GET /object?key=…`
- Legacy `R2_*` S3 keys may still exist but are unused when worker env is set

### Done — Google Analytics
- Measurement ID `G-4KW9LFF6MZ` (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) live on coldcallreps.com

## Cron
- Weekly digest: `GET /api/digests/weekly/send` (Mon 14:00 UTC via `vercel.json`)
- Connect payout retry: `GET /api/cron/retry-payouts` every 30m — retries PENDING transfers when SDR Connect is ready (`CRON_SECRET`)

## Brand multi-seat
- `BrandMember` + `/api/brands/[id]/members` + settings invite UI
- Desk pages use `canAccessBrandDeskAsync` (owner / admin / viewer)
- Mutations use `canManageBrandId` (owner / admin)

## Maps leads (optional bonus)
- **API:** RapidAPI **[Maps Data](https://rapidapi.com/alexanderxbx/api/maps-data)** — host `maps-data.p.rapidapi.com`, endpoint `GET /searchmaps.php`
- Not Google Places official API; third-party Maps scrape via RapidAPI marketplace
- Optional in Trainer (collapsed under Advanced). Prefer-no-website filter is opt-in
- Requires `RAPIDAPI_MAPS_KEY` (+ `RAPIDAPI_MAPS_HOST=maps-data.p.rapidapi.com`) on Vercel + `.env.local`

## Brand / affiliate admin (honest status)
- **Have:** BRAND role, create brand + product packs, bounties, sponsored boards, certifications from high scores
- **Have (campaign payouts):** Stripe Connect onboarding for SDRs (`/api/billing/connect`), destination-charge Checkout when brand pays an approved application (`/api/campaigns/[id]/payouts`), ~20% `platformFeeBps`, `CampaignPayout` ledger
- **Have (integrations):** HubSpot OAuth + sync and Google Calendar OAuth when `HUBSPOT_CLIENT_*` / `GOOGLE_CLIENT_*` + `INTEGRATION_ENCRYPTION_KEY` are set. UI shows **Coming soon** only when those env vars are missing. Microsoft / Close / Salesforce remain stubs.
- **Missing for classic affiliate programs:** commission rates, click/referral attribution to brand offers, promo codes, affiliate dashboards
- User referrals today = minute bonuses (`/api/referrals`), not brand affiliate commissions
- Schema patch: `npm run db:patch:connect` (Turso) + `npx prisma db push` (local)
- Dual-mode desks (SDR ↔ Brand): `npm run db:patch:role-modes` (Turso) + `npx prisma db push` (local) + `npx prisma generate` (restart dev server)
- Brand members (multi-seat ACL): `BrandMember` model — owner invite via `/api/brands/[id]/members`

## Manual smoke
1. Set `RAPIDAPI_MAPS_KEY` → Search Maps → pick a “(no site)” prospect → practice call
2. Practice call → score → audio on session page + `/h/{id}`
3. Team subscribe → org pool tops up → member call draws from pool
4. Billing → buy 60-min pack → minutes credit

## Audit fixes (Wave 1–3)
### Wave 1 — Money & integrity
- Gate token binds `brandId`/`packId` + `MinuteHold` (1-min soft reserve); scorecard rejects client mismatch
- Atomic minute deduct (`updateMany` WHERE balance ≥ N) before/with session create; scorecard idempotent returns fresh minutes
- Bounty awards unique per user (`BountyAward`); Stripe `event.id` idempotency (`StripeEvent`)
- Referral unique on `refereeId` + idempotent apply
- Prospect IDOR: scenario prompt loads only user-owned prospects
- Direct Connect: no credit burn on Resend failure
- Account delete cancels Stripe subscription before clearing IDs
- Clip complete verifies R2 object (HEAD); media via `/api/clips/media?clipId=`
- Recruiter GET candidates gated on paid access
- Auto-verify only counts clean (no integrity flags) sessions
- `lastPaymentFailedAt` on payment_failed; webhook profile lookup by email/customer
- Outbound webhooks store `lastAttemptAt` / `lastError`

### Wave 2 — Funnel & roles
- GrowthBootstrap / SignUpClient honor `?role=` and `?plan=` (all plans); bootstrap on all app routes
- Role gates: recruiter upgrade CTA, admin forbidden, jobs/new + tournaments create gated via `/api/me`
- Integrations copy: workspace-link / coach memory only (not OAuth sync)
- Arena → trainer `?brandId=&packId=`; TrainerView preselects pack from URL
- Developers API keys gated to Pro/Recruiter/Team
- Job/brand detail: not-found UI (no infinite Loading)
- Playbook editor: loading + fetch errors; save blocked until loaded
- Billing “Manage subscription” only when `hasSubscription`
- Account delete → Clerk `signOut` → `/`
- Superadmin can open any session for review
- Direct Connect: sent on recruiter desk; inbox on hiring page

### Wave 3 — Polish & ops
- Visible load errors on settings / hiring / billing / arena
- AppNav mobile hamburger drawer
- Homepage live weekly leaderboard (sample fallback); testimonials marked illustrative
- Copy uses `/{slug}` not `/t/` `/r/`
- Unified open-to-work: “Open to work — appear on the hiring board”
- Maps prospects upsert by `userId` + `mapsPlaceId`
- Public brands GET strips pack scripts/objections; full content when authenticated
- Academy members: validate user exists; prefer email invite
- Playbooks: org-scoped create requires Team (`canManageTeam`); personal OK for all
- Leaderboard sessions bounded (`take: 2000`)
- Rate-limit documented as best-effort in-memory per instance
- Trainer Maps errors surfaced as friendly messages
- Clip upload failure feedback after score
