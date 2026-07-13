import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { dispatchPipelineTask, auditCallTask } from '@/trigger/tasks';

/**
 * POST /api/calls/[id]/appointment
 * SDR marks appointment set → queues AI audit + escrow release.
 * Body: { transcript?, notes?, recordingUrl? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: callLogId } = await params;
    const body = await req.json().catch(() => ({}));

    const callLog = await prisma.callLog.findUnique({ where: { id: callLogId } });
    if (!callLog) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = callLog.userId === profile.id;
    let brandOk = false;
    if (callLog.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: callLog.brandId },
        select: { ownerId: true },
      });
      brandOk = !!brand && canManageBrand(profile, brand.ownerId);
    }
    if (!isOwner && !brandOk && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const transcript = body.transcript
      ? String(body.transcript).slice(0, 50000)
      : callLog.transcript;
    const notes = body.notes ? String(body.notes).slice(0, 8000) : callLog.notes;
    const recordingUrl = body.recordingUrl
      ? String(body.recordingUrl).slice(0, 2000)
      : callLog.recordingUrl;

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        status: 'APPOINTMENT_SET',
        outcome: 'appointment_set',
        transcript,
        notes,
        recordingUrl,
        isAudited: false,
      },
    });

    if (callLog.prospectId) {
      await prisma.prospect.update({
        where: { id: callLog.prospectId },
        data: { status: 'done' },
      });
    }

    const { mode, result } = await dispatchPipelineTask('audit-call-task', () =>
      auditCallTask({ callLogId })
    );

    return NextResponse.json({ ok: true, mode, audit: result });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[calls/appointment]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
