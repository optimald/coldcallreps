'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignUp } from '@clerk/nextjs';
import ClerkAuthShell from '@/components/ClerkAuthShell';
import BrandMark from '@/components/BrandMark';
import {
  SIGNUP_HOME_KEY,
  SIGNUP_PATHS,
  SIGNUP_ROLE_KEY,
  pathForRole,
  type SignupPath,
  type SignupRole,
} from '@/lib/signup-paths';

const PLANS = ['STARTER', 'PRO', 'TEAM'] as const;

function readStoredRole(): SignupRole | null {
  try {
    const role = sessionStorage.getItem(SIGNUP_ROLE_KEY);
    return pathForRole(role)?.role || null;
  } catch {
    /* ignore */
  }
  return null;
}

export default function SignUpClient() {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<SignupPath | null>(null);
  const [ready, setReady] = useState(false);

  const queryRole = useMemo(() => {
    const raw = searchParams.get('role')?.toUpperCase();
    return pathForRole(raw) || null;
  }, [searchParams]);

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

    const fromQuery = queryRole;
    const fromStorage = fromQuery || pathForRole(readStoredRole());
    if (fromStorage) setSelected(fromStorage);
    setReady(true);
  }, [searchParams, queryRole]);

  function choosePath(path: SignupPath) {
    try {
      sessionStorage.setItem(SIGNUP_ROLE_KEY, path.role);
      sessionStorage.setItem(SIGNUP_HOME_KEY, path.home);
    } catch {
      /* ignore */
    }
    setSelected(path);
  }

  function changePath() {
    try {
      sessionStorage.removeItem(SIGNUP_ROLE_KEY);
      sessionStorage.removeItem(SIGNUP_HOME_KEY);
    } catch {
      /* ignore */
    }
    setSelected(null);
  }

  if (!ready) {
    return (
      <ClerkAuthShell mode="sign-up" wide>
        <p className="muted" style={{ textAlign: 'center' }}>
          Loading…
        </p>
      </ClerkAuthShell>
    );
  }

  if (!selected) {
    return (
      <ClerkAuthShell mode="sign-up" wide>
        <div className="signup-chooser">
          <div className="signup-chooser__brand">
            <BrandMark href="/" size="md" />
          </div>
          <header className="signup-chooser__head">
            <h1 className="signup-chooser__title">How will you use ColdCallReps?</h1>
            <p className="signup-chooser__sub">Pick a path — you can change roles later in Settings.</p>
          </header>
          <div className="signup-chooser__grid">
            {SIGNUP_PATHS.map((path) => (
              <button
                key={path.id}
                type="button"
                className="signup-path-card"
                onClick={() => choosePath(path)}
              >
                <span className="signup-path-card__title">{path.title}</span>
                {path.sublabel ? (
                  <span className="signup-path-card__sublabel">{path.sublabel}</span>
                ) : null}
                <span className="signup-path-card__tagline">{path.tagline}</span>
                <span className="signup-path-card__blurb">{path.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </ClerkAuthShell>
    );
  }

  return (
    <ClerkAuthShell mode="sign-up">
      <div className="signup-form-wrap">
        <div className="signup-form-wrap__path">
          <p className="signup-form-wrap__eyebrow">
            {selected.title}
            {selected.sublabel ? ` · ${selected.sublabel}` : ''}
          </p>
          <p className="signup-form-wrap__tagline">{selected.tagline}</p>
          <button type="button" className="signup-form-wrap__change" onClick={changePath}>
            Change path
          </button>
        </div>
        <SignUp />
      </div>
    </ClerkAuthShell>
  );
}
