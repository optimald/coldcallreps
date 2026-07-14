/**
 * Turso patch: Campaign base pay + CampaignPayout kind/periodKey.
 * Safe to re-run.
 *
 * Usage: npm run db:patch:campaign-base
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
    'ALTER TABLE Campaign ADD COLUMN basePayCents INTEGER',
    'ALTER TABLE Campaign ADD COLUMN basePayCadence TEXT',
    "ALTER TABLE CampaignPayout ADD COLUMN kind TEXT NOT NULL DEFAULT 'OUTCOME'",
    'ALTER TABLE CampaignPayout ADD COLUMN periodKey TEXT',
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK', sql);
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('SKIP', sql);
      } else {
        throw e;
      }
    }
  }

  try {
    await client.execute(
      'CREATE INDEX IF NOT EXISTS CampaignPayout_applicationId_kind_periodKey_idx ON CampaignPayout(applicationId, kind, periodKey)'
    );
    console.log('OK index CampaignPayout(applicationId, kind, periodKey)');
  } catch (e: unknown) {
    console.warn('WARN index', e);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
