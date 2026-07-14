import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminDialerOps } from '@/lib/admin-phase46-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { toE164 } from '@/lib/twilio-auth';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Dialer ops required' }, { status: 403 });
  }
  console.error('[admin/dialer]', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('dialer.ops');
    return NextResponse.json(await loadAdminDialerOps());
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('dialer.ops');
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'dnc_add') {
      const phoneE164 = toE164(String(body.phone || ''));
      const brandId = body.brandId ? String(body.brandId) : null;
      const scope = brandId ? 'brand' : 'global';
      const reason = String(body.reason || '').trim() || 'Admin DNC';
      const existing = await prisma.doNotCallEntry.findFirst({
        where: { phoneE164, brandId },
      });
      const entry = existing
        ? await prisma.doNotCallEntry.update({
            where: { id: existing.id },
            data: { reason, source: 'admin' },
          })
        : await prisma.doNotCallEntry.create({
            data: {
              phoneE164,
              brandId,
              scope,
              reason,
              source: 'admin',
              createdById: admin.id,
            },
          });
      await prisma.prospect.updateMany({
        where: { phone: { contains: phoneE164.replace(/\D/g, '').slice(-10) } },
        data: {
          doNotCall: true,
          doNotCallReason: reason,
          doNotCallAt: new Date(),
          consentStatus: 'revoked',
          consentAt: new Date(),
          consentSource: 'admin_dnc',
        },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.dnc.add',
        targetType: 'DoNotCallEntry',
        targetId: entry.id,
        meta: { phoneE164, reason, scope },
      });
      return NextResponse.json({ entry });
    }

    if (action === 'dnc_remove') {
      const id = String(body.id || '');
      await prisma.doNotCallEntry.delete({ where: { id } });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.dnc.remove',
        targetType: 'DoNotCallEntry',
        targetId: id,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'phone_retire') {
      const id = String(body.id || '');
      const phone = await prisma.brandPhoneNumber.update({
        where: { id },
        data: { isActive: false },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.phone.retire',
        targetType: 'BrandPhoneNumber',
        targetId: id,
        meta: { e164: phone.e164 },
      });
      return NextResponse.json({ phone });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return err(e);
  }
}
