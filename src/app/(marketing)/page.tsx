import HomePageClient from './HomePageClient';
import { HOME_FAQS, homeFaqJsonLd } from '@/lib/home-faq';

export default function LandingPage() {
  // Evaluate FAQs on the server only (TRIAL_MINUTES etc. are server env — not NEXT_PUBLIC).
  // Passing as props avoids client/server hydration mismatch.
  const faqs = HOME_FAQS.map((item) => ({
    question: item.question,
    answer: item.answer,
    links: item.links ? item.links.map((l) => ({ href: l.href, label: l.label })) : undefined,
  }));
  const jsonLd = homeFaqJsonLd({ url: 'https://coldcallreps.com/' });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient faqs={faqs} />
    </>
  );
}
