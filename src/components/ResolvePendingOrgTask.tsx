'use client';

import { useAuth, useClerk, useOrganizationList } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';

/**
 * Soft-activate an org when Membership required left the session pending.
 * Does not navigate — treatPendingAsSignedOut={false} lets the app work while
 * pending; navigation while still pending races Clerk's task redirects.
 */
export default function ResolvePendingOrgTask() {
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const { isLoaded: orgsLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !isLoaded || !orgsLoaded || !clerk.loaded) return;
    const session = clerk.session;
    if (!session || session.status !== 'pending') return;
    if (session.currentTask?.key !== 'choose-organization') return;
    if (session.lastActiveOrganizationId) return;

    const org = userMemberships.data?.[0]?.organization;
    if (!org) return;

    ran.current = true;
    void setActive({ organization: org.id }).catch((err) => {
      console.error('[ResolvePendingOrgTask]', err);
      ran.current = false;
    });
  }, [clerk, isLoaded, orgsLoaded, setActive, userMemberships.data]);

  return null;
}
