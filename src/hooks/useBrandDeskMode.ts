'use client';

import { useEffect, useState } from 'react';
import {
  readBrandDeskMode,
  writeBrandDeskMode,
  type BrandDeskMode,
} from '@/lib/brand-context';
import { useShellDeskMode } from '@/components/ShellProvider';

/**
 * Subscribe to brand Live / Demo desk mode (sidebar + desk pages).
 *
 * Inside AppShell, mode comes from SSR-seeded ShellProvider — hydrated immediately.
 * Outside the shell (rare), falls back to localStorage after mount.
 */
export function useBrandDeskMode(initial?: BrandDeskMode) {
  const fromShell = useShellDeskMode();
  const [mode, setMode] = useState<BrandDeskMode>(
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
    const stored = readBrandDeskMode();
    setMode(stored);
    writeBrandDeskMode(stored);
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ccr-brand-desk-mode') {
        setMode(e.newValue === 'demo' ? 'demo' : 'live');
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<BrandDeskMode>).detail;
      if (detail === 'demo' || detail === 'live') setMode(detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ccr-brand-desk-mode', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ccr-brand-desk-mode', onCustom);
    };
  }, [fromShell]);

  function setDeskMode(next: BrandDeskMode) {
    if (fromShell) {
      fromShell.setDeskMode(next);
      setMode(next);
      return;
    }
    writeBrandDeskMode(next);
    setMode(next);
  }

  if (fromShell) {
    return {
      mode: fromShell.mode,
      setDeskMode: fromShell.setDeskMode,
      hydrated: true as const,
    };
  }

  return { mode, setDeskMode, hydrated };
}
