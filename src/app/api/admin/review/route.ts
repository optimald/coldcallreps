import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminReviewQueue } from '@/lib/admin-platform';
import { writeAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

export async function GET() {
  try {
    await requireOps('trust.review');
    const data = await loadAdminReviewQueue();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Trust access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH — resolve a review item.
 * Body:
 *  { kind: 'call', id, action: 'clear' }
 *  { kind: 'claim', id, action: 'approve' | 'reject' }
 */
export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('trust.review');
    const body = await req.json();
    const kind = String(body.kind || '');
    const id = String(body.id || '');
    const action = String(body.action || '');

    if (!id || (kind !== 'call' && kind !== 'claim')) {
      return NextResponse.json({ error: 'kind and id required' }, { status: 400 });
    }

    if (kind === 'call') {
      if (action !== 'clear') {
        return NextResponse.json({ error: 'action must be clear' }, { status: 400 });
      }
      const call = await prisma.callLog.findUnique({ where: { id } });
      if (!call) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
      }
      await prisma.callLog.update({
        where: { id },
        data: { needsManualReview: false },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.review.clear_call',
        targetType: 'callLog',
        targetId: id,
      });
    } else {
      if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json(
          { error: 'action must be approve or reject' },
          { status: 400 }
        );
      }
      const claim = await prisma.appointmentClaim.findUnique({ where: { id } });
      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }

      if (action === 'approve') {
        await prisma.appointmentClaim.update({
          where: { id },
          data: {
            status: 'PASSED',
            failureReason: null,
            verifiedAt: new Date(),
            auditJSON: JSON.stringify({
              ...(safeJson(claim.auditJSON) || {}),
              adminOverride: true,
              adminId: admin.id,
              adminAction: 'approve',
              at: new Date().toISOString(),
            }),
          },
        });
        const { releaseAppointmentClaimPayout } = await import('@/lib/claim-payout');
        const paid = await releaseAppointmentClaimPayout(id);
        if (!paid.ok) {
          console.warn('[admin/review] approve payout', paid.error);
        }
      } else {
        await prisma.appointmentClaim.update({
          where: { id },
          data: {
            status: 'FAILED',
            failureReason:
              claim.failureReason ||
              `Rejected by admin (${admin.email})`,
            auditJSON: JSON.stringify({
              ...(safeJson(claim.auditJSON) || {}),
              adminOverride: true,
              adminId: admin.id,
              adminAction: 'reject',
              at: new Date().toISOString(),
            }),
          },
        });
      }

      if (claim.callLogId) {
        await prisma.callLog
          .update({
            where: { id: claim.callLogId },
            data: {
              needsManualReview: false,
              isAudited: true,
              ...(action === 'approve'
                ? { status: 'APPOINTMENT_SET', outcome: 'appointment_set' }
                : {}),
            },
          })
          .catch(() => null);
      }

      await writeAudit({
        actorId: admin.id,
        action: `admin.review.claim_${action}`,
        targetType: 'appointmentClaim',
        targetId: id,
      });
    }

    const data = await loadAdminReviewQueue();
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Superadmin required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function safeJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
