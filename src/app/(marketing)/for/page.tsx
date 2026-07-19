import { redirect } from 'next/navigation';

/** Audience hub collapsed — this site recruits SDRs only. */
export default function ForIndexPage() {
  redirect('/for/reps');
}
