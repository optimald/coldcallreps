'use client';

import { useEffect, useState } from 'react';
import {
  readAdminDeskMode,
  writeAdminDeskMode,
  type AdminDeskMode,
} from '@/lib/admin-context';
import { useShellAdminDeskMode } from '@/components/ShellProvider';

/**
 * Subscribe to superadmin Live / Demo desk mode.
 * Inside AppShell, prefer SSR-seeded ShellProvider.
 */
export function useAdminDeskMode(initial?: AdminDeskMode) {
  const fromShell = useShellAdminDeskMode();
  const [mode, setMode] = useState<AdminDeskMode>(
    () => fromShell?.mode || initial || 'live'
  );
  const [hydrated, setHydrated] = useState(
    () => Boolean(fromShell) || Boolean(initial)
  );

  useEffect(() => {
    if (fromShell) {
      setMode(fromShell.mode);
      setHydrated(true);
      return;
    }
    const stored = readAdminDeskMode();
    setMode(stored);
    writeAdminDeskMode(stored);
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ccr-admin-desk-mode') {
        setMode(e.newValue === 'demo' ? 'demo' : 'live');
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<AdminDeskMode>).detail;
      if (detail === 'demo' || detail === 'live') setMode(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ccr-admin-desk-mode', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ccr-admin-desk-mode', onCustom);
    };
  }, [fromShell]);

  function setAdminDeskMode(next: AdminDeskMode) {
    if (fromShell) {
      fromShell.setAdminDeskMode(next);
      setMode(next);
      return;
    }
    writeAdminDeskMode(next);
    setMode(next);
  }

  if (fromShell) {
    return {
      mode: fromShell.mode,
      setAdminDeskMode: fromShell.setAdminDeskMode,
      hydrated: true as const,
      isDemo: fromShell.mode === 'demo',
    };
  }

  return {
    mode,
    setAdminDeskMode,
    hydrated,
    isDemo: mode === 'demo',
  };
}
