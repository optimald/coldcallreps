'use client';

import { TaskChooseOrganization } from '@clerk/nextjs';
import { useMemo } from 'react';
import ClerkAuthShell from '@/components/ClerkAuthShell';
import ResolvePendingOrgTask from '@/components/ResolvePendingOrgTask';

function resolveRedirectTarget(): string {
  if (typeof window === 'undefined') return '/dashboard';
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery =
      params.get('redirect_url') ||
      params.get('redirect_url_complete') ||
      params.get('after_sign_in_url');
    if (fromQuery) {
      const url = new URL(fromQuery, window.location.origin);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}` || '/dashboard';
      }
    }
  } catch {
    /* ignore */
  }
  return '/dashboard';
}

export default function ChooseOrganizationTaskPage() {
  const redirectTo = useMemo(() => resolveRedirectTarget(), []);

  return (
    <ClerkAuthShell mode="sign-in">
      <ResolvePendingOrgTask />
      <TaskChooseOrganization redirectUrlComplete={redirectTo} />
    </ClerkAuthShell>
  );
}
