/**
 * Turso patch: TalentInterest (brand swipe on SDR resumes).
 * Safe to re-run.
 *
 * Usage: npm run db:patch:talent-interest
 * Local: npx prisma db push
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
    `CREATE TABLE IF NOT EXISTS TalentInterest (
      id TEXT PRIMARY KEY NOT NULL,
      fromUserId TEXT NOT NULL REFERENCES UserProfile(id) ON DELETE CASCADE,
      toUserId TEXT NOT NULL REFERENCES UserProfile(id) ON DELETE CASCADE,
      brandId TEXT,
      status TEXT NOT NULL DEFAULT 'interested',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      UNIQUE(fromUserId, toUserId)
    )`,
    'CREATE INDEX IF NOT EXISTS TalentInterest_toUserId_status_createdAt_idx ON TalentInterest(toUserId, status, createdAt)',
    'CREATE INDEX IF NOT EXISTS TalentInterest_fromUserId_status_createdAt_idx ON TalentInterest(fromUserId, status, createdAt)',
    'CREATE INDEX IF NOT EXISTS TalentInterest_brandId_idx ON TalentInterest(brandId)',
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK', sql.slice(0, 72).replace(/\s+/g, ' ') + '…');
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/already exists|duplicate/i.test(msg)) console.log('SKIP', msg.slice(0, 80));
      else throw e;
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
