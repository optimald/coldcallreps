import { redirect } from 'next/navigation';

/** Public profile / resume editing lives on /hiring. */
export default function PublicProfileSettingsRedirect() {
  redirect('/hiring');
}
