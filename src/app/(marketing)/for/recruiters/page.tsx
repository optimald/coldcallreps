import { redirect } from 'next/navigation';

/** Recruiter landing demoted — founders/brands own talent + campaigns. */
export default function ForRecruitersRedirect() {
  redirect('/for/brands');
}
