import 'server-only';

import { PostHog } from 'posthog-node';

function getPostHogConfig() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!token) return null;
  return { token, host };
}

let sharedClient: PostHog | null | undefined;

/** Singleton PostHog node client (reuse across serverless invocations in-process). */
export function getPostHogServer(): PostHog | null {
  if (sharedClient !== undefined) return sharedClient;
  const config = getPostHogConfig();
  if (!config) {
    sharedClient = null;
    return null;
  }
  sharedClient = new PostHog(config.token, {
    host: config.host,
    flushAt: 20,
    flushInterval: 10_000,
  });
  return sharedClient;
}

function scheduleFlush(posthog: PostHog) {
  const flushPromise = posthog.flush().catch((err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] flush failed', err);
    }
  });

  try {
    // Keep the serverless isolate alive until events leave the process.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require('next/server') as {
      after?: (fn: () => void | Promise<void>) => void;
    };
    if (typeof after === 'function') {
      after(async () => {
        await flushPromise;
      });
      return;
    }
  } catch {
    /* not in a Next request context */
  }

  void flushPromise;
}

export type PostHogGroups = Record<string, string>;

/** Fire-and-forget server-side product analytics (safe in API routes / server actions). */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  groups?: PostHogGroups
) {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    posthog.capture({
      distinctId,
      event,
      properties,
      groups,
    });
    scheduleFlush(posthog);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog]', event, err);
    }
  }
}

export function identifyServerUser(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    posthog.identify({ distinctId, properties });
    scheduleFlush(posthog);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] identify', err);
    }
  }
}

export function groupIdentifyServer(
  groupType: string,
  groupKey: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    posthog.groupIdentify({ groupType, groupKey, properties });
    scheduleFlush(posthog);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] groupIdentify', err);
    }
  }
}

export function captureServerException(
  distinctId: string,
  error: unknown,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error');
    // posthog-node 5.x
    if (typeof (posthog as { captureException?: Function }).captureException === 'function') {
      (posthog as { captureException: Function }).captureException(err, distinctId, properties);
    } else {
      posthog.capture({
        distinctId,
        event: '$exception',
        properties: {
          $exception_message: err.message,
          $exception_type: err.name,
          $exception_stack_trace_raw: err.stack,
          ...properties,
        },
      });
    }
    scheduleFlush(posthog);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[posthog] exception', err);
    }
  }
}
