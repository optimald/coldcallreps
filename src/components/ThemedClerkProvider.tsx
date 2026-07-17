'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import ResolvePendingOrgTask from '@/components/ResolvePendingOrgTask';

type CssVars = {
  accent: string;
  onAccent: string;
  bgElevated: string;
  bgSoft: string;
  ink: string;
  muted: string;
  line: string;
  bad: string;
  good: string;
  warn: string;
};

const FALLBACK_DARK: CssVars = {
  accent: '#2dd4bf',
  onAccent: '#04201a',
  bgElevated: '#111816',
  bgSoft: '#1a2420',
  ink: '#f0f7f4',
  muted: '#8b9e96',
  line: '#2a3832',
  bad: '#f87171',
  good: '#34d399',
  warn: '#fbbf24',
};

const FALLBACK_LIGHT: CssVars = {
  accent: '#0d9488',
  onAccent: '#ffffff',
  bgElevated: '#ffffff',
  bgSoft: '#f4f7f5',
  ink: '#141f24',
  muted: '#5f7370',
  line: '#d7e0dc',
  bad: '#dc2626',
  good: '#059669',
  warn: '#d97706',
};

function readCssVars(mode: 'light' | 'dark'): CssVars {
  if (typeof window === 'undefined') {
    return mode === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT;
  }
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  const fb = mode === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT;
  return {
    accent: get('--accent', fb.accent),
    onAccent: get('--on-accent', fb.onAccent),
    bgElevated: get('--bg-elevated', fb.bgElevated),
    bgSoft: get('--bg-soft', fb.bgSoft),
    ink: get('--ink', fb.ink),
    muted: get('--muted', fb.muted),
    line: get('--line', fb.line),
    bad: get('--bad', fb.bad),
    good: get('--good', fb.good),
    warn: get('--warn', fb.warn),
  };
}

/**
 * Clerk does not reliably resolve CSS custom properties in appearance.variables.
 * Read computed theme tokens and pass concrete colors so dark mode stays readable.
 */
export default function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const { mode, themeId, mounted } = useTheme();
  const [vars, setVars] = useState<CssVars>(() =>
    mode === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT
  );

  useEffect(() => {
    setVars(readCssVars(mode));
  }, [mode, themeId, mounted]);

  const appearance = useMemo(
    () => ({
      variables: {
        colorPrimary: vars.accent,
        colorTextOnPrimaryBackground: vars.onAccent,
        colorBackground: vars.bgElevated,
        colorInputBackground: vars.bgSoft,
        colorInputText: vars.ink,
        colorText: vars.ink,
        colorTextSecondary: vars.muted,
        colorNeutral: vars.muted,
        colorDanger: vars.bad,
        colorSuccess: vars.good,
        colorWarning: vars.warn,
        borderRadius: '0.5rem',
      },
      elements: {
        card: {
          background: vars.bgElevated,
          border: `1px solid ${vars.line}`,
          boxShadow: 'none',
          color: vars.ink,
        },
        headerTitle: { color: vars.ink },
        headerSubtitle: { color: vars.muted },
        formFieldLabel: { color: vars.ink },
        formFieldInput: {
          background: vars.bgSoft,
          color: vars.ink,
          borderColor: vars.line,
        },
        formButtonPrimary: {
          backgroundColor: vars.accent,
          color: vars.onAccent,
          borderRadius: '2px',
          fontWeight: '700',
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          boxShadow: 'none',
        },
        footerActionLink: { color: vars.accent },
        footer: { color: vars.muted },
        footerPagesLink: { color: vars.muted },
        identityPreviewText: { color: vars.muted },
        identityPreviewEditButton: { color: vars.accent },
        formFieldHintText: { color: vars.muted },
        formFieldSuccessText: { color: vars.good },
        formFieldErrorText: { color: vars.bad },
        dividerText: { color: vars.muted },
        socialButtonsBlockButton: {
          background: vars.bgSoft,
          color: vars.ink,
          borderColor: vars.line,
        },
      },
    }),
    [vars]
  );

  return (
    <ClerkProvider
      appearance={appearance}
      // Orgs are optional for product flows (brand setup, campaigns). Membership
      // required leaves sessions `pending` on choose-organization; do not treat
      // that as signed-out or the app is unusable until the task clears.
      treatPendingAsSignedOut={false}
    >
      <ResolvePendingOrgTask />
      {children}
    </ClerkProvider>
  );
}
