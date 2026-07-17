'use client';

import posthog from 'posthog-js';

/** Same-origin reverse proxy path (see next.config.ts). Avoid obvious names like /posthog. */
export const POSTHOG_PROXY_PATH = '/ccr-ph';

let initialized = false;

export function initPostHog() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || typeof window === 'undefined' || initialized) return;

  posthog.init(token, {
    api_host: POSTHOG_PROXY_PATH,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    disable_session_recording: false,
    disable_surveys: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask], .ph-mask',
    },
    // defaults bundle enables heatmaps + modern capture behavior
    defaults: '2026-05-30',
  } as Parameters<typeof posthog.init>[1]);
  initialized = true;
}

export function captureClientEvent(event: string, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  posthog.capture(event, properties);
}

export function syncClientPersonProperties(properties: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  posthog.setPersonProperties(properties);
}

export function setClientGroup(
  groupType: string,
  groupKey: string,
  properties?: Record<string, unknown>
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  posthog.group(groupType, groupKey, properties);
}

export function captureClientException(error: unknown, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown error');
  if (typeof posthog.captureException === 'function') {
    posthog.captureException(err, properties);
  } else {
    posthog.capture('$exception', {
      $exception_message: err.message,
      $exception_type: err.name,
      $exception_stack_trace_raw: err.stack,
      ...properties,
    });
  }
}

export { posthog };
