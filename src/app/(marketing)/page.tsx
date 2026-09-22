import HomePageClient from './HomePageClient';
import { homeFaqJsonLd } from '@/lib/home-faq';
import { SITE_ORIGIN } from '@/lib/site';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Cold Call Reps — Train. Prove. Get Paid.' },
  description:
    'Cold Call Reps: find cold calling gigs, get hired as a cold caller, and get paid per meeting. Brands hire cold callers who clear the quality gate — Train. Prove. Get Paid.',
  alternates: { canonical: SITE_ORIGIN },
};

export default function LandingPage() {
  const jsonLd = homeFaqJsonLd({ url: `${SITE_ORIGIN}/` });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
