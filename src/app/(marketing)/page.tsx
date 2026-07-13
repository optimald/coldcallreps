import HomePageClient from './HomePageClient';
import { homeFaqJsonLd } from '@/lib/home-faq';

export default function LandingPage() {
  const jsonLd = homeFaqJsonLd({ url: 'https://coldcallreps.com/' });

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
