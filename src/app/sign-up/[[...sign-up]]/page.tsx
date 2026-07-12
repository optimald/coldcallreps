import { Suspense } from 'react';
import SignUpClient from './SignUpClient';

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>Loading…</main>
      }
    >
      <SignUpClient />
    </Suspense>
  );
}
