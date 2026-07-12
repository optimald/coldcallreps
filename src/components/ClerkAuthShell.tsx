'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Wraps Clerk SignIn/SignUp and surfaces recovery help if the Frontend API
 * host fails to load (often stale NXDOMAIN cache after DNS was just added).
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
    <main className={`auth-shell${wide ? ' auth-shell--wide' : ''}`}>
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
    </main>
  );
}
