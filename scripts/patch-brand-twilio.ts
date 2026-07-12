/**
 * Additive Turso patch: Brand Twilio tracking DID (one number per brand).
 * Safe to re-run — skips columns/indexes that already exist.
 *
 * Usage: npm run db:patch:brand-twilio
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
    'ALTER TABLE Brand ADD COLUMN twilioPhoneE164 TEXT',
    'ALTER TABLE Brand ADD COLUMN twilioPhoneSid TEXT',
    'CREATE INDEX IF NOT EXISTS Brand_twilioPhoneE164_idx ON Brand(twilioPhoneE164)',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 80).replace(/\s+/g, ' '));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|already exists/i.test(msg)) {
        console.log('SKIP', s.slice(0, 60).replace(/\s+/g, ' '));
        continue;
      }
      console.error('FAIL', s.slice(0, 120), msg);
      throw e;
    }
  }
  console.log('Brand Twilio phone columns ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
