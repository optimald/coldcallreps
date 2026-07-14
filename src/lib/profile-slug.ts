import { prisma } from '@/lib/prisma';
import {
  RESERVED_HANDLES,
  slugify,
  validateHandle,
} from '@/lib/handles';

export { RESERVED_HANDLES, slugify, validateHandle };

/** Root vanity URLs share one namespace — rep and team slugs cannot collide. */
async function handleTakenGlobally(
  handle: string,
  opts?: { excludeUserId?: string; excludeOrgId?: string }
): Promise<boolean> {
  const [rep, team] = await Promise.all([
    prisma.repProfile.findFirst({
      where: {
        slug: handle,
        ...(opts?.excludeUserId ? { NOT: { userId: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    prisma.academy.findFirst({
      where: {
        slug: handle,
        ...(opts?.excludeOrgId ? { NOT: { orgId: opts.excludeOrgId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  return Boolean(rep || team);
}

export async function checkRepHandleAvailable(
  raw: string,
  userId?: string
): Promise<{ available: boolean; handle: string | null; error?: string; suggestions?: string[] }> {
  const v = validateHandle(raw);
  if (!v.ok) return { available: false, handle: null, error: v.error };

  const taken = await handleTakenGlobally(v.handle, { excludeUserId: userId });
  if (!taken) return { available: true, handle: v.handle };

  const suggestions = await suggestRepHandles(v.handle, userId);
  return {
    available: false,
    handle: v.handle,
    error: 'That handle is taken.',
    suggestions,
  };
}

export async function checkTeamHandleAvailable(
  raw: string,
  orgId?: string
): Promise<{ available: boolean; handle: string | null; error?: string; suggestions?: string[] }> {
  const v = validateHandle(raw);
  if (!v.ok) return { available: false, handle: null, error: v.error };

  const taken = await handleTakenGlobally(v.handle, { excludeOrgId: orgId });
  if (!taken) return { available: true, handle: v.handle };

  const suggestions = await suggestTeamHandles(v.handle, orgId);
  return {
    available: false,
    handle: v.handle,
    error: 'That handle is taken.',
    suggestions,
  };
}

async function suggestRepHandles(base: string, userId?: string): Promise<string[]> {
  const out: string[] = [];
  const suffixes = ['hq', 'rep', 'pro', String(new Date().getFullYear()), 'sales'];
  for (const s of suffixes) {
    const candidate = `${base}-${s}`.slice(0, 48);
    const v = validateHandle(candidate);
    if (!v.ok) continue;
    const taken = await handleTakenGlobally(v.handle, { excludeUserId: userId });
    if (!taken) out.push(v.handle);
    if (out.length >= 3) break;
  }
  return out;
}

async function suggestTeamHandles(base: string, orgId?: string): Promise<string[]> {
  const out: string[] = [];
  const suffixes = ['team', 'hq', 'sales', String(new Date().getFullYear())];
  for (const s of suffixes) {
    const candidate = `${base}-${s}`.slice(0, 48);
    const v = validateHandle(candidate);
    if (!v.ok) continue;
    const taken = await handleTakenGlobally(v.handle, { excludeOrgId: orgId });
    if (!taken) out.push(v.handle);
    if (out.length >= 3) break;
  }
  return out;
}

/** Allocate a unique slug, appending a short suffix on collision (auto-provision only). */
export async function uniqueRepSlug(base: string, userId: string): Promise<string> {
  let slug = slugify(base) || `rep-${userId.slice(-8)}`;
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? slug : `${slug}-${userId.slice(-4 - i)}`.slice(0, 48);
    const taken = await handleTakenGlobally(candidate, { excludeUserId: userId });
    if (!taken) return candidate;
  }
  return `rep-${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`;
}

export async function uniqueTeamSlug(base: string, orgId: string): Promise<string> {
  let slug = slugify(base) || `team-${orgId.slice(-8)}`;
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? slug : `${slug}-${orgId.slice(-4 - i)}`.slice(0, 48);
    const taken = await handleTakenGlobally(candidate, { excludeOrgId: orgId });
    if (!taken) return candidate;
  }
  return `team-${orgId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  if (code === 'P2002') return true;
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|unique constraint/i.test(message);
}

/** Ensure every user has a public RepProfile + slug (LinkedIn-lite identity). */
export async function ensureRepProfile(opts: {
  userId: string;
  displayName?: string | null;
}) {
  const existing = await prisma.repProfile.findUnique({ where: { userId: opts.userId } });
  if (existing) return existing;

  // OAuth redirects (esp. Facebook) often hit /dashboard concurrently. Two creates
  // can pick the same free slug; retry on UNIQUE and re-read by userId.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const base =
      attempt === 0
        ? opts.displayName || opts.userId
        : `${slugify(opts.displayName || 'rep') || 'rep'}-${opts.userId.slice(-8)}-${attempt}-${Math.random().toString(36).slice(2, 6)}`;
    const slug = await uniqueRepSlug(base, opts.userId);
    try {
      return await prisma.repProfile.create({
        data: {
          userId: opts.userId,
          slug,
          bio: null,
          skillsJSON: '[]',
          clipUrlsJSON: '[]',
          featuredClipIdsJSON: '[]',
        },
      });
    } catch (err) {
      const again = await prisma.repProfile.findUnique({ where: { userId: opts.userId } });
      if (again) return again;
      if (!isUniqueConstraintError(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Failed to provision RepProfile after unique-slug retries');
}
