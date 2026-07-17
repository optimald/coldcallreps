import 'server-only';

import { getPostHogServer } from '@/lib/posthog/server';

/** Server-side feature flag evaluation (no flicker). Defaults to false when PostHog is unset. */
export async function isFeatureEnabled(
  flagKey: string,
  distinctId: string,
  groups?: Record<string, string>
): Promise<boolean> {
  const posthog = getPostHogServer();
  if (!posthog) return false;
  try {
    const enabled = await posthog.isFeatureEnabled(flagKey, distinctId, {
      groups,
    });
    return Boolean(enabled);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] flag', flagKey, err);
    }
    return false;
  }
}

export async function getFeatureFlagPayload(
  flagKey: string,
  distinctId: string
): Promise<string | boolean | number | Record<string, unknown> | null> {
  const posthog = getPostHogServer();
  if (!posthog) return null;
  try {
    const value = await posthog.getFeatureFlagPayload(flagKey, distinctId);
    return (value as string | boolean | number | Record<string, unknown> | null) ?? null;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] flag payload', flagKey, err);
    }
    return null;
  }
}

/** Known product flags — create these in PostHog (or via scripts/setup-posthog.ts). */
export const FLAGS = {
  NEW_ONBOARDING: 'new-onboarding-flow',
  PRACTICE_GATE_V2: 'practice-gate-v2',
  BRAND_DESK_V2: 'brand-desk-v2',
} as const;
