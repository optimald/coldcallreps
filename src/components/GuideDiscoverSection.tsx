import Link from 'next/link';
import { GUIDES } from '@/lib/guides';

/**
 * Discovery links into the four live CCR rep guides.
 * Used on home and /for/reps so Google (and humans) can reach guide URLs
 * from high-authority landing pages — not a card grid.
 */
export default function GuideDiscoverSection() {
  return (
    <section className="lp-ath-guides" aria-labelledby="lp-guides-title">
      <p className="lp-ath-kicker lp-ath-kicker--center">Guides</p>
      <h2 id="lp-guides-title" className="lp-ath-h2 lp-ath-h2--center">
        How to get hired and get paid
      </h2>
      <p className="lp-ath-guides__lede">
        Short answers for SDRs — gigs, practice, applications, and payouts.
      </p>
      <ul className="lp-ath-guides__list">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link href={`/guides/${guide.slug}`}>{guide.oneLiner}</Link>
          </li>
        ))}
      </ul>
      <p className="lp-ath-guides__all">
        <Link href="/guides">Browse all guides →</Link>
      </p>
    </section>
  );
}
