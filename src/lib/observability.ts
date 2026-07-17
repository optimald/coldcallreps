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

  if (posthogEnabled()) {
    try {
      // Dynamic import keeps this module usable from edge-adjacent code paths.
      void import('@/lib/posthog/server').then(({ captureServerException }) => {
        captureServerException(distinctId, err, hint);
      });
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

/** Map scorecard improvement text → suggested practice focus drill. */
export function suggestDrillFromImprovements(
  improvements: string[] | undefined,
  currentFocus?: string
): { focus: string; label: string; reason: string } | null {
  const blob = (improvements || []).join(' ').toLowerCase();
  if (!blob.trim()) return null;

  const drills: { focus: string; label: string; needles: string[] }[] = [
    {
      focus: 'standard',
      label: 'Gatekeeper → Decision Maker',
      needles: ['gatekeeper', 'transfer', 'receptionist', 'screen'],
    },
    {
      focus: 'pricing',
      label: 'Pricing objection',
      needles: ['price', 'budget', 'cost', 'expensive', 'roi'],
    },
    {
      focus: 'rejection',
      label: 'Rejection recovery',
      needles: ['reject', 'no interest', 'not interested', 'hang up', 'brush'],
    },
    {
      focus: 'budget_500',
      label: '$500 website pitch',
      needles: ['value', 'pitch', 'offer', 'close', 'ask'],
    },
  ];

  for (const d of drills) {
    if (d.focus === currentFocus) continue;
    if (d.needles.some((n) => blob.includes(n))) {
      return {
        focus: d.focus,
        label: d.label,
        reason: `Based on feedback mentioning ${d.needles.find((n) => blob.includes(n))}.`,
      };
    }
  }

  if (currentFocus !== 'standard') {
    return {
      focus: 'standard',
      label: 'Gatekeeper → Decision Maker',
      reason: 'Strengthen the opener and transfer path.',
    };
  }
  return {
    focus: 'pricing',
    label: 'Pricing objection',
    reason: 'Practice holding value under pushback.',
  };
}
