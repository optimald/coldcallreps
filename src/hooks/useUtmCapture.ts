'use client';

import { useEffect } from 'react';
import { captureFirstTouchUtms } from '@/lib/utm';

/**
 * Captures first-touch UTM and click ID params on initial page load.
 * Call once near the root of the app (e.g. in a layout or provider).
 */
export function useUtmCapture(): void {
  useEffect(() => {
    captureFirstTouchUtms();
  }, []);
}
