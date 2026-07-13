import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { redirectBrandToScoped } from '@/lib/brand-redirects';
import { effectiveRole } from '@/lib/roles';

/**
 * Deprecated global playbooks index — brand desk owns playbooks at
 * /brands/[id]/playbooks. Keep /playbooks/[id] for editing a single playbook.
 */
export default async function PlaybooksIndexRedirect() {
  const profile = await requireUser();
  const role = effectiveRole(profile);

  if (role === 'BRAND' || role === 'RECRUITER' || role === 'SUPERADMIN') {
    await redirectBrandToScoped(profile, 'playbooks');
  }

  // SDRs / managers: practice is the consumer of talk tracks
  redirect('/practice');
}
