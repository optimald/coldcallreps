/**
 * Additive Turso patch: BrandPhoneNumber pool + callback locks + CallLog brand refs.
 * Migrates legacy Brand.twilioPhoneE164 into the pool when present.
 * Safe to re-run.
 *
 * Usage: npm run db:patch:brand-phones
 */
import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

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

function cuidLike() {
  return `c${randomBytes(12).toString('hex')}`;
}

function areaCodeFromE164(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return digits.slice(-10, -7) || '000';
}

loadEnvLocal();

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN');

  const client = createClient({ url, authToken });
  const stmts = [
    'ALTER TABLE Brand ADD COLUMN twilioPhoneE164 TEXT',
    'ALTER TABLE Brand ADD COLUMN twilioPhoneSid TEXT',
    'ALTER TABLE Brand ADD COLUMN fallbackPhoneE164 TEXT',
    'ALTER TABLE Brand ADD COLUMN inboundGreeting TEXT',
    'CREATE INDEX IF NOT EXISTS Brand_twilioPhoneE164_idx ON Brand(twilioPhoneE164)',
    `CREATE TABLE IF NOT EXISTS BrandPhoneNumber (
      id TEXT PRIMARY KEY NOT NULL,
      brandId TEXT NOT NULL,
      e164 TEXT NOT NULL,
      twilioSid TEXT,
      areaCode TEXT NOT NULL,
      label TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brandId, e164)
    )`,
    'CREATE INDEX IF NOT EXISTS BrandPhoneNumber_brandId_areaCode_idx ON BrandPhoneNumber(brandId, areaCode)',
    'CREATE INDEX IF NOT EXISTS BrandPhoneNumber_e164_idx ON BrandPhoneNumber(e164)',
    'CREATE INDEX IF NOT EXISTS BrandPhoneNumber_twilioSid_idx ON BrandPhoneNumber(twilioSid)',
    'ALTER TABLE Prospect ADD COLUMN callbackLockedUntil DATETIME',
    'ALTER TABLE Prospect ADD COLUMN callbackLockedByUserId TEXT',
    'CREATE INDEX IF NOT EXISTS Prospect_callbackLock_idx ON Prospect(callbackLockedByUserId, callbackLockedUntil)',
    'ALTER TABLE CallLog ADD COLUMN brandId TEXT',
    'ALTER TABLE CallLog ADD COLUMN brandPhoneNumberId TEXT',
    'CREATE INDEX IF NOT EXISTS CallLog_brandId_idx ON CallLog(brandId)',
    'CREATE INDEX IF NOT EXISTS CallLog_brandPhoneNumberId_idx ON CallLog(brandPhoneNumberId)',
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
      console.error('FAIL', s.slice(0, 120), msg);
      throw e;
    }
  }

  // Migrate legacy single DID → pool
  const brands = await client.execute(
    'SELECT id, twilioPhoneE164, twilioPhoneSid FROM Brand WHERE twilioPhoneE164 IS NOT NULL AND twilioPhoneE164 != \'\''
  );
  for (const row of brands.rows) {
    const brandId = String(row.id);
    const e164 = String(row.twilioPhoneE164);
    const sid = row.twilioPhoneSid != null ? String(row.twilioPhoneSid) : null;
    const existing = await client.execute({
      sql: 'SELECT id FROM BrandPhoneNumber WHERE brandId = ? AND e164 = ? LIMIT 1',
      args: [brandId, e164],
    });
    if (existing.rows.length > 0) continue;
    const id = cuidLike();
    const areaCode = areaCodeFromE164(e164);
    await client.execute({
      sql: `INSERT INTO BrandPhoneNumber (id, brandId, e164, twilioSid, areaCode, label, isActive, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      args: [id, brandId, e164, sid, areaCode, 'Migrated'],
    });
    console.log('MIGRATED', brandId, e164);
  }

  console.log('Brand phone pools + callback locks ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
