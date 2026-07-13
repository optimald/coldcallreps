import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads } from '@/lib/brand-leads';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — brand-wide audit of prospect changes (who changed what).
 * Query: ?limit=100
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: brandKey } = await ctx.params;

    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id: brandKey }, { slug: brandKey }] },
      select: { id: true, name: true },
    });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!(await canManageBrandLeads(profile, brand.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));

    const prospectIds = (
      await prisma.prospect.findMany({
        where: { brandId: brand.id },
        select: { id: true, companyName: true },
        take: 5000,
      })
    ).map((p) => p.id);

    if (!prospectIds.length) {
      return NextResponse.json({ audits: [], brand: { id: brand.id, name: brand.name } });
    }

    const nameById = Object.fromEntries(
      (
        await prisma.prospect.findMany({
          where: { id: { in: prospectIds } },
          select: { id: true, companyName: true },
        })
      ).map((p) => [p.id, p.companyName])
    );

    const rows = await prisma.auditLog.findMany({
      where: {
        targetType: 'prospect',
        targetId: { in: prospectIds },
        action: { in: ['prospect.update', 'prospect.delete'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        targetId: true,
        metaJSON: true,
        createdAt: true,
        actorId: true,
        actor: { select: { displayName: true, email: true } },
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
        targetId: r.targetId,
        companyName: (r.targetId && nameById[r.targetId]) || 'Lead',
        createdAt: r.createdAt.toISOString(),
        actorName:
          r.actor?.displayName ||
          r.actor?.email ||
          (typeof meta.actorName === 'string' ? meta.actorName : null) ||
          'Unknown',
        actorEmail: r.actor?.email || null,
        meta,
      };
    });

    return NextResponse.json({
      brand: { id: brand.id, name: brand.name },
      audits,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
