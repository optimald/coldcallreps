import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDE_CATEGORIES, GUIDES, getGuidesByCategory } from '@/lib/guides';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import GuideCard from './_components/GuideCard';

const SITE = 'https://coldcallreps.com';
const URL = `${SITE}/guides`;

export const metadata: Metadata = {
  title: 'Guides — Earn as an SDR, Practice, Get Paid',
  description:
    'Cold Call Reps guides for SDRs: AI practice, brand deals, payouts, escrow, and how to get paid per booked meeting.',
  alternates: { canonical: URL },
  openGraph: {
    title: 'Cold Call Reps Guides',
    description:
      'Learn how to hire cold callers, find paid cold calling gigs, and how escrow, fees, and payouts work on Cold Call Reps.',
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
      url: `${SITE}/guides/${g.slug}`,
    })),
    isPartOf: { '@type': 'WebSite', name: 'Cold Call Reps', url: SITE },
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
          Straight answers on hiring human cold callers, earning as a rep, and how the money
          moves. Every guide traces its claims to how Cold Call Reps actually works — humans dial
          live, AI is practice only, and brands pay for verified outcomes.
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
