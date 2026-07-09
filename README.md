# Cold Call Reps (ColdCallReps.com)

Standalone voice-based cold call training simulator — extracted from TROJAN’s trainer package.

**Tagline:** Master Your Reps. Become a Top Rep.

## What shipped (V1 MVP)

- **Clerk** auth + org id on profiles
- **xAI Realtime voice** via **Cloudflare Durable Object** (prod) or `server.js` (local)
- Scenarios: Gatekeeper→DM, Gatekeeper only, Pricing, Rejection, **$500 Website Pitch**, **Sell Me This Pen**
- **Google Maps RapidAPI** prospect search + basic **website scraper** for hooks
- Scorecard (Grok), live coach, session history
- Points, streaks, badges, weekly/global **leaderboards**
- **Hiring board** opt-in
- **Stripe** Starter ($5) / Pro ($29) checkout + webhook minute resets
- **Referrals** — both sides get bonus minutes

## Quick start

```bash
cd coldcallreps.com
cp .env.example .env.local
# fill: DATABASE_URL, XAI_API_KEY, Clerk keys, Stripe, RAPIDAPI_MAPS_KEY

npm install
npx prisma db push
npm run dev          # local: Node server.js + bridge
# OR production-like:
#   npm run dev:next + npm run dev:voice
#   NEXT_PUBLIC_TRAINER_REALTIME_URL=ws://127.0.0.1:8787/api/trainer/realtime
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
Browser TrainerView (Vercel)
  → useXaiTrainerRealtime (PCM16 mic)
  → wss NEXT_PUBLIC_TRAINER_REALTIME_URL
  → Cloudflare Worker + Durable Object (TrainerSession)
  → wss://api.x.ai/v1/realtime (grok-voice-latest)
  → POST APP_ORIGIN/api/trainer/prompt (Vercel)
End call → POST /api/trainer/scorecard → Prisma + points
```

Local fallback: `server.js` + `trainer-realtime-bridge.js` (same protocol).

Ported from TROJAN (`v2_engine`):

| Asset | Source |
|-------|--------|
| Realtime bridge | `trainer-realtime-bridge.js` |
| Mic / playback hook | `useXaiTrainerRealtime.ts` |
| Live coach | `useLiveCoach.ts` + `lib/trainer/*` |
| LLM client | `lib/llm-client.ts` |
| Custom server pattern | slimmed from `server.js` (trainer path only) |

**Not ported:** Twilio dialer, full Lead model, Trigger.dev, WebEvo/OSINT.

## Env vars

See `.env.example`. Minimum for voice:

- `XAI_API_KEY`
- `DATABASE_URL`
- Clerk publishable + secret keys

Optional: `RAPIDAPI_MAPS_KEY`, Stripe keys/price IDs.

## Pricing (defaults)

| Plan | Price | Minutes |
|------|-------|---------|
| Starter | $5/mo | 80 (env `STARTER_MONTHLY_MINUTES`) |
| Pro | $29/mo | 500 (env `PRO_MONTHLY_MINUTES`) |

Referral bonus: `REFERRAL_BONUS_MINUTES` (default 30) to both sides.

## Deploy notes

- **Vercel** — Next.js app (`npm run build` → `next start` / Vercel default)
- **Cloudflare Durable Object** — voice bridge (`npm run deploy:voice`); set `NEXT_PUBLIC_TRAINER_REALTIME_URL`
- Worker `APP_ORIGIN` must be the Vercel URL so the DO can `POST /api/trainer/prompt`
- Run `prisma db push` once `DATABASE_URL` is set
- Apex/`www` DNS → Vercel; optional `voice.` CNAME → workers.dev (or Workers custom domain)
- Stripe webhook → `https://coldcallreps.com/api/billing/webhook`

## Legal (ship before public launch)

Add Privacy Policy + Terms covering:

- Voice/transcript storage
- Scraping / Maps data disclaimers
- Hiring board public profile consent

## V2 (deferred)

Deep Trojan integrations, video replay, custom avatars, advanced analytics, full enterprise orgs.
