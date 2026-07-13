import { requireUser } from '@/lib/auth';
import { redirectBrandToScoped } from '@/lib/brand-redirects';
import { effectiveRole } from '@/lib/roles';

/** Brands use brand-scoped leads (with Maps leadgen) — not the personal CRM page. */
export default async function ProspectsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  if (role === 'BRAND' || role === 'RECRUITER') {
    await redirectBrandToScoped(profile, 'leads');
  }
  return children;
}
