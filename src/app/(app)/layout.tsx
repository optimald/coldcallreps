import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import GrowthBootstrap from '@/components/GrowthBootstrap';
import AppShell from '@/components/AppShell';
import { loadShellBootstrap } from '@/lib/shell-bootstrap';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShellBootstrap();
  const pathname = (await headers()).get('x-ccr-pathname') || '';

  if (shell?.accountRestricted && pathname && !pathname.startsWith('/restricted')) {
    redirect('/restricted');
  }

  if (
    shell?.needsOnboardingPath &&
    pathname &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/restricted')
  ) {
    redirect(shell.needsOnboardingPath);
  }

  return (
    <>
      <Suspense fallback={null}>
        <GrowthBootstrap />
      </Suspense>
      <AppShell initial={shell}>{children}</AppShell>
    </>
  );
}
