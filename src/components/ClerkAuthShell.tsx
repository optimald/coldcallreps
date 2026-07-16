'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

const PANEL_COPY = {
  'sign-in': {
    eyebrow: 'Welcome back',
    headline: 'Put in the reps.',
    sub: 'Train on AI voice calls, prove your score, and get paid to run outbound for real brands.',
  },
  'sign-up': {
    eyebrow: 'Train · Prove · Get paid',
    headline: 'Start putting in the reps.',
    sub: 'Practice real cold calls with live AI voice coaching. Hit the score. Unlock paid campaigns.',
  },
} as const;

const PANEL_POINTS = [
  'Live AI voice practice on real brand offers',
  'Objective scorecards prove you’re ready',
  'Pay-per-result campaigns — earn when you deliver',
] as const;

/**
 * Wraps Clerk SignIn/SignUp in a branded split layout and surfaces recovery
 * help if the Frontend API host fails to load (often stale NXDOMAIN cache
 * after DNS was just added).
 */
export default function ClerkAuthShell({
  children,
  mode,
  wide = false,
}: {
  children: React.ReactNode;
  mode: 'sign-in' | 'sign-up';
  wide?: boolean;
}) {
  const copy = PANEL_COPY[mode];
  const [showHelp, setShowHelp] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    const clerkMounted = () =>
      Boolean(
        document.querySelector(
          '.cl-rootBox, .cl-signIn-root, .cl-signUp-root, [data-clerk-component]'
        )
      );

    const probe = () => {
      if (cancelled) return;
      fetch('https://clerk.coldcallreps.com/v1/environment', {
        mode: 'no-cors',
        cache: 'no-store',
      })
        .then(() => {
          if (!cancelled) setProbeFailed(false);
        })
        .catch(() => {
          if (!cancelled) setProbeFailed(true);
        });
    };

    const check = () => {
      if (cancelled) return;
      if (clerkMounted()) {
        setShowHelp(false);
        setProbeFailed(false);
        return;
      }
      // Chooser has no Clerk mount — don't show DNS help until form stage
      if (document.querySelector('.signup-chooser')) return;
      if (Date.now() - started > 4000) {
        setShowHelp(true);
      }
    };

    probe();
    const probeId = window.setInterval(probe, 4000);
    const checkId = window.setInterval(check, 500);
    const timeout = window.setTimeout(check, 4200);

    return () => {
      cancelled = true;
      clearInterval(probeId);
      clearInterval(checkId);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <main className={`auth-shell auth-shell--split${wide ? ' auth-shell--wide' : ''}`}>
      <aside className="auth-brand-panel" aria-hidden={false}>
        <div className="auth-brand-panel__media" aria-hidden>
          <video
            className="auth-brand-panel__video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src="/media/hero.mp4" type="video/mp4" />
          </video>
          <div className="auth-brand-panel__scrim" />
        </div>
        <div className="auth-brand-panel__content">
          <BrandMark href="/" />
          <div className="auth-brand-panel__copy">
            <p className="auth-brand-panel__eyebrow">{copy.eyebrow}</p>
            <h1 className="auth-brand-panel__headline">{copy.headline}</h1>
            <p className="auth-brand-panel__sub">{copy.sub}</p>
            <ul className="auth-brand-panel__points">
              {PANEL_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <p className="auth-brand-panel__foot">Cold calling reps who put in the reps.</p>
        </div>
      </aside>

      <div className="auth-form-col">
        {children}
        {showHelp && (
        <div className="auth-shell__help" role="alert">
          <p className="auth-shell__help-title">
            {probeFailed ? 'Auth can’t reach Clerk yet' : 'Auth is taking longer than usual'}
          </p>
          <p className="auth-shell__help-body">
            {probeFailed ? (
              <>
                Your browser can’t resolve <code>clerk.coldcallreps.com</code> yet. The Cloudflare
                CNAME is already live on public DNS — this is usually a <strong>stale NXDOMAIN
                cache</strong> on your router or ISP (often up to ~30 minutes).
              </>
            ) : (
              <>
                Clerk’s UI hasn’t mounted. DNS may be fine; try a hard refresh. If it keeps failing,
                confirm certificates are deployed in the Clerk Dashboard.
              </>
            )}
          </p>
          <ol className="auth-shell__help-list">
            <li>Hard refresh this page (or open an Incognito window).</li>
            <li>
              Flush local DNS, or temporarily set DNS to <code>1.1.1.1</code> / <code>8.8.8.8</code>.
            </li>
            <li>Reboot the router if it still fails after a few minutes.</li>
            <li>
              Clerk Dashboard → Domains → confirm certificates for <code>coldcallreps.com</code> are
              deployed.
            </li>
          </ol>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            <Link href="/" className="soft-link">
              ← Back home
            </Link>
            {' · '}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noreferrer"
              className="soft-link"
            >
              Clerk Dashboard
            </a>
            {mode === 'sign-up' ? ' · trying sign-up' : ' · trying sign-in'}
          </p>
        </div>
        )}
      </div>
    </main>
  );
}
