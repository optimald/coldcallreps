import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

const OUTCOMES = new Set([
  'interested',
  'callback',
  'not_interested',
  'voicemail',
  'no_answer',
]);

/** PATCH — save practice wrap disposition + notes onto a scored session. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const session = await prisma.trainerSession.findFirst({
      where: { id, userId: profile.id },
      select: { id: true },
    });
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: { outcome?: string | null; wrapNotes?: string | null } = {};

    if (body.outcome !== undefined) {
      const raw = body.outcome == null ? null : String(body.outcome);
      if (raw && !OUTCOMES.has(raw)) {
        return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
      }
      data.outcome = raw;
    }
    if (body.wrapNotes !== undefined) {
      data.wrapNotes = body.wrapNotes ? String(body.wrapNotes).slice(0, 4000) : null;
    }

    const updated = await prisma.trainerSession.update({
      where: { id },
      data,
      select: {
        id: true,
        outcome: true,
        wrapNotes: true,
        overallScore: true,
        duration: true,
      },
    });

    return NextResponse.json({ session: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
