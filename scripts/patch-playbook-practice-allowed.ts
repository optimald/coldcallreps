/**
 * Turso patch: Playbook.practiceAllowed for SDR Practice catalog opt-in.
 * Safe to re-run.
 *
 * Usage: npm run db:patch:playbook-practice
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
    'ALTER TABLE Playbook ADD COLUMN practiceAllowed INTEGER NOT NULL DEFAULT 0',
    'CREATE INDEX IF NOT EXISTS Playbook_practiceAllowed_idx ON Playbook(practiceAllowed)',
    // Platform demo brands are open practice content
    `UPDATE Playbook SET practiceAllowed = 1
     WHERE brandId IN (SELECT id FROM Brand WHERE slug LIKE 'demo-%')`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK', sql.slice(0, 88).replace(/\s+/g, ' ') + '…');
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('SKIP', msg.slice(0, 100));
      } else {
        throw e;
      }
    }
  }
  console.log('Done: Playbook.practiceAllowed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
