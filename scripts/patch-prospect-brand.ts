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
  if (!url || !authToken) throw new Error('Missing Turso env');

  const client = createClient({ url, authToken });
  const stmts = [
    'ALTER TABLE Prospect ADD COLUMN brandId TEXT',
    'ALTER TABLE Prospect ADD COLUMN campaignId TEXT',
    'ALTER TABLE Prospect ADD COLUMN enrichmentStatus TEXT NOT NULL DEFAULT \'none\'',
    'CREATE INDEX IF NOT EXISTS Prospect_brandId_status_idx ON Prospect(brandId, status)',
    'CREATE INDEX IF NOT EXISTS Prospect_campaignId_idx ON Prospect(campaignId)',
    'CREATE INDEX IF NOT EXISTS Prospect_brandId_campaignId_idx ON Prospect(brandId, campaignId)',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 72));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|already exists/i.test(msg)) {
        console.log('SKIP', s.slice(0, 50));
        continue;
      }
      console.error('FAIL', s, msg);
      throw e;
    }
  }
  console.log('Prospect brand/campaign columns ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
