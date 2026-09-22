import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDE_CATEGORIES, GUIDES, getGuidesByCategory } from '@/lib/guides';
import { MARKETPOUNCE_ORIGIN, MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import { SITE_ORIGIN } from '@/lib/site';
import GuideCard from './_components/GuideCard';

const URL = `${SITE_ORIGIN}/guides`;

export const metadata: Metadata = {
  title: { absolute: 'Cold Call Reps Guides — Gigs, Practice & Getting Paid' },
  description:
    'Cold Call Reps guides for SDRs: cold calling gigs, AI practice, applications, and how to get paid per booked meeting.',
  alternates: { canonical: URL },
  openGraph: {
    title: 'Cold Call Reps Guides',
    description:
      'Learn how to find paid cold calling gigs, practice with AI, clear the quality gate, and get paid per meeting on Cold Call Reps.',
    url: URL,
    images: [{ url: '/og.svg', width: 1200, height: 630 }],
  },
};

function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': URL,
    url: URL,
    name: 'Cold Call Reps Guides',
    description: metadata.description,
    hasPart: GUIDES.map((g) => ({
      '@type': 'WebPage',
      name: g.title,
      url: `${SITE_ORIGIN}/guides/${g.slug}`,
    })),
    isPartOf: { '@type': 'WebSite', name: 'Cold Call Reps', url: SITE_ORIGIN },
  };
}

export default function GuidesHubPage() {
  return (
    <main className="guide-shell guide-wide guides-hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <header className="guides-hub__head">
        <p className="guide-kicker">Guides</p>
        <h1 className="guides-hub__title">Cold Call Reps guides</h1>
        <p className="guides-hub__lede">
          Straight answers for SDRs: find cold calling gigs, practice with AI, clear the quality
          gate, and get paid per meeting. Brand-side hiring guides live on{' '}
          <a href={`${MARKETPOUNCE_ORIGIN}/guides/hire-cold-callers`} className="soft-link">
            MarketPounce
          </a>
          .
        </p>
      </header>

      {GUIDE_CATEGORIES.map((cat) => {
        const guides = getGuidesByCategory(cat.id);
        return (
          <section key={cat.id} className="guides-hub__cat" aria-labelledby={`cat-${cat.id}`}>
            <div className="guides-hub__cat-head">
              <h2 id={`cat-${cat.id}`} className="guides-hub__cat-title">
                {cat.label}
              </h2>
              <p className="guides-hub__cat-blurb">{cat.blurb}</p>
            </div>
            <div className="guide-card-grid guide-card-grid--hub">
              {guides.map((g) => (
                <GuideCard key={g.slug} guide={g} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="guides-hub__foot">
        Recruiting SDRs? Read the{' '}
        <Link href="/for/reps" className="soft-link">
          SDR path
        </Link>
        , see{' '}
        <Link href="/hire-cold-callers" className="soft-link">
          hire cold callers
        </Link>
        , check{' '}
        <Link href="/pricing" className="soft-link">
          practice pricing
        </Link>
        , or{' '}
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="soft-link">
          start free
        </a>
        .
      </p>
    </main>
  );
}
