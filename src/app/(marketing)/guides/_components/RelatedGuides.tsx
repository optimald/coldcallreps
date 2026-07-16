import Link from 'next/link';
import { getRelatedGuides } from '@/lib/guides';
import GuideCard from './GuideCard';

export default function RelatedGuides({ slug }: { slug: string }) {
  const related = getRelatedGuides(slug);
  if (related.length === 0) return null;

  return (
    <section className="guide-related" aria-labelledby="guide-related-title">
      <h2 id="guide-related-title" className="guide-related__title">
        Related guides
      </h2>
      <div className="guide-card-grid">
        {related.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
      <p style={{ marginTop: '1.1rem', fontSize: '0.9rem' }}>
        <Link href="/guides" className="soft-link">
          ← Back to all guides
        </Link>
      </p>
    </section>
  );
}
