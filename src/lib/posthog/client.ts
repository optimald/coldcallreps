'use client';

import posthog from 'posthog-js';

let initialized = false;

export function initPostHog() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host || typeof window === 'undefined' || initialized) return;

  posthog.init(token, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    defaults: '2026-05-30',
  });
  initialized = true;
}

export function captureClientEvent(event: string, properties?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  posthog.capture(event, properties);
}

export { posthog };
