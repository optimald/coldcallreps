import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';

/**
 * Recruiter desk demoted (PRD Jul 2026).
 * Brand / legacy recruiter → Leads (talent + applications).
 * Everyone else → dashboard.
 */
export default async function RecruiterRedirectPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  if (role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN') {
    redirect('/leads');
  }
  redirect('/dashboard');
}
