'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { BrandDeskMode, BrandRef } from '@/lib/brand-context';
import type { AdminDeskMode } from '@/lib/admin-context';
import type { AppRole } from '@/lib/roles';
import type { RoleModeState } from '@/lib/role-mode';
import type { ShellMetrics } from '@/lib/shell-bootstrap';

export type ShellContextValue = {
  role: AppRole;
  roleMode: RoleModeState | null;
  brands: BrandRef[];
  selectedBrand: BrandRef | null;
  metrics: ShellMetrics;
  deskMode: BrandDeskMode;
  setDeskMode: (mode: BrandDeskMode) => void;
  adminDeskMode: AdminDeskMode;
  setAdminDeskMode: (mode: AdminDeskMode) => void;
  /** Always true when shell context is mounted — desk mode is SSR-seeded. */
  deskHydrated: true;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  role,
  roleMode,
  brands,
  selectedBrand,
  metrics,
  deskMode,
  setDeskMode,
  adminDeskMode,
  setAdminDeskMode,
  children,
}: {
  role: AppRole;
  roleMode: RoleModeState | null;
  brands: BrandRef[];
  selectedBrand: BrandRef | null;
  metrics: ShellMetrics;
  deskMode: BrandDeskMode;
  setDeskMode: (mode: BrandDeskMode) => void;
  adminDeskMode: AdminDeskMode;
  setAdminDeskMode: (mode: AdminDeskMode) => void;
  children: ReactNode;
}) {
  const value = useMemo<ShellContextValue>(
    () => ({
      role,
      roleMode,
      brands,
      selectedBrand,
      metrics,
      deskMode,
      setDeskMode,
      adminDeskMode,
      setAdminDeskMode,
      deskHydrated: true,
    }),
    [
      role,
      roleMode,
      brands,
      selectedBrand,
      metrics,
      deskMode,
      setDeskMode,
      adminDeskMode,
      setAdminDeskMode,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}

/** Prefer shell context; never block on localStorage when inside AppShell. */
export function useShellDeskMode(): {
  mode: BrandDeskMode;
  setDeskMode: (mode: BrandDeskMode) => void;
  hydrated: boolean;
} | null {
  const shell = useContext(ShellContext);
  if (!shell) return null;
  return {
    mode: shell.deskMode,
    setDeskMode: shell.setDeskMode,
    hydrated: true,
  };
}

export function useShellAdminDeskMode(): {
  mode: AdminDeskMode;
  setAdminDeskMode: (mode: AdminDeskMode) => void;
  hydrated: boolean;
} | null {
  const shell = useContext(ShellContext);
  if (!shell) return null;
  return {
    mode: shell.adminDeskMode,
    setAdminDeskMode: shell.setAdminDeskMode,
    hydrated: true,
  };
}
