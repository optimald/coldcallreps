import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { RESERVED_HANDLES, slugify } from '@/lib/handles';

const isPublicRoute = createRouteMatcher([
  '/',
  '/for(.*)',
  '/pricing(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/developers(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/r/(.*)',
  '/t/(.*)',
  '/h/(.*)',
  '/api/team/(.*)',
  '/api/highlights/(.*)',
  '/api/billing/webhook(.*)',
  '/api/digests/weekly/send(.*)',
  '/api/hiring/board(.*)',
  '/api/profile/(.*)',
  '/api/profile/handle(.*)',
  '/api/clips/media(.*)',
  '/api/brands(.*)',
  '/api/arena(.*)',
  '/api/jobs(.*)',
  '/api/tournaments(.*)',
  // Worker-facing: auth via TRAINER_INTERNAL_SECRET or signed gate token
  '/api/trainer/prompt(.*)',
  '/api/trainer/hint(.*)',
  '/api/trainer/script(.*)',
  '/api/trainer/session-gate(.*)',
  '/api/trainer/leaderboard(.*)',
  '/api/v1/(.*)',
  // Twilio voice webhooks (server-to-server signature checked in route)
  '/api/twilio/voice(.*)',
  '/api/twilio/inbound(.*)',
]);

/** Single-segment vanity handles like /jane — not reserved app routes. */
function isVanityPublicPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return false;
  const raw = segments[0];
  // Static-looking paths (favicon.ico, robots.txt, etc.) are not vanity handles.
  if (/\.[a-z0-9]{1,8}$/i.test(raw)) return false;
  const slug = slugify(raw);
  if (!slug || RESERVED_HANDLES.has(slug)) return false;
  return true;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req) || isVanityPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
