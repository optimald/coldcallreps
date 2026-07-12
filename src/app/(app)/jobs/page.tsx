import { redirect } from 'next/navigation';

/** Jobs demoted — campaigns/gigs are the primary marketplace. */
export default function JobsRedirectPage() {
  redirect('/gigs');
}
