'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * If the active desk mode is not onboarded yet, force the matching onboarding route.
 */
function RoleModeGateInner() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/onboarding')) return;
    let cancelled = false;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.roleMode) return;
        const mode = d.roleMode.activeMode as 'REP' | 'BRAND' | null;
        if (!mode) return;
        const status = d.roleMode.modes?.[mode];
        if (status && !status.onboarded && status.onboardingPath) {
          router.replace(status.onboardingPath);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}

export default function RoleModeGate() {
  return (
    <Suspense fallback={null}>
      <RoleModeGateInner />
    </Suspense>
  );
}
