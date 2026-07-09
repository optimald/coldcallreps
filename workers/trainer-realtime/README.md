# Trainer Realtime — Cloudflare Durable Object

Browser WebSocket bridge to xAI Realtime. One Durable Object instance per training call.

## Architecture

```
Browser (Vercel Next.js)
  → wss://…/api/trainer/realtime
  → Worker → Durable Object (TrainerSession)
  → outbound WS to api.x.ai/v1/realtime
  → HTTP POST APP_ORIGIN/api/trainer/prompt (scenario)
```

## Setup

```bash
cd workers/trainer-realtime
npm install

# Secret (xAI)
npx wrangler secret put XAI_API_KEY

# Optional: point at preview/prod Next origin
npx wrangler secret put APP_ORIGIN
# or set [vars].APP_ORIGIN in wrangler.toml

npx wrangler deploy
```

Copy the `*.workers.dev` URL into the Next app:

```
NEXT_PUBLIC_TRAINER_REALTIME_URL=wss://coldcallreps-trainer-realtime.<subdomain>.workers.dev/api/trainer/realtime
```

## Local

```bash
# Terminal A — Next (or node server.js for same-origin WS)
npm run dev:next

# Terminal B — DO worker
npm run dev:voice
# then set NEXT_PUBLIC_TRAINER_REALTIME_URL=ws://127.0.0.1:8787/api/trainer/realtime
```

For local-only without Workers, keep using `npm run dev` (`server.js` + Node bridge).
