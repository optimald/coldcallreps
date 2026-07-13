import { Suspense } from 'react';
import TrainerView from '@/components/TrainerView';

export default function TrainerPage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--muted)' }}>Loading practice…</p>}>
      <TrainerView />
    </Suspense>
  );
}
