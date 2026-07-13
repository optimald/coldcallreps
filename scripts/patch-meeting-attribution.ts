/**
 * Turso patch: meeting attribution fields on Campaign + AppointmentClaim.
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/patch-meeting-attribution.ts
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
    'ALTER TABLE Campaign ADD COLUMN qualifiedPayoutCents INTEGER',
    'ALTER TABLE Campaign ADD COLUMN meetingDurationMinutes INTEGER',
    'ALTER TABLE AppointmentClaim ADD COLUMN prospectId TEXT',
    'ALTER TABLE AppointmentClaim ADD COLUMN attributionToken TEXT',
    'ALTER TABLE AppointmentClaim ADD COLUMN meetingDurationMinutes INTEGER',
    'ALTER TABLE AppointmentClaim ADD COLUMN bookedVia TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS AppointmentClaim_attributionToken_key ON AppointmentClaim(attributionToken)',
    'CREATE INDEX IF NOT EXISTS AppointmentClaim_prospectId_idx ON AppointmentClaim(prospectId)',
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK', sql);
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/duplicate column|already exists|UNIQUE constraint/i.test(msg)) {
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
