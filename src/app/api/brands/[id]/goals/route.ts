import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { canAccessBrandDesk } from '@/lib/roles';
import { loadVerifiedGoals } from '@/lib/verified-goals';

/** GET verified goals (payout-eligible outcomes) for a brand. */
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

    const goals = await loadVerifiedGoals({ brandId: brand.id, take: 100 });
    return NextResponse.json({ goals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
