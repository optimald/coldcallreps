import Link from 'next/link';
import { PageHeader } from '@/components/ui/PagePrimitives';
import PracticeCallsList from '@/components/PracticeCallsList';

export default function SessionsIndexPage() {
  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Practice"
        title="Past calls"
        description="Training vs brand dials — see minutes charged, when they renew, disposition, and goal value. Open a row for transcript, coach log, or lead detail."
        actions={
          <Link href="/practice" className="btn">
            New practice call
          </Link>
        }
      />
      <PracticeCallsList description="Filter by time and call type. Training uses practice minutes; brand dials do not." />
    </main>
  );
}
