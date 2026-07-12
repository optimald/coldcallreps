/**
 * Turso patch: escrow wallet, appointment claims, campaign tier fields, Product Hunt imports.
 * Safe to re-run.
 *
 * Usage: npm run db:patch:prd-gaps
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
    'ALTER TABLE Campaign ADD COLUMN pricingTier TEXT DEFAULT \'TIER2\'',
    'ALTER TABLE Campaign ADD COLUMN minPracticeSessions INTEGER DEFAULT 1',
    'ALTER TABLE Campaign ADD COLUMN escrowLockedCents INTEGER DEFAULT 0',
    `CREATE TABLE IF NOT EXISTS BrandWallet (
      id TEXT PRIMARY KEY NOT NULL,
      brandId TEXT NOT NULL UNIQUE,
      balanceCents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS WalletLedger (
      id TEXT PRIMARY KEY NOT NULL,
      walletId TEXT NOT NULL,
      type TEXT NOT NULL,
      amountCents INTEGER NOT NULL,
      balanceAfter INTEGER NOT NULL,
      campaignId TEXT,
      claimId TEXT,
      stripeSessionId TEXT,
      note TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS WalletLedger_walletId_createdAt_idx ON WalletLedger(walletId, createdAt)',
    `CREATE TABLE IF NOT EXISTS AppointmentClaim (
      id TEXT PRIMARY KEY NOT NULL,
      campaignId TEXT NOT NULL,
      applicationId TEXT NOT NULL,
      repUserId TEXT NOT NULL,
      callLogId TEXT,
      calendarEventId TEXT,
      prospectName TEXT,
      meetingAt DATETIME,
      notes TEXT,
      transcriptSnippet TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_AUDIT',
      auditJSON TEXT,
      auditScore INTEGER,
      failureReason TEXT,
      verifiedAt DATETIME,
      paidAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS AppointmentClaim_campaignId_status_idx ON AppointmentClaim(campaignId, status)',
    'CREATE INDEX IF NOT EXISTS AppointmentClaim_applicationId_idx ON AppointmentClaim(applicationId)',
    `CREATE TABLE IF NOT EXISTS ProductHuntImport (
      id TEXT PRIMARY KEY NOT NULL,
      brandId TEXT,
      phId TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT,
      url TEXT,
      votesCount INTEGER NOT NULL DEFAULT 0,
      featuredAt DATETIME,
      rawJSON TEXT,
      prospectId TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS ProductHuntImport_brandId_createdAt_idx ON ProductHuntImport(brandId, createdAt)',
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

  // Soft-update defaults for existing campaigns
  try {
    await client.execute(
      `UPDATE Campaign SET requireCertification = 1 WHERE requireCertification = 0 OR requireCertification IS NULL`
    );
    await client.execute(
      `UPDATE Campaign SET minScore = 80 WHERE minScore IS NULL`
    );
  } catch {
    /* ignore */
  }

  console.log('PRD gap tables ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
