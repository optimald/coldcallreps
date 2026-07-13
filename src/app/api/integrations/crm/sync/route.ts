import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pullConnectedCrms, pushProspectToConnectedCrms } from '@/lib/crm/sync';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads } from '@/lib/brand-leads';

/**
 * POST /api/integrations/crm/sync
 * Body: { direction: 'push' | 'pull', prospectIds?: string[] }
 * Prospects remain source of truth; adapters sync outward/inward.
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const direction = String(body.direction || 'push');

    if (direction === 'pull') {
      const results = await pullConnectedCrms(profile.id);
      return NextResponse.json({ ok: true, direction: 'pull', results });
    }

    const prospectIds: string[] = Array.isArray(body.prospectIds)
      ? body.prospectIds.map(String)
      : body.prospectId
        ? [String(body.prospectId)]
        : [];

    if (prospectIds.length === 0) {
      return NextResponse.json(
        { error: 'prospectIds required for push' },
        { status: 400 }
      );
    }

    const prospects = await prisma.prospect.findMany({
      where: { id: { in: prospectIds } },
    });
    if (prospects.length !== prospectIds.length) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    for (const p of prospects) {
      const personal = p.userId === profile.id && !p.brandId;
      const brandOk = !!p.brandId && (await canManageBrandLeads(profile, p.brandId));
      if (!personal && !brandOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const pushed = [];
    for (const p of prospects) {
      const adapters = await pushProspectToConnectedCrms(profile.id, p);
      pushed.push({ prospectId: p.id, adapters });
    }

    return NextResponse.json({ ok: true, direction: 'push', pushed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
