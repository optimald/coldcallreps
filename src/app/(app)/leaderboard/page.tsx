import { redirect } from 'next/navigation';

/** Leaderboard lives on the dashboard now. */
export default function LeaderboardRedirectPage() {
  redirect('/dashboard#leaderboard');
}
