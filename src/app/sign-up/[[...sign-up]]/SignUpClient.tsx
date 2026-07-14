'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignUp } from '@clerk/nextjs';
import ClerkAuthShell from '@/components/ClerkAuthShell';
import BrandMark from '@/components/BrandMark';
import {
  SIGNUP_HOME_KEY,
  SIGNUP_ROLE_KEY,
  pathForRole,
} from '@/lib/signup-paths';

const PLANS = ['STARTER', 'PRO', 'TEAM'] as const;

/**
 * Sign-up is auth-only. Account type (SDR vs Brand) is chosen after signup
 * at /onboarding — optional ?role= is stored as a soft preference only.
 */
export default function SignUpClient() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    const plan = searchParams.get('plan');
    const role = searchParams.get('role');
    try {
      if (ref) sessionStorage.setItem('ccr_ref', ref.trim().toUpperCase());
      if (plan && (PLANS as readonly string[]).includes(plan)) {
        sessionStorage.setItem('ccr_plan', plan);
      }
      if (role) {
        const path = pathForRole(role);
        if (path) {
          sessionStorage.setItem(SIGNUP_ROLE_KEY, path.role);
          sessionStorage.setItem(SIGNUP_HOME_KEY, path.home);
        }
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  return (
    <ClerkAuthShell mode="sign-up">
      <div className="signup-form-wrap">
        <div className="signup-form-wrap__path">
          <BrandMark href="/" size="md" />
          <p className="signup-form-wrap__tagline">Create your account to get started.</p>
        </div>
        <SignUp />
      </div>
    </ClerkAuthShell>
  );
}
