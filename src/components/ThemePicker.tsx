'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { THEMES, themesForMode, type ThemeId, type ThemeMode } from '@/lib/themes';

type ThemePickerProps = {
  /** Compact for marketing header / tight topbars */
  compact?: boolean;
  /** Homepage/marketing: Light | Dark only (no multi-theme menu). */
  lightDarkOnly?: boolean;
};

function ModeIcon({ mode }: { mode: ThemeMode }) {
  const common = {
    className: 'theme-picker__icon',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  if (mode === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 14.5A8.5 8.5 0 019.5 3 7 7 0 1019 14.5c.7 0 1.4-.2 2-.5z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export default function ThemePicker({ compact = false, lightDarkOnly = false }: ThemePickerProps) {
  const { themeId, mode, setThemeId, setMode, mounted } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = THEMES.find((t) => t.id === themeId)!;
  const lightThemes = themesForMode('light');
  const darkThemes = themesForMode('dark');

  const pick = (id: ThemeId) => {
    setThemeId(id);
    setOpen(false);
  };

  const switchMode = (next: ThemeMode) => {
    if (next === mode) return;
    setMode(next);
  };

  if (!mounted) {
    if (lightDarkOnly) {
      return (
        <div className="theme-mode-toggle" aria-hidden>
          <span className="theme-mode-toggle__btn">Light</span>
          <span className="theme-mode-toggle__btn">Dark</span>
        </div>
      );
    }
    return (
      <div className={`theme-picker${compact ? ' theme-picker--compact' : ''}`}>
        <button type="button" className="theme-picker__trigger" aria-label="Theme" disabled>
          <ModeIcon mode="dark" />
        </button>
      </div>
    );
  }

  if (lightDarkOnly) {
    return (
      <div className="theme-mode-toggle" role="group" aria-label="Color mode">
        <button
          type="button"
          className={`theme-mode-toggle__btn${mode === 'light' ? ' is-active' : ''}`}
          aria-pressed={mode === 'light'}
          onClick={() => switchMode('light')}
        >
          Light
        </button>
        <button
          type="button"
          className={`theme-mode-toggle__btn${mode === 'dark' ? ' is-active' : ''}`}
          aria-pressed={mode === 'dark'}
          onClick={() => switchMode('dark')}
        >
          Dark
        </button>
      </div>
    );
  }

  return (
    <div className={`theme-picker${compact ? ' theme-picker--compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="theme-picker__trigger"
        aria-label="Theme"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={`Theme: ${active.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <ModeIcon mode={mode} />
      </button>

      {open && (
        <div className="theme-picker__panel" role="listbox" id={listId} aria-label="Color themes">
          <div className="theme-picker__modes" role="group" aria-label="Light or dark">
            <button
              type="button"
              className={`theme-picker__mode${mode === 'light' ? ' is-active' : ''}`}
              onClick={() => switchMode('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={`theme-picker__mode${mode === 'dark' ? ' is-active' : ''}`}
              onClick={() => switchMode('dark')}
            >
              Dark
            </button>
          </div>

          <p className="theme-picker__group-label">Light</p>
          <ul className="theme-picker__list">
            {lightThemes.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.id === themeId}
                  className={`theme-picker__option${t.id === themeId ? ' is-active' : ''}`}
                  onClick={() => pick(t.id)}
                >
                  <span className="theme-picker__swatch" aria-hidden="true" data-theme-preview={t.id} />
                  <span className="theme-picker__option-copy">
                    <span className="theme-picker__option-name">{t.name}</span>
                    <span className="theme-picker__option-blurb">{t.blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="theme-picker__group-label">Dark</p>
          <ul className="theme-picker__list">
            {darkThemes.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.id === themeId}
                  className={`theme-picker__option${t.id === themeId ? ' is-active' : ''}`}
                  onClick={() => pick(t.id)}
                >
                  <span className="theme-picker__swatch" aria-hidden="true" data-theme-preview={t.id} />
                  <span className="theme-picker__option-copy">
                    <span className="theme-picker__option-name">{t.name}</span>
                    <span className="theme-picker__option-blurb">{t.blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
