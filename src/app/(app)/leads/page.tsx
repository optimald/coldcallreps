import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { redirectBrandToScoped } from '@/lib/brand-redirects';
import { effectiveRole } from '@/lib/roles';

/**
 * Flat /leads — brands → brand-scoped leads; SDRs → trainer.
 */
export default async function LeadsPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);

  if (role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN') {
    await redirectBrandToScoped(profile, 'leads');
  }

  redirect('/practice');
}
