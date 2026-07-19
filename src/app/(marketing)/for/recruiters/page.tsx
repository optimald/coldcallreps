import { redirect } from 'next/navigation';

/** Recruiter landing removed — this site recruits SDRs. */
export default function ForRecruitersRedirect() {
  redirect('/for/reps');
}
