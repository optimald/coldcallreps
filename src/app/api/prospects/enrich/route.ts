import { NextResponse } from 'next/server';
import type { Prospect, UserProfile } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { scrapeWebsiteHooks, type WebsiteHooks } from '@/lib/maps/scraper';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads } from '@/lib/brand-leads';
import { pushProspectToConnectedCrms } from '@/lib/crm/sync';
import { computeTrojanScore, serializeHooksPayload } from '@/lib/prospect-intel';

type EnrichBody = {
  url?: string;
  companyName?: string;
  prospectId?: string;
  prospectIds?: string[];
  brandId?: string;
  syncCrm?: boolean;
};

async function assertCanTouchProspect(
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>,
  row: Pick<Prospect, 'userId' | 'brandId'>
) {
  const personal = row.userId === profile.id && !row.brandId;
  const brandOk = !!row.brandId && (await canManageBrandLeads(profile, row.brandId));
  return personal || brandOk;
}

async function runEnrich(opts: {
  profile: Pick<UserProfile, 'id' | 'platformRole' | 'email'>;
  existing: Prospect | null;
  url?: string;
  companyName?: string;
  brandId?: string | null;
  syncCrm?: boolean;
}): Promise<WebsiteHooks & { prospectId: string; companyName: string }> {
  const { profile, existing, companyName, brandId, syncCrm } = opts;
  let targetUrl = opts.url || existing?.website || undefined;

  if (existing) {
    await prisma.prospect.update({
      where: { id: existing.id },
      data: { enrichmentStatus: 'pending' },
    });
  }

  if (!targetUrl) {
    const hooks = [
      'No website on file — lead with a discovery question about how they get customers today.',
    ];
    if (!existing) {
      throw Object.assign(new Error('url or prospectId required'), { status: 400 });
    }
    const health = 0;
    const intel = {
      hasWebsite: false as const,
      health,
      score: computeTrojanScore(existing.reviewCount, health, existing.reviewRating),
      webEvoScore: null,
      signals: ['No website'],
      cms: null,
      copyrightYear: null,
      lastReviewAt: null,
    };
    const prospect = await prisma.prospect.update({
      where: { id: existing.id },
      data: {
        hooksJSON: serializeHooksPayload(hooks, intel),
        enrichmentStatus: 'done',
        qualifyPhase3: true,
        qualifyPhase1: true,
        qualifyPhase2: true,
        scrapeStatus: 'completed',
        webScanStatus: 'skipped',
        outreachReady: Boolean(existing.phone),
      },
    });
    if (syncCrm) {
      await pushProspectToConnectedCrms(profile.id, prospect).catch(() => null);
    }
    return {
      prospectId: prospect.id,
      companyName: prospect.companyName,
      hooks,
      hasWebsite: false,
      intel,
    };
  }

  try {
    const scraped = await scrapeWebsiteHooks(String(targetUrl), {
      reviewCount: existing?.reviewCount,
      reviewRating: existing?.reviewRating,
    });
    const intel = scraped.intel || null;
    const hooksJSON = serializeHooksPayload(scraped.hooks, intel);
    const patch: {
      website: string;
      hooksJSON: string;
      enrichmentStatus: string;
      phone?: string;
      qualifyPhase3?: boolean;
      outreachReady?: boolean;
      scrapeStatus?: string;
      webScanStatus?: string;
      qualifyPhase1?: boolean;
      qualifyPhase2?: boolean;
    } = {
      website: String(targetUrl),
      hooksJSON,
      enrichmentStatus: 'done',
      qualifyPhase3: true,
      scrapeStatus: 'completed',
      webScanStatus: 'completed',
      qualifyPhase1: true,
      qualifyPhase2: true,
      outreachReady: true,
    };
    if (existing && !existing.phone && scraped.phones?.[0]) {
      patch.phone = scraped.phones[0];
    }

    let prospect: Prospect;
    if (existing) {
      prospect = await prisma.prospect.update({
        where: { id: existing.id },
        data: patch,
      });
    } else {
      const createBrandId = brandId || null;
      if (createBrandId && !(await canManageBrandLeads(profile, createBrandId))) {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }
      let hostname = 'Company';
      try {
        hostname = new URL(
          /^https?:/i.test(targetUrl) ? targetUrl : `https://${targetUrl}`
        ).hostname;
      } catch {
        /* keep default */
      }
      prospect = await prisma.prospect.create({
        data: {
          userId: profile.id,
          brandId: createBrandId,
          companyName: companyName || scraped.title || hostname,
          website: String(targetUrl),
          phone: scraped.phones?.[0] || null,
          source: 'url',
          hooksJSON,
          enrichmentStatus: 'done',
        },
      });
    }

    if (syncCrm) {
      await pushProspectToConnectedCrms(profile.id, prospect).catch(() => null);
    }

    return {
      prospectId: prospect.id,
      companyName: prospect.companyName,
      ...scraped,
      intel: intel ?? undefined,
    };
  } catch (err) {
    if (existing) {
      await prisma.prospect
        .update({
          where: { id: existing.id },
          data: { enrichmentStatus: 'failed' },
        })
        .catch(() => null);
    }
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = (await req.json()) as EnrichBody;
    const { url, companyName, prospectId, prospectIds, brandId, syncCrm } = body;

    const ids = [
      ...(Array.isArray(prospectIds) ? prospectIds.map(String).filter(Boolean) : []),
      ...(prospectId ? [String(prospectId)] : []),
    ];

    if (!url && ids.length === 0) {
      return NextResponse.json({ error: 'url or prospectId required' }, { status: 400 });
    }

    if (ids.length > 0) {
      const rows = await prisma.prospect.findMany({ where: { id: { in: ids } } });
      if (rows.length !== ids.length) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      for (const row of rows) {
        if (!(await assertCanTouchProspect(profile, row))) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const byId = new Map(rows.map((r) => [r.id, r]));
      const results = [];
      for (const id of ids) {
        const result = await runEnrich({
          profile,
          existing: byId.get(id) || null,
          syncCrm: Boolean(syncCrm),
        });
        results.push({
          prospectId: result.prospectId,
          companyName: result.companyName,
          hooks: result.hooks,
          hasWebsite: result.hasWebsite,
          emails: result.emails,
          phones: result.phones,
          intel: result.intel,
        });
      }

      return NextResponse.json({
        enriched: results.length,
        results,
        ...(results.length === 1
          ? {
              prospectId: results[0].prospectId,
              companyName: results[0].companyName,
              hooks: results[0].hooks,
              hasWebsite: results[0].hasWebsite,
              emails: results[0].emails,
              phones: results[0].phones,
              intel: results[0].intel,
            }
          : {}),
      });
    }

    if (brandId && !(await canManageBrandLeads(profile, String(brandId)))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await runEnrich({
      profile,
      existing: null,
      url: String(url),
      companyName,
      brandId: brandId ? String(brandId) : null,
      syncCrm: Boolean(syncCrm),
    });

    return NextResponse.json({
      prospectId: result.prospectId,
      companyName: result.companyName,
      hooks: result.hooks,
      hasWebsite: result.hasWebsite,
      emails: result.emails,
      phones: result.phones,
      title: result.title,
      description: result.description,
      intel: result.intel,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (err.status === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (err.status === 404 || err.status === 400) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Enrich error:', error);
    return NextResponse.json(
      { error: err.message || 'Enrich failed' },
      { status: 500 }
    );
  }
}
