/**
 * 3-phase phone pipeline orchestrator.
 * P1 scrape → P2 webscan → P3 enrich → STOP (no WebEvo / cannon).
 *
 * Runs in-process from API routes. Trigger.dev wrappers in src/trigger/ call these.
 */

import { prisma } from '@/lib/prisma';
import { searchMapsProspects } from '@/lib/maps/rapidapi';
import { isLeadOutreachReady, prospectToQcRecord } from '@/lib/enrichment-qc';
import { fetchAndScanWebsite } from '@/lib/pipeline/webscan-phones';
import { runEnrichmentWaterfall } from '@/lib/pipeline/enrichment-waterfall';
import { serializeHooksPayload } from '@/lib/prospect-intel';

export type ScoutCampaignPayload = {
  brandId: string;
  campaignId?: string | null;
  ownerUserId: string;
  query: string;
  location: string;
  maxResults?: number;
  noWebsiteOnly?: boolean;
};

/** Phase 1 — Maps scrape into Prospect rows. */
export async function runScraperPhase(payload: ScoutCampaignPayload) {
  const maxResults = Math.min(25, Math.max(1, payload.maxResults ?? 10));
  const results = await searchMapsProspects(payload.query, payload.location, maxResults, {
    noWebsiteOnly: payload.noWebsiteOnly,
  });

  const saved: string[] = [];
  for (const r of results) {
    const placeId = r.placeId || null;
    if (placeId) {
      const existing = await prisma.prospect.findFirst({
        where: {
          brandId: payload.brandId,
          mapsPlaceId: placeId,
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.prospect.update({
          where: { id: existing.id },
          data: {
            scrapeStatus: 'completed',
            qualifyPhase1: true,
            campaignId: payload.campaignId || undefined,
            webScanStatus: r.website ? 'queued' : 'skipped',
          },
        });
        saved.push(existing.id);
        continue;
      }
    }

    const row = await prisma.prospect.create({
      data: {
        userId: payload.ownerUserId,
        brandId: payload.brandId,
        campaignId: payload.campaignId || null,
        companyName: r.companyName || 'Unknown',
        phone: r.phone || null,
        website: r.website || null,
        city: r.city || null,
        state: r.state || null,
        industry: r.industry || null,
        reviewRating: r.reviewRating ?? null,
        reviewCount: r.reviewCount ?? null,
        mapsPlaceId: placeId,
        source: 'maps',
        status: 'new',
        scrapeStatus: 'completed',
        qualifyPhase1: Boolean(r.companyName && r.phone),
        webScanStatus: r.website ? 'queued' : 'skipped',
        enrichmentStatus: 'none',
        outreachReady: false,
      },
    });
    saved.push(row.id);
  }

  return { prospectIds: saved, count: saved.length };
}

/** Phase 2 — phone/booking webscan. */
export async function runWebscanPhase(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return { ok: false as const, error: 'not_found' };

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { webScanStatus: 'in_progress' },
  });

  if (!prospect.website) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        webScanStatus: 'skipped',
        qualifyPhase2: true,
        enrichmentStatus: 'pending',
      },
    });
    return { ok: true as const, skipped: true };
  }

  try {
    const scan = await fetchAndScanWebsite(prospect.website);
    const phone = prospect.phone || scan.phones[0] || null;
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        webScanStatus: 'completed',
        qualifyPhase2: true,
        phone,
        bookingUrlFound: scan.bookingUrls[0] || null,
        ownerTitle: prospect.ownerTitle || scan.ownerTitleHint || undefined,
        enrichmentStatus: 'pending',
      },
    });
    return { ok: true as const, phones: scan.phones.length, booking: scan.bookingUrls[0] || null };
  } catch (e) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        webScanStatus: 'failed',
        qualifyPhase2: false,
        enrichmentStatus: 'pending', // still try enrich
      },
    });
    return { ok: false as const, error: e instanceof Error ? e.message : 'webscan_failed' };
  }
}

/** Phase 3 — enrichment waterfall → outreachReady. Terminates chain (no WebEvo). */
export async function runEnricherPhase(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return { ok: false as const, error: 'not_found' };

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { enrichmentStatus: 'pending' },
  });

  try {
    const result = await runEnrichmentWaterfall({
      companyName: prospect.companyName,
      website: prospect.website,
      city: prospect.city,
      state: prospect.state,
      existingPhone: prospect.phone,
      reviewCount: prospect.reviewCount,
      reviewRating: prospect.reviewRating,
    });

    const patch = {
      enrichmentStatus: 'done' as const,
      qualifyPhase3: true,
      phone: result.phone || prospect.phone,
      ownerName: result.ownerName || prospect.ownerName,
      ownerTitle: result.ownerTitle || prospect.ownerTitle || 'Owner',
      hooksJSON: result.hooksJSON,
      bookingUrlFound: result.bookingUrlFound || prospect.bookingUrlFound,
      outreachReady: false,
    };

    const updated = await prisma.prospect.update({
      where: { id: prospectId },
      data: patch,
    });

    const ready = isLeadOutreachReady(
      prospectToQcRecord({
        ...updated,
        scrapeStatus: updated.scrapeStatus || 'completed',
        webScanStatus:
          updated.webScanStatus === 'failed' ? 'completed' : updated.webScanStatus || 'completed',
        qualifyPhase1: updated.qualifyPhase1 ?? true,
        qualifyPhase2: updated.qualifyPhase2 ?? true,
        qualifyPhase3: true,
        enrichmentStatus: 'done',
      })
    );

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        outreachReady: ready,
        // Soft-qualify P1/P2 if maps row already had phone+city
        qualifyPhase1: updated.qualifyPhase1 ?? Boolean(updated.companyName && updated.phone),
        qualifyPhase2: updated.qualifyPhase2 ?? true,
      },
    });

    return { ok: true as const, outreachReady: ready, confidence: result.confidence, stage: result.stage };
  } catch (e) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        enrichmentStatus: 'failed',
        qualifyPhase3: false,
        outreachReady: false,
        hooksJSON: serializeHooksPayload(
          ['Enrichment failed — retry from Advanced or re-scout.'],
          { health: 0, signals: ['Failed'] }
        ),
      },
    });
    return { ok: false as const, error: e instanceof Error ? e.message : 'enrich_failed' };
  }
}

/**
 * Full chain for one prospect: P2 → P3 → STOP.
 * Call after P1 creates the row (or on existing id).
 */
export async function runPipelineForProspect(prospectId: string) {
  await runWebscanPhase(prospectId);
  return runEnricherPhase(prospectId);
}

/**
 * Scout campaign: P1 for all results, then P2→P3 per lead (stops after enrich).
 * Creates/updates a PipelineJob for the Pipeline tab history.
 */
export async function runScoutCampaignPipeline(payload: ScoutCampaignPayload) {
  const job = await prisma.pipelineJob.create({
    data: {
      brandId: payload.brandId,
      campaignId: payload.campaignId || null,
      query: payload.query.slice(0, 160),
      location: payload.location.slice(0, 160),
      status: 'running',
    },
  });

  try {
    const { prospectIds, count } = await runScraperPhase(payload);
    const results = [];
    for (const id of prospectIds) {
      results.push({ id, ...(await runPipelineForProspect(id)) });
    }
    const readyCount = results.filter((r) => 'outreachReady' in r && r.outreachReady).length;
    await prisma.pipelineJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        savedCount: count,
        readyCount,
        completedAt: new Date(),
      },
    });
    return { count, results, jobId: job.id };
  } catch (e) {
    await prisma.pipelineJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: e instanceof Error ? e.message.slice(0, 500) : 'Scout failed',
        completedAt: new Date(),
      },
    });
    throw e;
  }
}
