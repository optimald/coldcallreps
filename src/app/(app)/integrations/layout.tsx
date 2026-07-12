import { Suspense } from 'react';

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: '1.5rem 0' }}>Loading integrations…</p>}>
      {children}
    </Suspense>
  );
}
