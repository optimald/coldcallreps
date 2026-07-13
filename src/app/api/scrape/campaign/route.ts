import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { dispatchPipelineTask, runScoutCampaignInline } from '@/trigger/tasks';
import { SCOUT_CAMPAIGN_TASK_ID } from '@/trigger/tasks';

/**
 * POST /api/scrape/campaign
 * Founder "Scout targets" / Launch Campaign entry — runs P1→P2→P3 then STOP.
 *
 * Body: { brandId, campaignId, query, location, maxResults?, noWebsiteOnly?, async? }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const brandId = String(body.brandId || '').trim();
    const query = String(body.query || body.vertical || '').trim();
    const location = String(body.location || body.geo || '').trim();
    const campaignId = body.campaignId ? String(body.campaignId) : null;
    const maxResults =
      body.maxResults != null ? Math.min(25, Math.max(1, Number(body.maxResults))) : 10;
    const noWebsiteOnly = body.noWebsiteOnly !== false;

    if (!brandId || !query || !location) {
      return NextResponse.json(
        { error: 'brandId, query (vertical), and location required' },
        { status: 400 }
      );
    }
    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId required — enroll generated leads in a campaign' },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const ownerUserId = brand.ownerId || profile.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId },
    });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found on brand' }, { status: 404 });
    }
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        targetVertical: query.slice(0, 160),
        targetLocation: location.slice(0, 160),
      },
    });

    const payload = {
      brandId,
      campaignId,
      ownerUserId,
      query,
      location,
      maxResults,
      noWebsiteOnly,
    };

    // Prefer background when Trigger is configured or caller asks for async.
    const preferAsync = body.async === true || Boolean(process.env.TRIGGER_SECRET_KEY?.trim());

    if (preferAsync) {
      const queued = await dispatchPipelineTask(
        SCOUT_CAMPAIGN_TASK_ID,
        () => runScoutCampaignInline(payload),
        { payload, wait: false }
      );
      return NextResponse.json({
        ok: true,
        queued: true,
        mode: queued.mode,
        runId: queued.mode === 'trigger' ? queued.id : undefined,
        message: 'Scouting started — Match Progress will update as leads condition.',
      });
    }

    const { mode, result } = await dispatchPipelineTask(
      SCOUT_CAMPAIGN_TASK_ID,
      () => runScoutCampaignInline(payload),
      { payload, wait: true }
    );

    if (!result) {
      return NextResponse.json({ error: 'Scout returned no result' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode,
      jobId: result.jobId,
      saved: result.count,
      outreachReady: result.results.filter((r) => 'outreachReady' in r && r.outreachReady).length,
      results: result.results,
      creditBlocked: Boolean(result.creditBlocked),
      creditsRemaining: result.creditsRemaining ?? null,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[scrape/campaign]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
