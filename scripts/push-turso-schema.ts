/**
 * Apply Prisma schema to remote Turso (libSQL).
 *
 * Prisma CLI cannot speak libsql:// — it uses DATABASE_URL=file:./prisma/dev.db.
 * This script diffs the schema to SQL and executes it against Turso.
 *
 * Usage: npm run db:push:turso
 */
import { createClient } from '@libsql/client';
import { execFileSync } from 'node:child_process';
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
  if (!url) {
    console.error('Missing TURSO_DATABASE_URL in .env.local');
    process.exit(1);
  }
  if (!authToken) {
    console.error('Missing TURSO_AUTH_TOKEN in .env.local — paste your Turso token there (gitignored).');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
  }

  console.log('Generating SQL from Prisma schema…');
  const sql = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8' },
  );

  const host = url.replace(/^libsql:\/\//, '').split('/')[0];
  console.log(`Applying schema to Turso (${host})…`);

  const client = createClient({ url, authToken });
  // Prisma emits "-- CreateTable" comment lines before each CREATE; strip those
  // before filtering or every statement looks like a comment and is skipped.
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);

  let applied = 0;
  let skipped = 0;
  for (const statement of statements) {
    const stmt = statement.endsWith(';') ? statement : `${statement};`;
    try {
      await client.execute(stmt);
      applied += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate/i.test(msg)) {
        skipped += 1;
        continue;
      }
      console.error('Failed statement:\n', statement.slice(0, 240));
      throw err;
    }
  }

  console.log(`Turso schema push complete (applied=${applied}, skipped_existing=${skipped}).`);

  console.log('Syncing local file DB (Prisma CLI)…');
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
