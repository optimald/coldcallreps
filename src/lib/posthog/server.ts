import 'server-only';

import { PostHog } from 'posthog-node';

function getPostHogConfig() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return null;
  return { token, host };
}

function createClient() {
  const config = getPostHogConfig();
  if (!config) return null;
  return new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
}

/** Fire-and-forget server-side product analytics (safe in API routes / server actions). */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  void captureServerEventAsync(distinctId, event, properties);
}

async function captureServerEventAsync(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = createClient();
  if (!posthog) return;
  try {
    posthog.capture({ distinctId, event, properties });
    await posthog.shutdown();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog]', event, err);
    }
  }
}
