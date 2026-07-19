'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import BrandMark from '@/components/BrandMark';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/for/reps', label: 'For SDRs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/guides', label: 'Guides' },
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
        </div>

        <div className="mkt-nav-actions">
          <a href={MARKETPOUNCE_SIGN_UP_REP} className="btn mkt-nav-cta">
            Start free
          </a>
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
            <div className="mkt-nav-drawer__actions">
              <a href={MARKETPOUNCE_SIGN_UP_REP} className="btn mkt-nav-drawer__btn">
                Start free
              </a>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
