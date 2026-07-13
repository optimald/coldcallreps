import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { loadBrandTeamRoster } from '@/lib/brand-team';
import { canAccessBrandDesk } from '@/lib/roles';

/** GET active SDR roster for a brand (account Team page). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const { brand, deskMode } = await requireDeskBrand(id);
    if (!canAccessBrandDesk(profile, brand, deskMode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const team = await loadBrandTeamRoster({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
    });

    return NextResponse.json({ team });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
