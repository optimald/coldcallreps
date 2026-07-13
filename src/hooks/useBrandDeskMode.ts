'use client';

import { useEffect, useState } from 'react';
import {
  readBrandDeskMode,
  writeBrandDeskMode,
  type BrandDeskMode,
} from '@/lib/brand-context';

/**
 * Subscribe to brand Live / Demo desk mode (sidebar + desk pages).
 *
 * `mode` defaults to `'live'` until the first client effect reads localStorage.
 * Consumers that fetch must wait for `hydrated === true` before loading — otherwise
 * a pre-hydrate Live fetch can finish after Demo fixtures are applied and wipe them.
 */
export function useBrandDeskMode() {
  const [mode, setMode] = useState<BrandDeskMode>('live');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMode(readBrandDeskMode());
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
  }, []);

  function setDeskMode(next: BrandDeskMode) {
    writeBrandDeskMode(next);
    setMode(next);
  }

  return { mode, setDeskMode, hydrated };
}
