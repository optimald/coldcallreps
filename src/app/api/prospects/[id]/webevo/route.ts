import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { resolveProspectAccess } from '@/lib/prospect-access';
import { runWebevoScanForProspect } from '@/lib/pipeline/webevo-scan';
import { uilensaiConfigured } from '@/lib/pipeline/uilensai-scanner';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/prospects/[id]/webevo
 * Opt-in UILensAI / WebEvo pro-scan. Not part of P1→P2→P3 phone pipeline.
 *
 * Body: { force?: boolean }
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!access.canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const cfg = uilensaiConfigured();
    if (!cfg.ok) {
      return NextResponse.json(
        {
          error: `UILensAI not configured. Set: ${cfg.missing.join(', ')}`,
          missingKeys: cfg.missing,
        },
        { status: 503 }
      );
    }

    const outcome = await runWebevoScanForProspect(id, { force });
    if (!outcome.success) {
      return NextResponse.json(
        {
          error: outcome.error || 'Scan failed',
          missingKeys: outcome.missingKeys,
          durationMs: outcome.durationMs,
        },
        { status: outcome.error?.includes('not found') ? 404 : 502 }
      );
    }

    return NextResponse.json({
      prospectId: outcome.prospectId,
      overallScore: outcome.overallScore,
      rating: outcome.rating,
      durationMs: outcome.durationMs,
      costEstimated: outcome.costEstimated,
      source: 'uilensai',
      modules: outcome.scan
        ? {
            ui: outcome.scan.uiScore,
            performance: outcome.scan.performanceScore,
            seo: outcome.scan.seoScore,
            security: outcome.scan.securityScore,
            privacy: outcome.scan.privacyScore,
            compatibility: outcome.scan.compatibilityScore,
            marketing: outcome.scan.marketingScore,
            conversion: outcome.scan.conversionScore,
            accessibility: outcome.scan.accessibilityScore,
            siteHealth: outcome.scan.siteHealthScore,
          }
        : null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[webevo]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireUser();
    await ctx.params;
    const cfg = uilensaiConfigured();
    return NextResponse.json({
      configured: cfg.ok,
      missingKeys: cfg.missing,
      package: '@optimald/uilensai',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
