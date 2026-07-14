import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminSystemHealth } from '@/lib/admin-phase46-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Health access required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('health.read');
    return NextResponse.json(await loadAdminSystemHealth());
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('health.read');
    // Only SUPER can write flags — check via assign_ops as proxy for SUPER
    const { canOps } = await import('@/lib/admin-ops');
    if (!canOps(admin, 'users.assign_ops')) {
      return NextResponse.json({ error: 'Super ops required to edit flags' }, { status: 403 });
    }
    const body = await req.json();
    const key = String(body.key || '').trim();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const valueJSON =
      typeof body.valueJSON === 'string'
        ? body.valueJSON
        : JSON.stringify(body.value ?? {});

    const config = await prisma.adminConfig.upsert({
      where: { key },
      create: { key, valueJSON, updatedById: admin.id },
      update: { valueJSON, updatedById: admin.id },
    });

    await writeAudit({
      actorId: admin.id,
      action: 'admin.config.set',
      targetType: 'AdminConfig',
      targetId: key,
      meta: { valueJSON },
    });

    return NextResponse.json({ config });
  } catch (e) {
    return err(e);
  }
}
