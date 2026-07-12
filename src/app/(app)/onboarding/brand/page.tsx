import { Suspense } from 'react';
import OnboardingBrandPage from './OnboardingBrandClient';

export default function Page() {
  return (
    <Suspense fallback={<main className="app-page app-page--narrow">Loading…</main>}>
      <OnboardingBrandPage />
    </Suspense>
  );
}
