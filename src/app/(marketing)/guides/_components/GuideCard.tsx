import Link from 'next/link';
import { GUIDE_CATEGORIES, type Guide } from '@/lib/guides';

const CATEGORY_LABEL = Object.fromEntries(
  GUIDE_CATEGORIES.map((c) => [c.id, c.label])
) as Record<Guide['category'], string>;

export default function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="guide-card">
      <p className="guide-card__kicker">{CATEGORY_LABEL[guide.category]}</p>
      <p className="guide-card__title">{guide.h1}</p>
      <p className="guide-card__desc">{guide.oneLiner}</p>
    </Link>
  );
}
