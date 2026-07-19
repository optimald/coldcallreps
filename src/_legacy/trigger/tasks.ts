/**
 * Trigger.dev pipeline tasks.
 *
 * Chain: scraper → webscan → enricher → STOP (no webevo / cannon / secret-shop).
 * When TRIGGER_SECRET_KEY is unset, dispatchPipelineTask runs the same work inline.
 */

import { logger, task, tasks } from '@trigger.dev/sdk';
import {
  runScraperPhase,
  runWebscanPhase,
  runEnricherPhase,
  runScoutCampaignPipeline,
  type ScoutCampaignPayload,
} from '@/lib/pipeline/orchestrator';
import { runAuditCallTask, type AuditCallPayload } from '@/lib/pipeline/audit-call';
import { prisma } from '@/lib/prisma';
import { BASE_PAY_TASK_ID, basePayDailyTask } from '@/trigger/base-pay-task';

export const SCRAPER_TASK_ID = 'scraper-task';
export const WEBSCAN_TASK_ID = 'webscan-task';
export const ENRICHER_TASK_ID = 'enricher-task';
export const AUDIT_CALL_TASK_ID = 'audit-call-task';
export const SCOUT_CAMPAIGN_TASK_ID = 'scout-campaign-task';
export { BASE_PAY_TASK_ID, basePayDailyTask };

/** Frozen / quarantine — do not schedule. */
export const QUARANTINED_TASK_IDS = [
  'webevo-task',
  'secretshop-legacy',
  'secretshop-3call-setup',
  'cannon-task',
] as const;

export const scraperTask = task({
  id: SCRAPER_TASK_ID,
  retry: { maxAttempts: 2 },
  run: async (payload: ScoutCampaignPayload) => {
    logger.info('P1 scrape', { brandId: payload.brandId, query: payload.query });
    return runScraperPhase(payload);
  },
});

export const webscanTask = task({
  id: WEBSCAN_TASK_ID,
  retry: { maxAttempts: 2 },
  run: async (payload: { prospectId: string }) => {
    logger.info('P2 webscan', { prospectId: payload.prospectId });
    return runWebscanPhase(payload.prospectId);
  },
});

export const enricherTask = task({
  id: ENRICHER_TASK_ID,
  retry: { maxAttempts: 2 },
  run: async (payload: { prospectId: string }) => {
    logger.info('P3 enrich', { prospectId: payload.prospectId });
    // Terminates after P3 — does NOT trigger webevo/cannon
    return runEnricherPhase(payload.prospectId);
  },
});

export const auditCallTask = task({
  id: AUDIT_CALL_TASK_ID,
  retry: { maxAttempts: 2 },
  run: async (payload: AuditCallPayload) => {
    logger.info('Audit call', { callLogId: payload.callLogId });
    return runAuditCallTask(payload);
  },
});

/**
 * Generate-job entry: P1 scrape, then per-lead P2→P3 as child runs
 * so the Trigger dashboard shows phase-by-phase progress.
 */
export const scoutCampaignTask = task({
  id: SCOUT_CAMPAIGN_TASK_ID,
  maxDuration: 3600,
  retry: { maxAttempts: 1 },
  run: async (payload: ScoutCampaignPayload) => {
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
      const scrape = await runScraperPhase(payload);
      const { prospectIds, count, creditBlocked, creditsRemaining } = scrape;
      const results: Array<{ id: string } & Record<string, unknown>> = [];

      for (const id of prospectIds) {
        const scan = await webscanTask.triggerAndWait({ prospectId: id });
        if (!scan.ok) {
          results.push({ id, ok: false, phase: 'webscan', error: String(scan.error) });
          continue;
        }
        const enrich = await enricherTask.triggerAndWait({ prospectId: id });
        if (!enrich.ok) {
          results.push({ id, ok: false, phase: 'enrich', error: String(enrich.error) });
          continue;
        }
        const output =
          enrich.output && typeof enrich.output === 'object'
            ? (enrich.output as Record<string, unknown>)
            : { ok: true };
        results.push({ id, ...output });
      }

      const readyCount = results.filter((r) => Boolean(r.outreachReady)).length;
      await prisma.pipelineJob.update({
        where: { id: job.id },
        data: {
          status: creditBlocked && count === 0 ? 'failed' : 'completed',
          savedCount: count,
          readyCount,
          errorMessage: creditBlocked && count === 0 ? 'No lead credits remaining' : null,
          completedAt: new Date(),
        },
      });

      return { count, results, jobId: job.id, creditBlocked, creditsRemaining };
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
  },
});

function triggerConfigured() {
  return Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
}

type DispatchOk<T> =
  | { mode: 'inline'; result?: T }
  | { mode: 'trigger'; id: string; result?: T };

/**
 * Prefers Trigger.dev when TRIGGER_SECRET_KEY is set; else runs inline
 * so Netlify / local still work without a worker.
 */
export async function dispatchPipelineTask<T>(
  taskId: string,
  runInline: () => Promise<T>,
  opts?: { payload?: unknown; wait?: boolean }
): Promise<DispatchOk<T>> {
  const wait = opts?.wait !== false;
  const payload = opts?.payload;

  if (triggerConfigured() && payload !== undefined) {
    if (wait) {
      const result = await tasks.triggerAndWait(taskId, payload);
      if (!result.ok) {
        throw result.error ?? new Error(`Trigger task ${taskId} failed`);
      }
      return { mode: 'trigger', id: result.id, result: result.output as T };
    }
    const handle = await tasks.trigger(taskId, payload);
    return { mode: 'trigger', id: handle.id };
  }

  if (!wait) {
    void runInline().catch((e) =>
      console.error(`[pipeline] inline ${taskId} failed`, e)
    );
    return { mode: 'inline' };
  }

  const result = await runInline();
  return { mode: 'inline', result };
}

/** Inline-compatible runners (no Trigger task object call). */
export async function runScoutCampaignInline(payload: ScoutCampaignPayload) {
  return runScoutCampaignPipeline(payload);
}

export async function runAuditCallInline(payload: AuditCallPayload) {
  return runAuditCallTask(payload);
}
