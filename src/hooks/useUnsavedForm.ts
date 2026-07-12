'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Track a form snapshot for dirty detection + reset/save.
 *
 * Pattern:
 * - `hydrate(data)` after load (sets both current + saved)
 * - edit via `values` / `setValues` / `update`
 * - `dirty` when JSON differs from last saved snapshot
 * - on successful save: `markSaved()` (or `markSaved(next)`)
 * - Reset: `reset()` restores the saved snapshot
 * - `beforeunload` fires while dirty (optional browser leave guard)
 */
export function useUnsavedForm<T>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved]
  );

  const update = useCallback((patch: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);

  /** After initial fetch — sync current + saved together. */
  const hydrate = useCallback((next: T) => {
    setValues(next);
    setSaved(next);
  }, []);

  /** Call after a successful save. Pass `next` if the server normalized fields. */
  const markSaved = useCallback(
    (next?: T) => {
      const snap = next ?? values;
      setValues(snap);
      setSaved(snap);
    },
    [values]
  );

  const reset = useCallback(() => {
    setValues(saved);
  }, [saved]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    values,
    setValues,
    update,
    saved,
    dirty,
    hydrate,
    markSaved,
    reset,
  };
}
