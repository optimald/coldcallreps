/**
 * Turso patch: Super Admin phases 4–6 (DNC, consent, disputes, CMS, flags).
 * Safe to re-run. Usage: npm run db:patch:admin-ops-p46
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

async function execSafe(client: ReturnType<typeof createClient>, sql: string) {
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
    `ALTER TABLE Prospect ADD COLUMN doNotCall INTEGER NOT NULL DEFAULT 0`,
    'ALTER TABLE Prospect ADD COLUMN doNotCallReason TEXT',
    'ALTER TABLE Prospect ADD COLUMN doNotCallAt DATETIME',
    `ALTER TABLE Prospect ADD COLUMN consentStatus TEXT NOT NULL DEFAULT 'unknown'`,
    'ALTER TABLE Prospect ADD COLUMN consentAt DATETIME',
    'ALTER TABLE Prospect ADD COLUMN consentSource TEXT',
    'ALTER TABLE CallLog ADD COLUMN recordingConsent INTEGER',
    'ALTER TABLE CallLog ADD COLUMN consentNote TEXT',
  ];
  for (const s of alters) await execSafe(client, s);

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS DoNotCallEntry (
      id TEXT PRIMARY KEY NOT NULL,
      phoneE164 TEXT NOT NULL,
      brandId TEXT,
      scope TEXT NOT NULL DEFAULT 'global',
      source TEXT NOT NULL DEFAULT 'admin',
      reason TEXT,
      createdById TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS DoNotCallEntry_phoneE164_idx ON DoNotCallEntry(phoneE164)');
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS DoNotCallEntry_brandId_idx ON DoNotCallEntry(brandId)');

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS StripeDisputeRecord (
      id TEXT PRIMARY KEY NOT NULL,
      stripeDisputeId TEXT NOT NULL UNIQUE,
      chargeId TEXT,
      paymentIntentId TEXT,
      amountCents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      reason TEXT,
      status TEXT NOT NULL,
      evidenceDueBy DATETIME,
      rawJSON TEXT NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS StripeDisputeRecord_status_createdAt_idx ON StripeDisputeRecord(status, createdAt)');

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS AdminConfig (
      key TEXT PRIMARY KEY NOT NULL,
      valueJSON TEXT NOT NULL DEFAULT '{}',
      updatedById TEXT,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await execSafe(
    client,
    `CREATE TABLE IF NOT EXISTS PracticeScenario (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      focusArea TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      description TEXT,
      promptJSON TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await execSafe(client, 'CREATE INDEX IF NOT EXISTS PracticeScenario_active_sortOrder_idx ON PracticeScenario(active, sortOrder)');

  console.log('admin-ops-p46 patch complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
