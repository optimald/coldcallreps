'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';

const NAV_LINKS = [
  { href: '/for', label: 'Who it’s for' },
  { href: '/for/reps', label: 'Sales Reps' },
  { href: '/for/brands', label: 'Brand Founders' },
  { href: '/pricing', label: 'Pricing' },
] as const;

/** Marketing top nav — brand always in the header, drawer menu on mobile. */
export default function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="mkt-header">
      <BrandMark />

      <nav className="mkt-header__nav" aria-label="Primary">
        <div className="mkt-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="mkt-nav-link">
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <Link href="/gigs" className="mkt-nav-link">
              Brand deals
            </Link>
          </SignedIn>
        </div>

        <div className="mkt-nav-actions">
          <SignedOut>
            <Link href="/sign-in" className="mkt-nav-link mkt-nav-link--signin">
              Sign in
            </Link>
            <Link href="/sign-up?role=REP" className="btn mkt-nav-cta">
              Start free
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="mkt-nav-link mkt-nav-link--signin">
              Dashboard
            </Link>
            <UserButton />
          </SignedIn>
        </div>

        <button
          type="button"
          className="mkt-nav-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`mkt-nav-burger__box${open ? ' is-open' : ''}`} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </button>
      </nav>

      {open ? (
        <>
          <button
            type="button"
            className="mkt-nav-scrim"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="mkt-nav-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="mkt-nav-drawer__link">
                {link.label}
              </Link>
            ))}
            <SignedIn>
              <Link href="/gigs" className="mkt-nav-drawer__link">
                Brand deals
              </Link>
              <Link href="/dashboard" className="mkt-nav-drawer__link">
                Dashboard
              </Link>
            </SignedIn>
            <div className="mkt-nav-drawer__actions">
              <SignedOut>
                <Link href="/sign-in" className="btn-ghost mkt-nav-drawer__btn">
                  Sign in
                </Link>
                <Link href="/sign-up?role=REP" className="btn mkt-nav-drawer__btn">
                  Start free
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="mkt-nav-drawer__user">
                  <UserButton />
                  <span>Account</span>
                </div>
              </SignedIn>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
