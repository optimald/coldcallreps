'use client';

import Link from 'next/link';
import SignupLink from '@/components/SignupLink';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

export type SmartLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Renders a Link or SignupLink based on the href.
 * For rep signup URLs, uses SignupLink to append UTM params.
 * For all other URLs, uses Next.js Link.
 */
export default function SmartLink({ href, children, className }: SmartLinkProps) {
  if (href === MARKETPOUNCE_SIGN_UP_REP) {
    return (
      <SignupLink className={className}>
        {children}
      </SignupLink>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
