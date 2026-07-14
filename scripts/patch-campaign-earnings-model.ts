/**
 * Turso patch: Campaign earnings model + accelerator fields; CampaignPayout.claimId.
 * Safe to re-run. Drops unique on CampaignPayout.applicationId when possible.
 *
 * Usage: npm run db:patch:campaign-earnings
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
    "ALTER TABLE Campaign ADD COLUMN earningsModel TEXT NOT NULL DEFAULT 'PER_BOOKED_MEETING'",
    'ALTER TABLE Campaign ADD COLUMN acceleratorStepSize INTEGER',
    'ALTER TABLE Campaign ADD COLUMN acceleratorTier1Cents INTEGER',
    'ALTER TABLE Campaign ADD COLUMN acceleratorTier2Cents INTEGER',
    'ALTER TABLE Campaign ADD COLUMN acceleratorTier3Cents INTEGER',
    'ALTER TABLE CampaignPayout ADD COLUMN claimId TEXT',
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log('OK', sql);
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('SKIP', sql);
      } else {
        throw e;
      }
    }
  }

  // Unique index on claimId (nullable unique — SQLite allows multiple NULLs).
  try {
    await client.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS CampaignPayout_claimId_key ON CampaignPayout(claimId)'
    );
    console.log('OK unique index CampaignPayout.claimId');
  } catch (e: unknown) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/already exists/i.test(msg)) {
      console.log('SKIP unique index CampaignPayout.claimId');
    } else {
      console.warn('WARN claimId unique index', msg);
    }
  }

  try {
    await client.execute(
      'CREATE INDEX IF NOT EXISTS CampaignPayout_applicationId_status_idx ON CampaignPayout(applicationId, status)'
    );
    console.log('OK index CampaignPayout(applicationId, status)');
  } catch (e: unknown) {
    console.warn('WARN applicationId status index', e);
  }

  // Rebuild CampaignPayout without UNIQUE(applicationId) if that constraint still exists.
  try {
    const tableSql = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='CampaignPayout'"
    );
    const createSql = String(tableSql.rows[0]?.sql || '');
    if (/applicationId\s+TEXT\s+NOT NULL\s+UNIQUE/i.test(createSql) || /UNIQUE\s*\(\s*applicationId\s*\)/i.test(createSql)) {
      console.log('Rebuilding CampaignPayout to drop UNIQUE(applicationId)…');
      await client.executeMultiple(`
        BEGIN;
        CREATE TABLE CampaignPayout_new (
          id TEXT NOT NULL PRIMARY KEY,
          campaignId TEXT NOT NULL,
          applicationId TEXT NOT NULL,
          claimId TEXT,
          brandUserId TEXT NOT NULL,
          repUserId TEXT NOT NULL,
          grossCents INTEGER NOT NULL,
          platformFeeCents INTEGER NOT NULL,
          netCents INTEGER NOT NULL,
          platformFeeBps INTEGER NOT NULL DEFAULT 2000,
          status TEXT NOT NULL DEFAULT 'PENDING',
          stripeCheckoutSessionId TEXT,
          stripePaymentIntentId TEXT,
          stripeTransferId TEXT,
          failureReason TEXT,
          holdReason TEXT,
          heldAt DATETIME,
          heldById TEXT,
          disputeReason TEXT,
          disputedAt DATETIME,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL,
          paidAt DATETIME
        );
        INSERT INTO CampaignPayout_new (
          id, campaignId, applicationId, claimId, brandUserId, repUserId,
          grossCents, platformFeeCents, netCents, platformFeeBps, status,
          stripeCheckoutSessionId, stripePaymentIntentId, stripeTransferId,
          failureReason, holdReason, heldAt, heldById, disputeReason, disputedAt,
          createdAt, updatedAt, paidAt
        )
        SELECT
          id, campaignId, applicationId, claimId, brandUserId, repUserId,
          grossCents, platformFeeCents, netCents, platformFeeBps, status,
          stripeCheckoutSessionId, stripePaymentIntentId, stripeTransferId,
          failureReason, holdReason, heldAt, heldById, disputeReason, disputedAt,
          createdAt, updatedAt, paidAt
        FROM CampaignPayout;
        DROP TABLE CampaignPayout;
        ALTER TABLE CampaignPayout_new RENAME TO CampaignPayout;
        CREATE UNIQUE INDEX IF NOT EXISTS CampaignPayout_claimId_key ON CampaignPayout(claimId);
        CREATE INDEX IF NOT EXISTS CampaignPayout_applicationId_status_idx ON CampaignPayout(applicationId, status);
        CREATE INDEX IF NOT EXISTS CampaignPayout_campaignId_status_idx ON CampaignPayout(campaignId, status);
        CREATE INDEX IF NOT EXISTS CampaignPayout_repUserId_status_idx ON CampaignPayout(repUserId, status);
        CREATE INDEX IF NOT EXISTS CampaignPayout_brandUserId_createdAt_idx ON CampaignPayout(brandUserId, createdAt);
        CREATE INDEX IF NOT EXISTS CampaignPayout_status_createdAt_idx ON CampaignPayout(status, createdAt);
        CREATE INDEX IF NOT EXISTS CampaignPayout_stripeCheckoutSessionId_idx ON CampaignPayout(stripeCheckoutSessionId);
        COMMIT;
      `);
      console.log('OK rebuilt CampaignPayout without UNIQUE(applicationId)');
    } else {
      console.log('SKIP rebuild — CampaignPayout applicationId already non-unique');
    }
  } catch (e: unknown) {
    console.warn('WARN CampaignPayout rebuild', e);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
