/**
 * Turso patch: dual-mode roles (SDR ↔ Brand) + onboarding timestamps + avatar.
 * Safe to re-run.
 *
 * Usage: npm run db:patch:role-modes
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
    `ALTER TABLE UserProfile ADD COLUMN unlockedRolesJSON TEXT NOT NULL DEFAULT '["REP"]'`,
    'ALTER TABLE UserProfile ADD COLUMN repOnboardedAt DATETIME',
    'ALTER TABLE UserProfile ADD COLUMN brandOnboardedAt DATETIME',
    'ALTER TABLE UserProfile ADD COLUMN avatarUrl TEXT',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 90).replace(/\s+/g, ' '));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|already exists/i.test(msg)) {
        console.log('SKIP', s.slice(0, 60).replace(/\s+/g, ' '));
        continue;
      }
      console.error('FAIL', msg);
      throw e;
    }
  }

  // Backfill unlocked roles from current platformRole (and owned brands).
  try {
    await client.execute(`
      UPDATE UserProfile
      SET unlockedRolesJSON = CASE
        WHEN platformRole IN ('BRAND', 'RECRUITER') THEN '["REP","BRAND"]'
        WHEN platformRole IN ('MANAGER', 'SUPERADMIN') THEN '["REP","BRAND"]'
        ELSE '["REP"]'
      END
      WHERE unlockedRolesJSON IS NULL OR unlockedRolesJSON = '' OR unlockedRolesJSON = '["REP"]'
    `);
    // Brand owners always unlock Brand
    await client.execute(`
      UPDATE UserProfile
      SET unlockedRolesJSON = '["REP","BRAND"]'
      WHERE id IN (SELECT DISTINCT ownerId FROM Brand WHERE ownerId IS NOT NULL)
    `);
    // Legacy brand desk users: treat as onboarded
    await client.execute(`
      UPDATE UserProfile
      SET brandOnboardedAt = COALESCE(brandOnboardedAt, CURRENT_TIMESTAMP)
      WHERE platformRole IN ('BRAND', 'RECRUITER')
         OR id IN (SELECT DISTINCT ownerId FROM Brand WHERE ownerId IS NOT NULL)
    `);
    // Legacy SDR / managers with a display name: treat as onboarded
    await client.execute(`
      UPDATE UserProfile
      SET repOnboardedAt = COALESCE(repOnboardedAt, CURRENT_TIMESTAMP)
      WHERE platformRole IN ('REP', 'MANAGER', 'SUPERADMIN')
        AND displayName IS NOT NULL
        AND TRIM(displayName) != ''
    `);
    console.log('OK backfill unlockedRoles + onboardedAt');
  } catch (e: unknown) {
    console.warn('Backfill warning:', e instanceof Error ? e.message : e);
  }

  console.log('Role mode columns ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
