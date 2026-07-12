import { redirect } from 'next/navigation';

/** Arena folded into Gigs marketplace (PRD Jul 2026). */
export default function ArenaRedirectPage() {
  redirect('/gigs');
}
