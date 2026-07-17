'use client';

import { useUser } from '@clerk/nextjs';
import { usePathname, useSearchParams } from 'next/navigation';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { Suspense, useEffect, type ReactNode } from 'react';
import { initPostHog, posthog } from '@/lib/posthog/client';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    let url = window.origin + pathname;
    const query = searchParams?.toString();
    if (query) url += `?${query}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.username,
        clerk_created_at: user.createdAt?.toISOString?.() ?? user.createdAt,
      });
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}

export default function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
