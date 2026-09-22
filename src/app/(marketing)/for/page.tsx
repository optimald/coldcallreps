import { permanentRedirect } from 'next/navigation';
import { MARKETPOUNCE_ORIGIN } from '@/lib/marketpounce';

/** Brand audience hub lives on MarketPounce; CCR keeps /for/reps (and teams/recruiters). */
export default function ForIndexPage() {
  permanentRedirect(`${MARKETPOUNCE_ORIGIN}/for`);
}
