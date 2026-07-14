import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminCampaignsOps } from '@/lib/admin-phase46-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Campaign ops required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('campaigns.ops');
    return NextResponse.json(await loadAdminCampaignsOps());
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('campaigns.ops');
    const body = await req.json();
    const campaignId = String(body.campaignId || '');
    const action = String(body.action || '');
    const reason = String(body.reason || '').trim();
    if (!campaignId || reason.length < 3) {
      return NextResponse.json(
        { error: 'campaignId and reason required' },
        { status: 400 }
      );
    }
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let status = campaign.status;
    if (action === 'pause') status = 'PAUSED';
    else if (action === 'unpublish' || action === 'close') status = 'CLOSED';
    else if (action === 'open') status = 'OPEN';
    else {
      return NextResponse.json({ error: 'action: pause|open|close' }, { status: 400 });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status },
    });

    await writeAudit({
      actorId: admin.id,
      action: `admin.campaign.${action}`,
      targetType: 'Campaign',
      targetId: campaignId,
      meta: { before: campaign.status, after: status, reason },
    });

    return NextResponse.json({ campaign: updated });
  } catch (e) {
    return err(e);
  }
}
