'use client';

import { useSignupUrl } from '@/hooks/useSignupUrl';

export type SignupLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>;

/**
 * Anchor link to the rep signup flow with UTM/click ID params appended.
 *
 * Drop-in replacement for `<a href={MARKETPOUNCE_SIGN_UP_REP}>`.
 * Automatically appends first-touch tracking params while preserving
 * role=REP and from=ccr.
 */
export default function SignupLink({ children, ...props }: SignupLinkProps) {
  const href = useSignupUrl();
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
