import { NextResponse } from 'next/server';
import { SITE_ORIGIN } from '@/lib/site';

const DISALLOW = [
  '/api/',
  '/admin/',
  '/dashboard',
  '/settings',
  '/billing',
  '/onboarding',
  '/brands/',
  '/cold_calls',
  '/practice',
  '/trainer',
  '/earnings',
  '/subscribe',
  '/book/',
  '/restricted',
];

const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
] as const;

/** Content Signals — search ok, allow ai-input for agents, disallow training scrapes. */
const CONTENT_SIGNAL = 'search=yes, ai-train=no, ai-input=yes';

function block(userAgent: string): string {
  const lines = [
    `User-Agent: ${userAgent}`,
    `Content-Signal: ${CONTENT_SIGNAL}`,
    'Allow: /',
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    '',
  ];
  return lines.join('\n');
}

export function GET() {
  const body = [
    block('*'),
    ...AI_BOTS.map((bot) => block(bot)),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    `Host: ${SITE_ORIGIN}`,
    '',
  ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
