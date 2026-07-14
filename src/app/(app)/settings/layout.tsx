import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';

/** Super Admin has no personal Settings desk — send deep links to the command center. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  if (effectiveRole(profile) === 'SUPERADMIN') {
    redirect('/admin');
  }
  return children;
}
