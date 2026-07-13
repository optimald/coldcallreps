export type ThemeMode = 'light' | 'dark';

export type ThemeId =
  | 'signal-slate'
  | 'ice-line'
  | 'ember-ledger'
  | 'night-dial'
  | 'ink-voltage'
  | 'charcoal-mint';

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  blurb: string;
};

export const THEME_STORAGE_KEY = 'ccr-theme';
/** Bump when brand defaults change so legacy prefs can migrate once. */
export const THEME_MIGRATION_KEY = 'ccr-theme-mig';
/** refined-1: elevated palettes + Studio replaces cream Ember look (ids unchanged). */
export const THEME_MIGRATION_VERSION = 'refined-1';

export const THEMES: ThemeDefinition[] = [
  {
    id: 'charcoal-mint',
    name: 'Forest Ink',
    mode: 'dark',
    blurb: 'Brand default — charcoal canopy + jade pulse',
  },
  {
    id: 'night-dial',
    name: 'Athlete',
    mode: 'dark',
    blurb: 'Chartreuse + teal on ink',
  },
  {
    id: 'ink-voltage',
    name: 'Noir Voltage',
    mode: 'dark',
    blurb: 'Void black + amber charge',
  },
  {
    id: 'signal-slate',
    name: 'Porcelain',
    mode: 'light',
    blurb: 'Cool white + chartreuse signal',
  },
  {
    id: 'ice-line',
    name: 'Glacier',
    mode: 'light',
    blurb: 'Platinum steel + teal edge',
  },
  {
    id: 'ember-ledger',
    name: 'Studio',
    mode: 'light',
    blurb: 'Warm stone + graphite ink',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

/** Product default — Forest Ink. */
export const DEFAULT_THEME: ThemeId = 'charcoal-mint';
export const DEFAULT_DARK_THEME: ThemeId = 'charcoal-mint';
export const DEFAULT_LIGHT_THEME: ThemeId = 'signal-slate';

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (THEME_IDS as string[]).includes(value);
}

export function themeById(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id)!;
}

export function themesForMode(mode: ThemeMode): ThemeDefinition[] {
  return THEMES.filter((t) => t.mode === mode);
}

/**
 * One-time migrations for stored theme prefs.
 * IDs are stable; refined-1 only bumps the flag (Studio redesign ships in place of Ember).
 * athlete-1 previously moved accidental Ember defaults → Athlete.
 * Unset / invalid prefs resolve to DEFAULT_THEME (Forest Ink) — never overwrite a valid stored id.
 */
export function migrateStoredTheme(
  stored: string | null,
  migrationFlag: string | null,
): { themeId: ThemeId; wroteMigration: boolean; wroteTheme: boolean } {
  const alreadyMigrated = migrationFlag === THEME_MIGRATION_VERSION;
  if (isThemeId(stored)) {
    // Legacy: Ember was the accidental light default look before Athlete.
    if (migrationFlag !== 'athlete-1' && migrationFlag !== 'refined-1' && stored === 'ember-ledger') {
      return { themeId: DEFAULT_THEME, wroteMigration: true, wroteTheme: true };
    }
    return { themeId: stored, wroteMigration: !alreadyMigrated, wroteTheme: false };
  }
  return {
    themeId: DEFAULT_THEME,
    wroteMigration: !alreadyMigrated,
    wroteTheme: false,
  };
}

export function resolveInitialTheme(stored: string | null, migrationFlag: string | null = null): ThemeId {
  return migrateStoredTheme(stored, migrationFlag).themeId;
}

/** Parallel palettes when flipping light ↔ dark without picking a specific theme. */
const MODE_SIBLINGS: Record<ThemeId, ThemeId> = {
  'signal-slate': 'charcoal-mint',
  'charcoal-mint': 'signal-slate',
  'ice-line': 'ink-voltage',
  'ink-voltage': 'ice-line',
  'ember-ledger': 'night-dial',
  'night-dial': 'ember-ledger',
};

export function siblingTheme(id: ThemeId): ThemeId {
  return MODE_SIBLINGS[id];
}

export function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === 'undefined') return;
  const theme = themeById(themeId);
  document.documentElement.setAttribute('data-theme', themeId);
  document.documentElement.setAttribute('data-color-scheme', theme.mode);
  document.documentElement.style.colorScheme = theme.mode;
}
