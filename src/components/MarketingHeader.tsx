'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';

/** Marketing top nav — brand always in the header. */
export default function MarketingHeader() {
  return (
    <header className="mkt-header">
      <BrandMark />
      <nav className="mkt-header__nav">
        <div className="mkt-nav-links">
          <Link href="/for" style={{ color: 'var(--muted)' }}>
            Who it’s for
          </Link>
          <Link href="/for/reps" style={{ color: 'var(--muted)' }}>
            Sales Reps
          </Link>
          <Link href="/for/brands" style={{ color: 'var(--muted)' }}>
            Brand Founders
          </Link>
          <SignedIn>
            <Link href="/gigs" style={{ color: 'var(--muted)' }}>
              Brand deals
            </Link>
          </SignedIn>
          <Link href="/pricing" style={{ color: 'var(--muted)' }}>
            Pricing
          </Link>
        </div>
        <Link href="/for" className="mkt-nav-pricing-mobile" style={{ color: 'var(--muted)' }}>
          Roles
        </Link>
        <SignedOut>
          <Link href="/sign-in" style={{ color: 'var(--muted)' }}>
            Sign in
          </Link>
          <Link href="/sign-up?role=REP" className="btn">
            Start free
          </Link>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard" style={{ color: 'var(--muted)' }}>
            Dashboard
          </Link>
          <UserButton />
        </SignedIn>
      </nav>
    </header>
  );
}
