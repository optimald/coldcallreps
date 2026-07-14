'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader, Panel, SoftLink } from '@/components/ui/PagePrimitives';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';
import {
  ADMIN_DEMO_MSG,
  resolveAdminDemoPayload,
} from '@/lib/demo/admin-demo-data';

export function useAdminFetch<T>(url: string) {
  const { mode, hydrated, isDemo } = useAdminDeskMode();
  const [data, setData] = useState<T | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError('');
    if (mode === 'demo') {
      const demo = resolveAdminDemoPayload(url);
      if (demo) {
        setData(demo as T);
        setForbidden(false);
        setLoading(false);
        return;
      }
    }
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed to load');
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    if (!hydrated) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mode, hydrated]);

  return {
    data,
    forbidden,
    error,
    loading,
    reload,
    setError,
    isDemo,
    demoMsg: ADMIN_DEMO_MSG,
  };
}

/** Client helper for pages that fetch manually. */
export async function adminGetJson<T>(url: string, isDemo: boolean): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}> {
  if (isDemo) {
    const demo = resolveAdminDemoPayload(url);
    if (demo) return { ok: true, status: 200, data: demo as T };
  }
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, data: null, error: 'forbidden' };
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, data: null, error: d.error || 'Failed to load' };
  }
  return { ok: true, status: res.status, data: (await res.json()) as T };
}

export function AdminGate({
  title,
  forbidden,
  children,
}: {
  title: string;
  forbidden: boolean;
  children: ReactNode;
}) {
  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title={title} description="Ops access required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }
  return (
    <main className="app-page admin-page">
      {children}
    </main>
  );
}

export function AdminPageChrome({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow="Platform" title={title} description={description} actions={actions} />
      {children}
    </>
  );
}

export { Panel, SoftLink, PageHeader, ADMIN_DEMO_MSG };
