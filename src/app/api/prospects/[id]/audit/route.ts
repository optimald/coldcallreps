import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveProspectAccess } from '@/lib/prospect-access';

type Ctx = { params: Promise<{ id: string }> };

function canViewLeadAudit(via: string) {
  return via === 'brand' || via === 'superadmin';
}

/** GET — brand-only audit trail for a prospect. Includes actor. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewLeadAudit(access.via)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.auditLog.findMany({
      where: { targetType: 'prospect', targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        metaJSON: true,
        createdAt: true,
        actorId: true,
        actor: { select: { id: true, displayName: true, email: true } },
      },
    });

    const audits = rows.map((r) => {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(r.metaJSON || '{}');
      } catch {
        meta = {};
      }
      return {
        id: r.id,
        action: r.action,
        createdAt: r.createdAt.toISOString(),
        actorId: r.actorId,
        actorName:
          r.actor?.displayName ||
          r.actor?.email ||
          (typeof meta.actorName === 'string' ? meta.actorName : null) ||
          'Unknown',
        actorEmail: r.actor?.email || (typeof meta.actorEmail === 'string' ? meta.actorEmail : null),
        meta,
      };
    });

    return NextResponse.json({ audits });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
