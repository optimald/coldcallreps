'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * Visible banner when the session is a Clerk actor (impersonation) token.
 * Spec §3.2 — never silently indistinguishable from the real user.
 */
export function ImpersonationBanner() {
  const { actor } = useAuth();
  const { user } = useUser();

  if (!actor) return null;

  const actorSub =
    typeof actor === 'object' && actor && 'sub' in actor
      ? String((actor as { sub?: string }).sub || '')
      : '';

  return (
    <div className="impersonation-banner" role="status">
      <strong>Support view</strong>
      <span>
        You are viewing as {user?.primaryEmailAddress?.emailAddress || user?.fullName || 'user'}
        {actorSub ? ` · actor ${actorSub.slice(0, 12)}…` : ''}
        . Session is time-limited and audit-logged.
      </span>
      <Link href="/admin/users" className="impersonation-banner__exit">
        Exit to admin
      </Link>
    </div>
  );
}
