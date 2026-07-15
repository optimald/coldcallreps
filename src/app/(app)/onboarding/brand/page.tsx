import { Suspense } from 'react';
import OnboardingBrandPage from './OnboardingBrandClient';

export default function Page() {
  return (
    <Suspense fallback={<main className="auth-shell">Loading…</main>}>
      <OnboardingBrandPage />
    </Suspense>
  );
}
