/**
 * Observability — PostHog exceptions when configured; otherwise console.
 * Soft Sentry stub remains for future @sentry/nextjs wiring.
 */

type SentryLike = {
  captureException: (err: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
};

let cached: SentryLike | null | undefined;

function getSentry(): SentryLike | null {
  if (cached !== undefined) return cached;
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    cached = null;
    return null;
  }
  cached = {
    captureException(err, hint) {
      console.error('[sentry]', err, hint || '');
    },
    captureMessage(msg, level) {
      console[level === 'error' ? 'error' : 'warn']('[sentry]', msg);
    },
  };
  return cached;
}

function posthogEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}

export function captureException(err: unknown, hint?: Record<string, unknown>) {
  const distinctId =
    (typeof hint?.userId === 'string' && hint.userId) ||
    (typeof hint?.distinctId === 'string' && hint.distinctId) ||
    'server';

  if (posthogEnabled() && typeof window === 'undefined') {
    try {
      // Dynamic import keeps this module usable from edge-adjacent code paths.
      // webpackIgnore: never pull posthog-node into client bundles.
      void import(/* webpackIgnore: true */ '@/lib/posthog/server').then(
        ({ captureServerException }) => {
          captureServerException(distinctId, err, hint);
        }
      );
    } catch {
      /* ignore */
    }
  }

  const s = getSentry();
  if (s) s.captureException(err, hint);
  else if (process.env.NODE_ENV !== 'test' && !posthogEnabled()) console.error(err);
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'warning') {
  const s = getSentry();
  if (s) s.captureMessage(msg, level);
  else if (level === 'error' && process.env.NODE_ENV !== 'test') console.error(msg);
}

// Re-export for server call sites that historically imported drills from here.
export { suggestDrillFromImprovements } from '@/lib/drills';
