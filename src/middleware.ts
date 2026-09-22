import { NextResponse, type NextRequest } from 'next/server';
import { AGENT_SITE, agentDiscoveryLinkHeader } from '@/lib/agent-ready';
import { SITE_HOST, SITE_WWW_HOST } from '@/lib/site';

function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const lower = accept.toLowerCase();
  const md = lower.includes('text/markdown');
  if (!md) return false;
  const mdIdx = lower.indexOf('text/markdown');
  const htmlIdx = lower.indexOf('text/html');
  if (htmlIdx === -1) return true;
  return mdIdx < htmlIdx;
}

function withAgentHeaders(res: NextResponse, pathname: string): NextResponse {
  if (pathname === '/' || pathname === '') {
    res.headers.append('Link', agentDiscoveryLinkHeader(AGENT_SITE));
  }
  return res;
}

/** 301 www → apex so Google consolidates equity on coldcallreps.com. */
function wwwToApex(req: NextRequest): NextResponse | null {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (host !== SITE_WWW_HOST) return null;

  const url = req.nextUrl.clone();
  url.hostname = SITE_HOST;
  url.protocol = 'https:';
  url.port = '';
  return NextResponse.redirect(url, 301);
}

/**
 * Marketing-only site — no Clerk. Adds agent discovery Link headers on `/`
 * and serves llms.txt when Accept prefers text/markdown.
 */
export async function middleware(req: NextRequest) {
  const apex = wwwToApex(req);
  if (apex) return apex;

  const { pathname } = req.nextUrl;

  if (prefersMarkdown(req.headers.get('accept')) && (pathname === '/' || pathname === '')) {
    try {
      const mdRes = await fetch(new URL('/llms.txt', req.url));
      if (mdRes.ok) {
        const text = await mdRes.text();
        const res = new NextResponse(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            Vary: 'Accept',
            'Cache-Control': 'public, max-age=300',
          },
        });
        return withAgentHeaders(res, pathname);
      }
    } catch {
      /* fall through to HTML */
    }
  }

  const res = NextResponse.next();
  return withAgentHeaders(res, pathname);
}

export const config = {
  matcher: [
    /*
     * Run on almost everything so www→apex 301 covers sitemap/robots/llms/static
     * discovery files. Skip Next internals + PostHog proxy only.
     */
    '/((?!_next/static|_next/image|ccr-ph).*)',
  ],
};
