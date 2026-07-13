import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  normalizeWebsiteUrl,
  resolveBrandLogoFromWebsite,
} from '@/lib/fetch-brand-logo';

/**
 * POST /api/brands/logo-preview
 * Body: { websiteUrl: string }
 * Returns { logoUrl } resolved from the company site (for create-brand UI).
 */
export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const websiteUrl = normalizeWebsiteUrl(String(body.websiteUrl || body.url || ''));
    if (!websiteUrl) {
      return NextResponse.json({ error: 'Valid website URL required' }, { status: 400 });
    }
    const logoUrl = await resolveBrandLogoFromWebsite(websiteUrl);
    return NextResponse.json({ logoUrl, websiteUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
