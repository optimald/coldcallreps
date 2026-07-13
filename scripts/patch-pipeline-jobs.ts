/**
 * Turso patch: PipelineJob table for brand Pipeline tab.
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/patch-pipeline-jobs.ts
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
    `CREATE TABLE IF NOT EXISTS PipelineJob (
      id TEXT PRIMARY KEY NOT NULL,
      brandId TEXT NOT NULL,
      campaignId TEXT,
      query TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      savedCount INTEGER NOT NULL DEFAULT 0,
      readyCount INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME
    )`,
    'CREATE INDEX IF NOT EXISTS PipelineJob_brandId_createdAt_idx ON PipelineJob(brandId, createdAt)',
    'CREATE INDEX IF NOT EXISTS PipelineJob_campaignId_createdAt_idx ON PipelineJob(campaignId, createdAt)',
    'CREATE INDEX IF NOT EXISTS PipelineJob_brandId_status_idx ON PipelineJob(brandId, status)',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 72));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|already exists/i.test(msg)) console.log('skip', s.slice(0, 72));
      else console.warn('warn', s.slice(0, 72), msg);
    }
  }
  console.log('PipelineJob patch complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
