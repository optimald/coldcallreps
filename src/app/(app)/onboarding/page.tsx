'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/BrandMark';
import {
  SIGNUP_HOME_KEY,
  SIGNUP_PATHS,
  SIGNUP_ROLE_KEY,
  type SignupPath,
} from '@/lib/signup-paths';
import { onboardingPathFor, type SwitchableMode } from '@/lib/role-mode';

/**
 * Post-signup account type chooser — SDR vs Brand.
 * Deep-linked ?role= preferences skip this via GrowthBootstrap.
 */
export default function OnboardingChoosePage() {
  const router = useRouter();
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
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  async function choose(path: SignupPath) {
    setBusy(path.id);
    setMsg('');
    try {
      sessionStorage.setItem(SIGNUP_ROLE_KEY, path.role);
      sessionStorage.setItem(SIGNUP_HOME_KEY, path.home);
    } catch {
      /* ignore */
    }

    const mode = path.role as SwitchableMode;
    window.location.href = onboardingPathFor(mode);
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
            Pick your account type — you can unlock the other desk later in Settings.
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
