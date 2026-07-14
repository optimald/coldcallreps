/**
 * Turso patch: Super Admin ops foundation (account status, ops roles,
 * ban appeals, impersonation sessions, payout hold/dispute).
 * Safe to re-run.
 *
 * Usage: npm run db:patch:admin-ops
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

async function execSafe(
  client: ReturnType<typeof createClient>,
  sql: string
) {
  try {
    await client.execute(sql);
    console.log('OK', sql.slice(0, 100).replace(/\s+/g, ' '));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|already exists/i.test(msg)) {
      console.log('SKIP', sql.slice(0, 70).replace(/\s+/g, ' '));
      return;
    }
    console.error('FAIL', msg);
    throw e;
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN');

  const client = createClient({ url, authToken });

  const alters = [
    'ALTER TABLE UserProfile ADD COLUMN opsRole TEXT',
    `ALTER TABLE UserProfile ADD COLUMN accountStatus TEXT NOT NULL DEFAULT 'ACTIVE'`,
    'ALTER TABLE UserProfile ADD COLUMN statusReason TEXT',
    'ALTER TABLE UserProfile ADD COLUMN statusChangedAt DATETIME',
    'ALTER TABLE UserProfile ADD COLUMN statusChangedById TEXT',
    'ALTER TABLE CampaignPayout ADD COLUMN holdReason TEXT',
    'ALTER TABLE CampaignPayout ADD COLUMN heldAt DATETIME',
    'ALTER TABLE CampaignPayout ADD COLUMN heldById TEXT',
    'ALTER TABLE CampaignPayout ADD COLUMN disputeReason TEXT',
    'ALTER TABLE CampaignPayout ADD COLUMN disputedAt DATETIME',
  ];

  for (const s of alters) {
    await execSafe(client, s);
  }

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS BanAppeal (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reason TEXT NOT NULL,
      response TEXT,
      reviewedById TEXT,
      reviewedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES UserProfile(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewedById) REFERENCES UserProfile(id) ON DELETE SET NULL
    )`
  );
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS BanAppeal_status_createdAt_idx ON BanAppeal(status, createdAt)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS BanAppeal_userId_createdAt_idx ON BanAppeal(userId, createdAt)');

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS ImpersonationSession (
      id TEXT PRIMARY KEY NOT NULL,
      adminId TEXT NOT NULL,
      targetUserId TEXT NOT NULL,
      reason TEXT NOT NULL,
      clerkActorTokenId TEXT,
      expiresAt DATETIME NOT NULL,
      endedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (adminId) REFERENCES UserProfile(id) ON DELETE CASCADE,
      FOREIGN KEY (targetUserId) REFERENCES UserProfile(id) ON DELETE CASCADE
    )`
  );
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS ImpersonationSession_adminId_createdAt_idx ON ImpersonationSession(adminId, createdAt)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS ImpersonationSession_targetUserId_createdAt_idx ON ImpersonationSession(targetUserId, createdAt)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS ImpersonationSession_endedAt_idx ON ImpersonationSession(endedAt)');

  await execSafe(client, 'CREATE INDEX IF NOT EXISTS UserProfile_opsRole_idx ON UserProfile(opsRole)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS UserProfile_accountStatus_idx ON UserProfile(accountStatus)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS UserProfile_email_idx ON UserProfile(email)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS CampaignPayout_status_createdAt_idx ON CampaignPayout(status, createdAt)');

  // Bootstrap: existing SUPERADMIN users get opsRole SUPER
  try {
    await client.execute(
      `UPDATE UserProfile SET opsRole = 'SUPER' WHERE platformRole = 'SUPERADMIN' AND (opsRole IS NULL OR opsRole = '')`
    );
    console.log('OK backfill opsRole for SUPERADMIN');
  } catch (e: unknown) {
    console.warn('backfill', e instanceof Error ? e.message : e);
  }

  console.log('admin-ops patch complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
