'use client';

import { useEffect, useState } from 'react';
import BrandMark from '@/components/BrandMark';
import { SIGNUP_HOME_KEY, SIGNUP_PATHS, SIGNUP_ROLE_KEY, type SignupPath } from '@/lib/signup-paths';

/**
 * Post-signup account type chooser — SDR vs Brand.
 * SDR unlocks immediately; Brand continues to brand creation.
 */
export default function OnboardingChoosePage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.roleMode?.modes) return;
        const repDone = Boolean(d.roleMode.modes.REP?.onboarded);
        const brandDone = Boolean(d.roleMode.modes.BRAND?.onboarded);
        if (repDone || brandDone) {
          // Hard nav — soft replace from full-screen onboarding can leave the desk without chrome.
          window.location.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, []);

  async function choose(path: SignupPath) {
    setBusy(path.id);
    setMsg('');
    try {
      sessionStorage.setItem(SIGNUP_ROLE_KEY, path.role);
      sessionStorage.setItem(SIGNUP_HOME_KEY, path.home);
    } catch {
      /* ignore */
    }

    if (path.role === 'BRAND') {
      window.location.href = '/onboarding/brand';
      return;
    }

    try {
      const res = await fetch('/api/onboarding/rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not unlock SDR');
        setBusy(null);
        return;
      }
      window.location.href = data.redirectTo || '/dashboard';
    } catch {
      setMsg('Could not unlock SDR. Try again.');
      setBusy(null);
    }
  }

  return (
    <main className="auth-shell auth-shell--wide">
      <div className="signup-chooser">
        <div className="signup-chooser__brand">
          <BrandMark href="/" size="md" />
        </div>
        <header className="signup-chooser__head">
          <h1 className="signup-chooser__title">How will you use ColdCallReps?</h1>
          <p className="signup-chooser__sub">
            Pick your account type — you can unlock the other desk later from the sidebar.
          </p>
        </header>
        <div className="signup-chooser__grid">
          {SIGNUP_PATHS.map((path) => (
            <button
              key={path.id}
              type="button"
              className="signup-path-card"
              disabled={busy != null}
              onClick={() => choose(path)}
            >
              <span className="signup-path-card__title">{path.title}</span>
              {path.sublabel ? (
                <span className="signup-path-card__sublabel">{path.sublabel}</span>
              ) : null}
              <span className="signup-path-card__tagline">{path.tagline}</span>
              <span className="signup-path-card__blurb">{path.blurb}</span>
              {busy === path.id ? (
                <span className="signup-path-card__blurb">Continuing…</span>
              ) : null}
            </button>
          ))}
        </div>
        {msg ? (
          <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
            {msg}
          </p>
        ) : null}
      </div>
    </main>
  );
}
