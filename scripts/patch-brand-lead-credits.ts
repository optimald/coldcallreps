/**
 * Turso patch: brand lead-credit columns + BrandLeadCreditLedger.
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/patch-brand-lead-credits.ts
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
    `ALTER TABLE Brand ADD COLUMN leadPlan TEXT NOT NULL DEFAULT 'FREE'`,
    `ALTER TABLE Brand ADD COLUMN leadCreditsAllotment INTEGER NOT NULL DEFAULT 100`,
    `ALTER TABLE Brand ADD COLUMN leadCreditsPack INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE Brand ADD COLUMN leadPackExpiresAt DATETIME`,
    `ALTER TABLE Brand ADD COLUMN leadPlanPeriodEnd DATETIME`,
    `ALTER TABLE Brand ADD COLUMN leadAllotmentResetAt DATETIME`,
    `ALTER TABLE Brand ADD COLUMN leadCreditsUsedPeriod INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE Brand ADD COLUMN stripeLeadSubscriptionId TEXT`,
    `CREATE TABLE IF NOT EXISTS BrandLeadCreditLedger (
      id TEXT PRIMARY KEY NOT NULL,
      brandId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      allotmentAfter INTEGER NOT NULL,
      packAfter INTEGER NOT NULL,
      note TEXT,
      prospectId TEXT,
      stripeSessionId TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brandId) REFERENCES Brand(id) ON DELETE CASCADE
    )`,
    'CREATE INDEX IF NOT EXISTS BrandLeadCreditLedger_brandId_createdAt_idx ON BrandLeadCreditLedger(brandId, createdAt)',
    'CREATE INDEX IF NOT EXISTS Brand_leadPlan_idx ON Brand(leadPlan)',
  ];

  for (const s of stmts) {
    try {
      await client.execute(s);
      console.log('OK', s.slice(0, 80));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|already exists/i.test(msg)) console.log('skip', s.slice(0, 80));
      else console.warn('fail', msg, s.slice(0, 80));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
