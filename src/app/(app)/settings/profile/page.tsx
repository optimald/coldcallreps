import { redirect } from 'next/navigation';

/** Public profile handle lives on /hiring; resume on /resume. */
export default function PublicProfileSettingsRedirect() {
  redirect('/hiring');
}
