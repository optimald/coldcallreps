/**
 * Turso patch: hot-potato queue fields on Prospect.
 * Safe to re-run.
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
    'ALTER TABLE Prospect ADD COLUMN checkedOutByUserId TEXT',
    'ALTER TABLE Prospect ADD COLUMN checkedOutUntil DATETIME',
    'ALTER TABLE Prospect ADD COLUMN attemptCount INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE Prospect ADD COLUMN nextCallAt DATETIME',
    'ALTER TABLE Prospect ADD COLUMN lastDisposition TEXT',
    'CREATE INDEX IF NOT EXISTS Prospect_checkedOutByUserId_checkedOutUntil_idx ON Prospect(checkedOutByUserId, checkedOutUntil)',
    'CREATE INDEX IF NOT EXISTS Prospect_campaignId_nextCallAt_outreachReady_idx ON Prospect(campaignId, nextCallAt, outreachReady)',
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
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
