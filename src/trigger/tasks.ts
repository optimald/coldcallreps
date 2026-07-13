/**
 * Trigger.dev-compatible task wrappers for the phone pipeline.
 *
 * Runs in-process today (Netlify/Next API). When TRIGGER_SECRET_KEY is set
 * and @trigger.dev/sdk is installed, these IDs map 1:1 to Trigger tasks.
 *
 * Chain: scraper → webscan → enricher → STOP (no webevo / cannon / secret-shop).
 */

import {
  runScraperPhase,
  runWebscanPhase,
  runEnricherPhase,
  runScoutCampaignPipeline,
  type ScoutCampaignPayload,
} from '@/lib/pipeline/orchestrator';
import { runAuditCallTask, type AuditCallPayload } from '@/lib/pipeline/audit-call';

export const SCRAPER_TASK_ID = 'scraper-task';
export const WEBSCAN_TASK_ID = 'webscan-task';
export const ENRICHER_TASK_ID = 'enricher-task';
export const AUDIT_CALL_TASK_ID = 'audit-call-task';

/** Frozen / quarantine — do not schedule. */
export const QUARANTINED_TASK_IDS = [
  'webevo-task',
  'secretshop-legacy',
  'secretshop-3call-setup',
  'cannon-task',
] as const;

export async function scraperTask(payload: ScoutCampaignPayload) {
  return runScraperPhase(payload);
}

export async function webscanTask(payload: { prospectId: string }) {
  return runWebscanPhase(payload.prospectId);
}

export async function enricherTask(payload: { prospectId: string }) {
  // Terminates after P3 — does NOT trigger webevo/cannon
  return runEnricherPhase(payload.prospectId);
}

/** Full scout + condition chain for a campaign launch. */
export async function scoutCampaignTask(payload: ScoutCampaignPayload) {
  return runScoutCampaignPipeline(payload);
}

export async function auditCallTask(payload: AuditCallPayload) {
  return runAuditCallTask(payload);
}

/**
 * Dispatch helper — prefers Trigger.dev when configured, else runs inline.
 * Keeps Netlify deploys working without a Trigger project.
 */
export async function dispatchPipelineTask<T>(
  taskId: string,
  run: () => Promise<T>
): Promise<{ mode: 'inline' | 'trigger'; result: T }> {
  // Optional future: if (process.env.TRIGGER_SECRET_KEY) { await tasks.trigger(taskId, ...) }
  void taskId;
  const result = await run();
  return { mode: 'inline', result };
}
