/**
 * Turso/local patch: notification preference columns.
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/patch-notification-prefs.ts
 */
import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const loadEnvFile = (process as NodeJS.Process & {
    loadEnvFile?: (path: string) => void;
  }).loadEnvFile;
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
    `ALTER TABLE UserProfile ADD COLUMN notificationPrefsJSON TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE Brand ADD COLUMN notificationDefaultsJSON TEXT NOT NULL DEFAULT '{}'`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK:', sql);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('SKIP (exists):', sql);
        continue;
      }
      throw e;
    }
  }

  console.log('Notification columns patched.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
