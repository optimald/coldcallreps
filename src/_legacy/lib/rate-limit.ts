/**
 * Best-effort rate limiter.
 *
 * Prefer Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set (shared across serverless instances). Falls back to in-memory
 * sliding window per instance.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterSec: 0 };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, retryAfterSec: 0 };
}

async function upstashLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; remaining: number; retryAfterSec: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rl:${opts.key}`;
  const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000));

  try {
    // INCR + EXPIRE on first hit via REST pipeline
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, String(windowSec), 'NX'],
        ['TTL', redisKey],
      ]),
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number | string }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttl = Number(data?.[2]?.result ?? windowSec);
    if (count > opts.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.max(1, ttl > 0 ? ttl : windowSec),
      };
    }
    return {
      ok: true,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSec: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Sync API kept for existing call sites. Uses memory immediately; when Upstash
 * is configured, fire-and-forget sync path still uses memory for the request
 * (Upstash-backed variant: rateLimitAsync).
 */
export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  return memoryLimit(opts);
}

/** Prefer this in new hot paths when Upstash may be configured. */
export async function rateLimitAsync(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  const distributed = await upstashLimit(opts);
  if (distributed) return distributed;
  return memoryLimit(opts);
}

/** Periodic cleanup to avoid unbounded growth in long-lived processes. */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}
