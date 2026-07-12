/**
 * Additive Turso patch for Stripe Connect payouts.
 * Safe to re-run — skips columns/tables that already exist.
 *
 * Usage: npx tsx scripts/patch-connect-payouts.ts
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
    'ALTER TABLE UserProfile ADD COLUMN stripeConnectAccountId TEXT',
    'ALTER TABLE UserProfile ADD COLUMN stripeConnectDetailsSubmitted INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE UserProfile ADD COLUMN stripeConnectPayoutsEnabled INTEGER NOT NULL DEFAULT 0',
    'CREATE INDEX IF NOT EXISTS UserProfile_stripeConnectAccountId_idx ON UserProfile(stripeConnectAccountId)',
    `CREATE TABLE IF NOT EXISTS CampaignPayout (
      id TEXT NOT NULL PRIMARY KEY,
      campaignId TEXT NOT NULL,
      applicationId TEXT NOT NULL,
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
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL,
      paidAt DATETIME,
      CONSTRAINT CampaignPayout_campaignId_fkey FOREIGN KEY (campaignId) REFERENCES Campaign (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT CampaignPayout_applicationId_fkey FOREIGN KEY (applicationId) REFERENCES CampaignApplication (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT CampaignPayout_brandUserId_fkey FOREIGN KEY (brandUserId) REFERENCES UserProfile (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT CampaignPayout_repUserId_fkey FOREIGN KEY (repUserId) REFERENCES UserProfile (id) ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS CampaignPayout_applicationId_key ON CampaignPayout(applicationId)',
    'CREATE INDEX IF NOT EXISTS CampaignPayout_campaignId_status_idx ON CampaignPayout(campaignId, status)',
    'CREATE INDEX IF NOT EXISTS CampaignPayout_repUserId_status_idx ON CampaignPayout(repUserId, status)',
    'CREATE INDEX IF NOT EXISTS CampaignPayout_brandUserId_createdAt_idx ON CampaignPayout(brandUserId, createdAt)',
    'CREATE INDEX IF NOT EXISTS CampaignPayout_stripeCheckoutSessionId_idx ON CampaignPayout(stripeCheckoutSessionId)',
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

  console.log('Connect payout columns ready on Turso.');
  console.log('Also run: npx prisma db push  (local SQLite)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
