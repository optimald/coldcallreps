import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkoutLead, releaseCheckout } from '@/lib/lead-queue';
import { resolveProspectAccess } from '@/lib/prospect-access';

type Ctx = { params: Promise<{ id: string }> };

/** POST — 10-minute hot-potato checkout for this lead. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = await checkoutLead(id, profile.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      checkedOutUntil: result.checkedOutUntil.toISOString(),
      prospectId: result.prospect.id,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE — release checkout early. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    await releaseCheckout(id, profile.id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
