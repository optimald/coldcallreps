import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { redirectBrandToScoped } from '@/lib/brand-redirects';
import { effectiveRole } from '@/lib/roles';

/**
 * Recruiter desk demoted (PRD Jul 2026).
 * Brand / legacy recruiter → brand-scoped leads.
 * Everyone else → dashboard.
 */
export default async function RecruiterRedirectPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  if (role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN') {
    await redirectBrandToScoped(profile, 'leads');
  }
  redirect('/dashboard');
}
