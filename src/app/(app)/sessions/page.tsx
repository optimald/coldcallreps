import Link from 'next/link';
import { PageHeader } from '@/components/ui/PagePrimitives';
import PracticeCallsList from '@/components/PracticeCallsList';

export default function SessionsIndexPage() {
  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Practice"
        title="Past calls"
        description="Every scored practice session — lead, scenario, duration, and score. Open a row for transcript, coach log, and playback."
        actions={
          <Link href="/practice" className="btn">
            New practice call
          </Link>
        }
      />
      <PracticeCallsList />
    </main>
  );
}
