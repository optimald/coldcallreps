# Cold Call Reps (ColdCallReps.com)

Standalone voice-based cold call training — **Master Your Reps. Become a Top Rep.**

Repo: https://github.com/optimald/coldcallreps

## What shipped

### V1 Rep Gym
- Clerk auth · Stripe checkout/portal · minutes gate before calls
- xAI Realtime via **Cloudflare Durable Object** (or local `server.js`)
- Scenarios: Gatekeeper→DM, Gatekeeper, Pricing, Rejection, **$500 Website Pitch**, **Sell Me This Pen**
- Scorecards, live coach, session detail + integrity signals
- Points, streaks, badges, global + org leaderboards
- Hiring board with headline/bio · referrals (`?ref=`) · plan deep-links (`?plan=`)
- Privacy + Terms

### V2 Talent Signal
- Public `/r/[slug]` profiles · clip highlights publish to profile
- Recruiter Direct Connect + inbox · job detail + apply
- Weekly Top Reps digest (Resend cron) · academy members/progress

### V3 Brand Arena
- Brand packs in trainer · sponsored boards + bounties
- Certified closer on score ≥80 · attribution events
- Session highlight clips → public profile

### V4 Cold Call OS
- CRM workspace link + coach memory → live coach
- Tournaments + season passes · score sync from practice
- Playbook editor → trainer/coach
- API keys + `/api/v1/leaderboard` + `/api/v1/profiles/:slug` + `/api/v1/sessions`
- Roles (Rep / Recruiter / Brand / Manager / Superadmin) + `/admin`
- Session gate, integrity gates, webhooks, bounty credits, account export/delete

## Quick start

```bash
cp .env.example .env.local
# fill: TURSO_AUTH_TOKEN (Turso), XAI_API_KEY, Clerk, Stripe, RAPIDAPI_MAPS_KEY
# DATABASE_URL stays file:./prisma/dev.db for Prisma CLI; app uses Turso via adapter

npm install
npx prisma generate
npm run db:push:turso   # push schema to Turso (needs TURSO_* in .env.local)
npm run db:patch:role-modes  # Turso: unlockedRoles + onboarding timestamps (safe re-run)
# optional local file DB: npx prisma db push
npm run seed:demo-brands && npm run seed:dispatchnode
npm run dev          # local Node bridge
# OR: npm run dev:next + npm run dev:voice
#     NEXT_PUBLIC_TRAINER_REALTIME_URL=ws://127.0.0.1:8787/api/trainer/realtime
```

**Database:** [Turso](https://turso.tech) (libSQL) via `@prisma/adapter-libsql`. Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in `.env.local` (gitignored). Prisma CLI uses `DATABASE_URL=file:./prisma/dev.db`.

## Architecture

```
Browser (Vercel Next.js)
  → wss NEXT_PUBLIC_TRAINER_REALTIME_URL
  → Cloudflare DO TrainerSession
  → xAI Realtime + POST APP_ORIGIN/api/trainer/prompt
End call → scorecard → Prisma + points / minutes
```

## Pricing

| Plan | Price | Minutes |
|------|-------|---------|
| Free | $0 | **5** minutes on signup (`TRIAL_MINUTES`) |
| Starter | **$7**/mo | **100** minutes / billing cycle |
| Pro | **$29**/mo | **600** minutes / billing cycle |
| Org (TEAM) | **$60/user/mo** | **60** practice minutes / user / mo (pooled) |

Marketplace: brands/founders pay; reps free for gigs; ~20% platform fee on payouts via Stripe Connect (destination charges).

**Ops:** Stripe Price IDs must match these amounts — update `STRIPE_STARTER_PRICE_ID` for **$7** Starter (and any other changed amounts) in the Dashboard.

`STRIPE_TEAM_PRICE_ID` must be a **$60/seat** Stripe price. Defaults: `TEAM_MINUTES_PER_SEAT=60`.

Referral bonus: `REFERRAL_BONUS_MINUTES` (defaults to one month of Starter minutes).

## Deploy

- Vercel for Next.js · Cloudflare DO for voice (`npm run deploy:voice`)
- Set `NEXT_PUBLIC_TRAINER_REALTIME_URL` + worker `APP_ORIGIN`
- Stripe webhook → `/api/billing/webhook`
- Set `TRIAL_MINUTES=5` on Vercel production (match `.env.example` / product allotment)
- Update Stripe prices for Starter $7 / Pro $29 before live checkout