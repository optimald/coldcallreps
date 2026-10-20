import Link from 'next/link';
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
      <nav aria-label="Popular Cold Call Reps guides" style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1.25rem 3rem' }}>
        <p>Start where reps start</p>
        <h2>Get hired as a cold caller</h2>
        <ul>
          <li><Link href="/hire-cold-callers">Hire cold callers / get hired →</Link></li>
          <li><Link href="/for/reps">For SDRs →</Link></li>
          <li><Link href="/guides/cold-calling-gigs">Cold calling gigs →</Link></li>
          <li><Link href="/guides/remote-cold-calling-jobs">Remote cold calling jobs →</Link></li>
          <li><Link href="/guides/ai-cold-call-practice">AI cold call practice (free) →</Link></li>
          <li><Link href="/guides/get-paid-per-meeting-cold-calling">Get paid per meeting →</Link></li>
          <li><Link href="/guides/sdr-applications-and-approval">Applications &amp; approval →</Link></li>
          <li><Link href="/pricing">Pricing →</Link></li>
        </ul>
      </nav>
    </>
  );
}
