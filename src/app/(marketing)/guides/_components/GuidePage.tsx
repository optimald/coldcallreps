import Link from 'next/link';
import {
  GUIDE_CATEGORIES,
  guideFaqJsonLd,
  guideWebPageJsonLd,
  guidePath,
  type Guide,
} from '@/lib/guides';
import GuideFAQ from './GuideFAQ';
import RelatedGuides from './RelatedGuides';
import GuideCTA from './GuideCTA';

const CATEGORY_LABEL = Object.fromEntries(
  GUIDE_CATEGORIES.map((c) => [c.id, c.label])
) as Record<Guide['category'], string>;

const SITE = 'https://coldcallreps.com';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function GuidePage({
  guide,
  ctaTitle,
  ctaSub,
  children,
}: {
  guide: Guide;
  ctaTitle: string;
  ctaSub: string;
  children: React.ReactNode;
}) {
  const url = `${SITE}${guidePath(guide.slug)}`;

  return (
    <main className="guide-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideWebPageJsonLd(guide, url)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideFaqJsonLd(guide, url)) }}
      />

      <nav className="guide-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/guides">Guides</Link>
        <span aria-hidden>/</span>
        <span>{guide.h1}</span>
      </nav>

      <header>
        <p className="guide-kicker">{CATEGORY_LABEL[guide.category]}</p>
        <h1 className="guide-title">{guide.h1}</h1>
        <p className="guide-answer">{guide.directAnswer}</p>
        <div className="guide-meta">
          <span>Updated {formatDate(guide.updatedAt)}</span>
          <span>Reviewed against Cold Call Reps product &amp; fee policy</span>
        </div>
      </header>

      <div className="guide-prose">
        {children}
        <GuideFAQ faqs={guide.faqs} />
      </div>

      <RelatedGuides slug={guide.slug} />

      <GuideCTA title={ctaTitle} sub={ctaSub} ctas={guide.ctas} />
    </main>
  );
}
