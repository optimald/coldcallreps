'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isThemeId,
  migrateStoredTheme,
  siblingTheme,
  THEME_MIGRATION_KEY,
  THEME_MIGRATION_VERSION,
  THEME_STORAGE_KEY,
  themeById,
  type ThemeId,
  type ThemeMode,
} from '@/lib/themes';

type ThemeContextValue = {
  themeId: ThemeId;
  mode: ThemeMode;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const fromDom = document.documentElement.getAttribute('data-theme');
    if (isThemeId(fromDom)) return fromDom;

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const mig = window.localStorage.getItem(THEME_MIGRATION_KEY);
    const { themeId, wroteMigration, wroteTheme } = migrateStoredTheme(stored, mig);

    if (wroteTheme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }
    if (wroteMigration) {
      window.localStorage.setItem(THEME_MIGRATION_KEY, THEME_MIGRATION_VERSION);
    }
    return themeId;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeIdState(initial);
    applyThemeToDocument(initial);
    setMounted(true);
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    if (!isThemeId(id)) return;
    setThemeIdState(id);
    applyThemeToDocument(id);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
      window.localStorage.setItem(THEME_MIGRATION_KEY, THEME_MIGRATION_VERSION);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      const current = themeById(themeId);
      if (current.mode === mode) return;
      setThemeId(siblingTheme(themeId));
    },
    [setThemeId, themeId],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      mode: themeById(themeId).mode,
      setThemeId,
      setMode,
      mounted,
    }),
    [themeId, setThemeId, setMode, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
