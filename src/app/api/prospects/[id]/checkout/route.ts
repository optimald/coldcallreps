import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkoutLead, releaseCheckout } from '@/lib/lead-queue';

type Ctx = { params: Promise<{ id: string }> };

/** POST — 10-minute hot-potato checkout for this lead. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Release failed' },
      { status: 500 }
    );
  }
}
