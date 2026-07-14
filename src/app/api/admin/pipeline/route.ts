import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminPipelineOps } from '@/lib/admin-phase46-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { grantLeadPack } from '@/lib/lead-credits';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Pipeline ops required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('pipeline.ops');
    return NextResponse.json(await loadAdminPipelineOps());
  } catch (e) {
    return err(e);
  }
}

/** Refund lead credits for a bad batch (adjustment). */
export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('pipeline.ops');
    const body = await req.json();
    const brandId = String(body.brandId || '');
    const credits = Math.floor(Number(body.credits) || 0);
    const reason = String(body.reason || '').trim();
    if (!brandId || credits < 1 || reason.length < 3) {
      return NextResponse.json(
        { error: 'brandId, credits (≥1), and reason required' },
        { status: 400 }
      );
    }
    await grantLeadPack(brandId, credits, { note: `admin_refund:${reason}` });
    await writeAudit({
      actorId: admin.id,
      action: 'admin.pipeline.credit_refund',
      targetType: 'Brand',
      targetId: brandId,
      meta: { credits, reason },
    });
    // Mark failed job acknowledged
    if (body.jobId) {
      await prisma.pipelineJob.update({
        where: { id: String(body.jobId) },
        data: { errorMessage: `[acked] ${reason}` },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
