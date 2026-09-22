import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MARKETPOUNCE_ORIGIN,
  MARKETPOUNCE_SIGN_UP_BRAND,
  MARKETPOUNCE_SIGN_UP_REP,
} from '@/lib/marketpounce';
import { SITE_ORIGIN } from '@/lib/site';

const URL = `${SITE_ORIGIN}/hire-cold-callers`;
const MP_HIRE = `${MARKETPOUNCE_ORIGIN}/guides/hire-cold-callers`;

export const metadata: Metadata = {
  title: { absolute: 'Hire Cold Callers — Get Hired as an SDR | Cold Call Reps' },
  description:
    'Hire cold callers who train, prove, and get paid on Cold Call Reps — or get hired as a cold caller yourself. Brands post on MarketPounce; reps train and earn here.',
  keywords: [
    'hire cold callers',
    'hire cold calling',
    'get hired as cold caller',
    'cold calling gigs',
    'Cold Call Reps',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Hire Cold Callers — Get Hired as an SDR | Cold Call Reps',
    description:
      'Brands hire cold callers via MarketPounce. SDRs train, clear the gate, and get paid on Cold Call Reps.',
    url: URL,
    images: [{ url: '/og.svg', width: 1200, height: 630 }],
  },
};

export default function HireColdCallersLandingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-head">
        <p className="pricing-kicker">Hire cold callers · Cold Call Reps</p>
        <h1 className="pricing-title">Hire cold callers who already cleared the gate</h1>
        <p className="pricing-lede">
          Cold Call Reps recruits human SDRs: train with AI voice, prove your score, get paid per
          meeting. Brands who want to <strong>hire cold callers</strong> for outcome-based dials do
          that on MarketPounce. Reps who want to <strong>get hired</strong> start here.
        </p>
      </header>

      <section className="pricing-hero-free" aria-labelledby="hire-rep-title">
        <p className="pricing-hero-free__label">For SDRs &amp; appointment setters</p>
        <h2 id="hire-rep-title" className="pricing-hero-free__minutes">
          Get hired as a cold caller
        </h2>
        <p className="pricing-hero-free__sub">
          Practice free, clear the quality gate, apply to brand campaigns, and get paid per verified
          booked meeting or qualified lead.
        </p>
        <ol className="pricing-path">
          <li>
            <strong>Train</strong> — AI cold call practice &amp; scorecards
          </li>
          <li>
            <strong>Prove</strong> — hit the gate and earn certification
          </li>
          <li>
            <strong>Get paid</strong> — dial funded brand deals
          </li>
        </ol>
        <a href={MARKETPOUNCE_SIGN_UP_REP} className="btn pricing-hero-free__cta">
          Start free — get hired
        </a>
        <p className="pricing-hero-free__fine">
          <Link href="/for/reps" className="soft-link">
            SDR path
          </Link>
          {' · '}
          <Link href="/guides/cold-calling-gigs" className="soft-link">
            Cold calling gigs
          </Link>
          {' · '}
          <Link href="/" className="soft-link">
            Home
          </Link>
        </p>
      </section>

      <section className="pricing-promise" aria-labelledby="hire-brand-title">
        <h2 id="hire-brand-title" className="pricing-promise__title">
          Brands: hire cold callers on MarketPounce
        </h2>
        <p>
          Post a campaign, fund escrow, and pay application-gated human reps per booked meeting or
          qualified lead. Brand-side hiring, fees, and campaign mechanics live on MarketPounce — the
          growth desk sister product.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <a href={MP_HIRE} className="btn">
            Hire cold callers on MarketPounce
          </a>
        </p>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          <a href={MARKETPOUNCE_SIGN_UP_BRAND} className="soft-link">
            Brand signup
          </a>
          {' · '}
          <a href={`${MARKETPOUNCE_ORIGIN}/for/brands`} className="soft-link">
            For brands
          </a>
        </p>
      </section>
    </main>
  );
}
