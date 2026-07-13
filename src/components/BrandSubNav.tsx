'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { brandHref, writeSelectedBrandKey, type BrandRef } from '@/lib/brand-context';

type Tab = { href: string; label: string; match?: string };

export default function BrandSubNav({ brand }: { brand: BrandRef }) {
  const pathname = usePathname();
  const key = brand.slug || brand.id;

  useEffect(() => {
    writeSelectedBrandKey(key);
  }, [key]);

  const tabs: Tab[] = [
    { href: brandHref(brand), label: 'Desk', match: brandHref(brand) },
    { href: brandHref(brand, 'campaigns'), label: 'Campaigns' },
    { href: brandHref(brand, 'pipeline'), label: 'Pipeline' },
    { href: brandHref(brand, 'leads'), label: 'Leads' },
    { href: brandHref(brand, 'calls'), label: 'Calls' },
    { href: brandHref(brand, 'practice'), label: 'Practice' },
    { href: brandHref(brand, 'sdrs', 'applications'), label: 'SDRs', match: brandHref(brand, 'sdrs') },
  ];

  function active(tab: Tab) {
    const base = tab.match || tab.href;
    if (tab.label === 'Desk') {
      return pathname === base || pathname === `${base}/`;
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  return (
    <nav className="brand-subnav" aria-label={`${brand.name} sections`}>
      <div className="brand-subnav__row">
        {tabs.map((tab) => {
          const isActive = active(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`brand-subnav__tab${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
