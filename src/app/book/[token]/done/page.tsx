import { Suspense } from 'react';
import BookDoneClient from './BookDoneClient';

export default function BookDonePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#0b0f14',
            color: '#e8eef5',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Confirming your meeting…
        </main>
      }
    >
      <BookDoneClient />
    </Suspense>
  );
}
