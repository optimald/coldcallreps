'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: '/admin', label: 'Command', exact: true },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/review', label: 'Review' },
  { href: '/admin/users', label: 'Users' },
];

export function AdminSubNav({ reviewBadge }: { reviewBadge?: number | null }) {
  const pathname = usePathname();

  return (
    <nav className="brand-subnav admin-subnav" aria-label="Super admin">
      <div className="brand-subnav__row">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const badge =
            tab.href === '/admin/review' && reviewBadge != null && reviewBadge > 0
              ? reviewBadge
              : null;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`brand-subnav__tab${active ? ' is-active' : ''}`}
            >
              {tab.label}
              {badge != null ? (
                <span className="admin-subnav__badge">{badge}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
