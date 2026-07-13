/**
 * Turso patch: 3-phase pipeline fields, campaign booking link, CallLog audit columns.
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/patch-pipeline-handoff.ts
 */
import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const loadEnvFile = (
    process as NodeJS.Process & { loadEnvFile?: (path: string) => void }
  ).loadEnvFile;
  if (typeof loadEnvFile !== 'function') return;
  for (const name of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    try {
      loadEnvFile(path);
    } catch {
      /* ignore */
    }
  }
}

loadEnvLocal();

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN');

  const client = createClient({ url, authToken });
  const stmts = [
    "ALTER TABLE Prospect ADD COLUMN scrapeStatus TEXT DEFAULT 'not_started'",
    "ALTER TABLE Prospect ADD COLUMN webScanStatus TEXT DEFAULT 'not_started'",
    'ALTER TABLE Prospect ADD COLUMN qualifyPhase1 INTEGER',
    'ALTER TABLE Prospect ADD COLUMN qualifyPhase2 INTEGER',
    'ALTER TABLE Prospect ADD COLUMN qualifyPhase3 INTEGER',
    'ALTER TABLE Prospect ADD COLUMN outreachReady INTEGER DEFAULT 0',
    'ALTER TABLE Prospect ADD COLUMN bookingUrlFound TEXT',
    'ALTER TABLE Campaign ADD COLUMN bookingLink TEXT',
    'ALTER TABLE Campaign ADD COLUMN targetVertical TEXT',
    'ALTER TABLE Campaign ADD COLUMN targetLocation TEXT',
    'ALTER TABLE CallLog ADD COLUMN recordingUrl TEXT',
    'ALTER TABLE CallLog ADD COLUMN transcript TEXT',
    'ALTER TABLE CallLog ADD COLUMN isAudited INTEGER DEFAULT 0',
    'ALTER TABLE CallLog ADD COLUMN aiAuditResult TEXT',
    'ALTER TABLE CallLog ADD COLUMN needsManualReview INTEGER DEFAULT 0',
    'CREATE INDEX IF NOT EXISTS Prospect_brandId_outreachReady_idx ON Prospect(brandId, outreachReady)',
    'CREATE INDEX IF NOT EXISTS CallLog_campaignId_status_idx ON CallLog(campaignId, status)',
    'CREATE INDEX IF NOT EXISTS CallLog_needsManualReview_createdAt_idx ON CallLog(needsManualReview, createdAt)',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 72));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('skip', s.slice(0, 72));
      } else {
        console.warn('warn', s.slice(0, 72), msg);
      }
    }
  }

  console.log('Pipeline handoff patch complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
