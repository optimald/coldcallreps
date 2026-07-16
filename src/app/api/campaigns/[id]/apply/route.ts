import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrandId } from '@/lib/brand-acl';
import { isCampaignDialEligible, practiceHref } from '@/lib/campaigns';
import { loadOneCampaignSpend } from '@/lib/campaign-spend';
import { assertCanApplyToCampaign } from '@/lib/apply-gate';
import { notifyAsync } from '@/lib/notifications';
import { trackEvent } from '@/lib/posthog/analytics';

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
      include: {
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
        },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not open' }, { status: 404 });
    }
    const spend = await loadOneCampaignSpend(campaign.id);
    const eligible = isCampaignDialEligible({ ...campaign, ...spend });
    if (!eligible.ok) {
      return NextResponse.json(
        { error: eligible.reason || 'Campaign not open', code: 'CAMPAIGN_NOT_ELIGIBLE' },
        { status: 404 }
      );
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
      const { notifyAsync } = await import('@/lib/notifications');
      notifyAsync({
        event: 'campaign.apply.blocked',
        recipient: {
          userId: profile.id,
          email: profile.email,
          displayName: profile.displayName,
        },
        brand: {
          id: campaign.brand.id,
          name: campaign.brand.name,
          slug: campaign.brand.slug,
          logoUrl: campaign.brand.logoUrl,
        },
        payload: {
          campaignTitle: campaign.title,
          campaignId: campaign.id,
          reason: gate.error,
          gateCode: gate.code,
          practiceHref: gate.practiceHref,
          ctaUrl: gate.practiceHref,
          forAudience: 'sdr',
        },
        idempotencyKey: `campaign.apply.blocked:${campaign.id}:${profile.id}:${gate.code}`,
      });
      trackEvent(profile.id, 'campaign_apply_blocked', {
        role: 'REP',
        campaignId: campaign.id,
        brandId: campaign.brand.id,
        code: gate.code,
        sessionCount: gate.sessionCount,
        bestScore: gate.bestScore,
        certified: gate.certified,
      });
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

    if (campaign.brand.ownerId) {
      const owner = await prisma.userProfile.findUnique({
        where: { id: campaign.brand.ownerId },
        select: { id: true, email: true, displayName: true },
      });
      if (owner) {
        notifyAsync({
          event: 'campaign.application.submitted',
          recipient: {
            userId: owner.id,
            email: owner.email,
            displayName: owner.displayName,
          },
          brand: {
            id: campaign.brand.id,
            name: campaign.brand.name,
            slug: campaign.brand.slug,
            logoUrl: campaign.brand.logoUrl,
          },
          fromUserId: profile.id,
          payload: {
            campaignTitle: campaign.title,
            campaignId: campaign.id,
            applicationId: application.id,
            sdrName: profile.displayName || 'An SDR',
            customMessage: message || undefined,
            ctaUrl: campaign.brand.slug
              ? `/recruit?brand=${encodeURIComponent(campaign.brand.slug)}`
              : '/recruit',
          },
          idempotencyKey: `campaign.application.submitted:${application.id}:${application.updatedAt.toISOString()}`,
        });
      }
    }

    trackEvent(profile.id, 'campaign_applied', {
      role: 'REP',
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      brandId: campaign.brand.id,
      applicationId: application.id,
      isReapply: Boolean(existing),
    });

    if (campaign.brand.ownerId) {
      trackEvent(campaign.brand.ownerId, 'sdr_application_received', {
        role: 'BRAND',
        campaignId: campaign.id,
        brandId: campaign.brand.id,
        applicationId: application.id,
        sdrUserId: profile.id,
      });
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
