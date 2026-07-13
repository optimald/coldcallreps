import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { loadBrandPortfolio } from '@/lib/brand-portfolio';

/** GET /api/brands/portfolio — cross-brand rollup for Home. */
export async function GET() {
  try {
    const profile = await requireUser();
    return NextResponse.json(await loadBrandPortfolio(profile));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
