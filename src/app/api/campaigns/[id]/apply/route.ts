import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { practiceHref } from '@/lib/campaigns';
import { assertCanApplyToCampaign } from '@/lib/apply-gate';

/**
 * POST — SDR applies to an OPEN campaign after AI trainer gate.
 * Body optional: { message?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { ownerId: true, name: true } } },
    });
    if (!campaign || campaign.status !== 'OPEN') {
      return NextResponse.json({ error: 'Campaign not open' }, { status: 404 });
    }
    if (canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json(
        { error: 'Brand managers cannot apply to their own campaigns' },
        { status: 400 }
      );
    }

    const gate = await assertCanApplyToCampaign({
      userId: profile.id,
      campaign,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.error,
          code: gate.code,
          practiceHref: gate.practiceHref,
          bestScore: gate.bestScore,
          sessionCount: gate.sessionCount,
          minScore: gate.minScore,
          requireCertification: gate.requireCertification,
          certified: gate.certified,
        },
        { status: gate.status }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message ? String(body.message).slice(0, 2000) : null;

    const existing = await prisma.campaignApplication.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId: profile.id } },
    });

    if (existing && !['WITHDRAWN', 'REJECTED'].includes(existing.status)) {
      return NextResponse.json(
        {
          error: 'Already applied',
          application: existing,
          practiceHref: practiceHref(campaign),
        },
        { status: 409 }
      );
    }

    const application = existing
      ? await prisma.campaignApplication.update({
          where: { id: existing.id },
          data: { status: 'APPLIED', message },
        })
      : await prisma.campaignApplication.create({
          data: {
            campaignId: campaign.id,
            userId: profile.id,
            message,
            status: 'APPLIED',
          },
        });

    return NextResponse.json({
      application,
      notice: 'Application submitted. The brand will review and activate you.',
      practiceHref: practiceHref(campaign),
      gate: { bestScore: gate.bestScore, sessionCount: gate.sessionCount, certified: gate.certified },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
