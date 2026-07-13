'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShell } from '@/components/ShellProvider';

/** Role-aware entry: brands → /subscribe/brand, SDRs → /subscribe/sdr */
export default function SubscribeIndexPage() {
  const shell = useShell();
  const router = useRouter();
  const role = shell?.role || 'REP';

  useEffect(() => {
    if (role === 'BRAND' || role === 'RECRUITER') {
      router.replace('/subscribe/brand');
    } else {
      router.replace('/subscribe/sdr');
    }
  }, [role, router]);

  return (
    <main className="app-page">
      <p className="muted">Opening plans…</p>
    </main>
  );
}
