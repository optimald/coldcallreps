import { Suspense } from 'react';
import GrowthBootstrap from '@/components/GrowthBootstrap';
import AppShell from '@/components/AppShell';
import RoleModeGate from '@/components/RoleModeGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <GrowthBootstrap />
      </Suspense>
      <RoleModeGate />
      <AppShell>{children}</AppShell>
    </>
  );
}
