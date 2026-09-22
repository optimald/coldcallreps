import Link from 'next/link';
import { getRelatedGuides } from '@/lib/guides';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import GuideCard from './GuideCard';

export default function RelatedGuides({ slug }: { slug: string }) {
  const related = getRelatedGuides(slug);

  return (
    <section className="guide-related" aria-labelledby="guide-related-title">
      {related.length > 0 ? (
        <>
          <h2 id="guide-related-title" className="guide-related__title">
            Related guides
          </h2>
          <div className="guide-card-grid">
            {related.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </>
      ) : null}
      <p style={{ marginTop: related.length > 0 ? '1.1rem' : 0, fontSize: '0.9rem' }}>
        <Link href="/" className="soft-link">
          Home
        </Link>
        {' · '}
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="soft-link">
          Sign up
        </a>
        {' · '}
        <Link href="/guides" className="soft-link">
          All guides
        </Link>
        {' · '}
        <Link href="/for/reps" className="soft-link">
          SDR path
        </Link>
      </p>
    </section>
  );
}
