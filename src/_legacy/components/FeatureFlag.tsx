'use client';

import { useFeatureFlagEnabled } from 'posthog-js/react';
import type { ReactNode } from 'react';

/** Client-side feature flag gate. Renders children only when the flag is enabled. */
export function FeatureFlag({
  flag,
  children,
  fallback = null,
}: {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const enabled = useFeatureFlagEnabled(flag);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
