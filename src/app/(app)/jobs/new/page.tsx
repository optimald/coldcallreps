import { redirect } from 'next/navigation';

/** Job posting demoted — use campaigns instead. */
export default function JobsNewRedirectPage() {
  redirect('/campaigns');
}
