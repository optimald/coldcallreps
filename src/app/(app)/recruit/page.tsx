import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';
import RecruitClient from '@/components/RecruitClient';

export default async function RecruitPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  if (role !== 'BRAND' && role !== 'RECRUITER' && role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  return (
    <Suspense fallback={<main className="app-page"><p className="muted">Loading recruit…</p></main>}>
      <RecruitClient />
    </Suspense>
  );
}
