import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dev singleton must invalidate after `prisma generate`.
 * Otherwise Next keeps an old PrismaClient on globalThis whose DMMF
 * lacks newer fields (e.g. Prospect.brandId) → "Unknown argument `brandId`".
 */
const PROSPECT_FIELD_FINGERPRINT = Object.keys(Prisma.ProspectScalarFieldEnum).sort().join(',');

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaProspectFingerprint?: string;
};

/** Next.js loads `.env.local`; Prisma CLI / tsx scripts may not — pull it in when missing. */
function ensureEnvLoaded() {
  if (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL) return;
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
      /* ignore malformed / unreadable */
    }
    if (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL) return;
  }
}

export function createPrismaClient() {
  ensureEnvLoaded();

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const log = process.env.NODE_ENV === 'development' ? (['error', 'warn'] as const) : (['error'] as const);

  // Prefer Turso when configured (production / shared remote DB).
  if (tursoUrl) {
    if (!authToken) {
      throw new Error(
        'TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set. Add it to .env.local (never commit the token).',
      );
    }
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken });
    return new PrismaClient({ adapter, log: [...log] });
  }

  // Local SQLite file via Prisma's built-in engine (DATABASE_URL=file:./prisma/dev.db).
  if (databaseUrl?.startsWith('file:')) {
    return new PrismaClient({ log: [...log] });
  }

  // libsql URL mistakenly put only in DATABASE_URL without adapter token.
  if (databaseUrl?.startsWith('libsql://') || databaseUrl?.startsWith('https://')) {
    throw new Error(
      'Remote libSQL/Turso URLs require TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (and @prisma/adapter-libsql). ' +
        'Keep DATABASE_URL as file:./prisma/dev.db for Prisma CLI.',
    );
  }

  return new PrismaClient({ log: [...log] });
}

function getPrismaClient() {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaProspectFingerprint === PROSPECT_FIELD_FINGERPRINT
  ) {
    return globalForPrisma.prisma;
  }
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaProspectFingerprint = PROSPECT_FIELD_FINGERPRINT;
  }
  return client;
}

export const prisma = getPrismaClient();
