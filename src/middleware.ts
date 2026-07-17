import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/for(.*)',
  '/pricing(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/developers(.*)',
  '/guides(.*)',
  '/llms.txt',
  '/sitemap.xml',
  '/robots.txt',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/media(.*)',
  '/r/(.*)',
  '/t/(.*)',
  '/h/(.*)',
  '/api/highlights/(.*)',
  '/api/billing/webhook(.*)',
  '/api/digests/weekly/send(.*)',
  '/api/hiring/board(.*)',
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
  // Meeting attribution: prospect lands on Cal success redirect (token is the credential)
  '/book(.*)',
  '/api/bookings/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Vanity handles (/jane), profile + team APIs require sign-in.
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-ccr-pathname', req.nextUrl.pathname);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    // Skip Next internals, PostHog reverse proxy (/ccr-ph), and common static assets
    '/((?!_next|ccr-ph|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov|txt|xml)).*)',
    '/(api|trpc)(.*)',
  ],
};
