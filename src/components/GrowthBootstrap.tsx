'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  SIGNUP_HOME_KEY,
  SIGNUP_ROLE_KEY,
  pathForRole,
} from '@/lib/signup-paths';

const REF_KEY = 'ccr_ref';
const PLAN_KEY = 'ccr_plan';

const PLANS = ['STARTER', 'PRO', 'TEAM'] as const;

/**
 * Captures ?ref= / ?plan= / ?role= across Clerk redirects, applies referral,
 * and routes new accounts to the right post-signup onboarding path.
 */
export default function GrowthBootstrap() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    const plan = searchParams.get('plan');
    const role = searchParams.get('role');
    try {
      if (ref) sessionStorage.setItem(REF_KEY, ref.trim().toUpperCase());
      if (plan && (PLANS as readonly string[]).includes(plan)) {
        sessionStorage.setItem(PLAN_KEY, plan);
      }
      const path = pathForRole(role);
      if (path) {
        sessionStorage.setItem(SIGNUP_ROLE_KEY, path.role);
        sessionStorage.setItem(SIGNUP_HOME_KEY, path.home);
      }
    } catch {
      /* ignore storage */
    }
  }, [searchParams]);

  useEffect(() => {
    if (ran.current) return;
    if (!pathname || pathname.startsWith('/sign-')) return;
    ran.current = true;

    void (async () => {
      let storedRef: string | null = null;
      let storedPlan: string | null = null;
      try {
        storedRef = sessionStorage.getItem(REF_KEY);
        storedPlan = sessionStorage.getItem(PLAN_KEY);
      } catch {
        /* ignore */
      }

      if (storedRef) {
        try {
          const res = await fetch('/api/referrals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: storedRef }),
          });
          if (res.ok || res.status === 400) {
            sessionStorage.removeItem(REF_KEY);
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || 'Referral apply failed');
          }
        } catch {
          setError('Could not apply referral code. Retry from Settings.');
        }
      }

      // Soft ?role= preference is stored only — account type is chosen at /onboarding.

      if (storedPlan && (PLANS as readonly string[]).includes(storedPlan as (typeof PLANS)[number])) {
        try {
          sessionStorage.removeItem(PLAN_KEY);
          if (storedPlan !== 'STARTER' && storedPlan !== 'FREE') {
            const res = await fetch('/api/billing/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tier: storedPlan }),
            });
            const data = await res.json();
            if (data.url) {
              window.location.href = data.url;
              return;
            }
            if (!res.ok) {
              setError(data.error || `Checkout for ${storedPlan} failed`);
            }
          }
        } catch {
          setError('Could not start checkout. Open Billing to subscribe.');
        }
      }

      try {
        sessionStorage.removeItem(SIGNUP_HOME_KEY);
      } catch {
        /* ignore */
      }

      if (searchParams.get('ref') || searchParams.get('plan') || searchParams.get('role')) {
        router.replace(pathname);
      }
    })();
  }, [pathname, router, searchParams]);

  if (!error) return null;
  return (
    <div
      role="alert"
      style={{
        padding: '0.65rem 1.25rem',
        background: 'color-mix(in srgb, var(--bad) 14%, transparent)',
        borderBottom: '1px solid var(--line)',
        color: 'var(--ink)',
        fontSize: '0.9rem',
      }}
    >
      {error}{' '}
      <button
        type="button"
        onClick={() => setError(null)}
        style={{
          marginLeft: 8,
          textDecoration: 'underline',
          background: 'none',
          border: 0,
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
