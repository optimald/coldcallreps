# ColdCallReps provisioning status

## Done

### Clerk
- App: **Cold Call Reps** (`app_3GFbEkiK88APAKxy7On4Yr6cfq6`)
- Dev instance: `ins_3GFbEn5HJVVHBRsoGyrb908E6Qt`
- Linked + keys in `.env.local` (`pk_test_…` / `sk_test_…`)
- Production instance: **not created yet** (needed for `clerk.*` / `accounts.*` DNS on coldcallreps.com)

### Resend
- Domain `coldcallreps.com` **verified** (DKIM/SPF already on Cloudflare)
- API key created: `ColdCallReps App` (sending_access, scoped to domain)
- Written to `.env.local` as `RESEND_API_KEY`
- From: `reps@coldcallreps.com`

### Stripe (products)
| Item | ID |
|------|-----|
| Starter product | `prod_UqqkXqKrQtWEz1` |
| Starter price $5/mo | `price_1Tr93IIhMqnu89aE7Ow538NS` |
| Pro product | `prod_UqqkkWtuyoWI55` |
| Pro price $29/mo | `price_1Tr93SIhMqnu89aEVNi3NtDC` |

Still need: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, webhook secret.

### xAI
- `XAI_API_KEY` in `.env.local`

### Cloudflare
- Zone `coldcallreps.com` active (`25b23fd7cda7c56c570a5990709acb13`)
- OAuth has **zone:read only** — cannot create/edit DNS records via API
- Resend DNS already verified (email records exist)
- For Clerk production CNAMEs: need a token with **Zone → DNS → Edit**, or add records manually from Clerk Dashboard after production deploy

### Supabase
- Project: https://supabase.com/dashboard/project/fepsjnnluksgwgpxnzqt
- Need `DATABASE_URL` for `prisma db push`

### Vercel
- Team `optimaldev` (`team_QpWnQysFyvZdtdPny9xP7SRB`) connected as user `optimald`
- Hosting target: **Next.js on Vercel** (not Render Node)
- **Blocked:** Team hit fair-use limits (`402` on `vercel link`) — unblock at https://vercel.link/fair-use before deploy
- `vercel.json` added (Next.js + prisma generate)

### Cloudflare Durable Objects
- Worker **deployed**: https://coldcallreps-trainer-realtime.ezhalloween.workers.dev
- Health: `GET /health` → `{ ok: true }`
- Class: `TrainerSession` — one DO per call; browser WS + outbound xAI WS
- Secret `XAI_API_KEY` set; `APP_ORIGIN` var = `https://coldcallreps.com` (update after Vercel URL exists)
- Frontend `.env.local`: `NEXT_PUBLIC_TRAINER_REALTIME_URL=wss://coldcallreps-trainer-realtime.ezhalloween.workers.dev/api/trainer/realtime`

## Next actions
1. Unblock Vercel team fair-use → `vercel link` + `vercel --prod` + env vars
2. Paste Supabase `DATABASE_URL` → `prisma db push`
3. After Vercel URL: `wrangler secret put APP_ORIGIN` (or update `[vars]`) to the real Next origin
4. Create Clerk production → CNAMEs on Cloudflare (**DNS only**)
5. Stripe webhook → production Vercel URL
