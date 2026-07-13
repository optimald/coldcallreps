'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';

type MePrefill = {
  displayName?: string | null;
  avatarUrl?: string | null;
  hiringHeadline?: string | null;
  hiringBio?: string | null;
  roleMode?: {
    modes?: { REP?: { onboarded?: boolean } };
  };
};

export default function OnboardingRepPage() {
  const router = useRouter();
  const [step, setStep] = useState<'accept' | 'profile'>('accept');
  const [accepted, setAccepted] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [experience, setExperience] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MePrefill | null) => {
        if (!d) return;
        if (d.roleMode?.modes?.REP?.onboarded) {
          router.replace('/dashboard');
          return;
        }
        setDisplayName(d.displayName || '');
        setAvatarUrl(d.avatarUrl || '');
        setHeadline(d.hiringHeadline || '');
        setExperience(d.hiringBio || '');
      })
      .catch(() => {});
  }, [router]);

  async function submit() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/onboarding/rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accept: true,
          displayName,
          avatarUrl: avatarUrl.trim() || null,
          headline,
          experience,
          openToWork: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not finish SDR onboarding');
        return;
      }
      setMsg('SDR mode unlocked. Connect Stripe when you are ready for payouts.');
      router.replace(data.redirectTo || '/dashboard');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not finish onboarding');
    } finally {
      setBusy(false);
    }
  }

  async function startConnect() {
    setConnectBusy(true);
    try {
      const res = await fetch('/api/billing/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'onboard',
          returnPath: '/onboarding/rep?connect=return',
          refreshPath: '/onboarding/rep?connect=refresh',
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || 'Could not open Stripe Connect');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not open Stripe Connect');
    } finally {
      setConnectBusy(false);
    }
  }

  return (
    <main className="app-page app-page--narrow">
      <PageHeader
        eyebrow="Mode"
        title="Add SDR to your account"
        description="Train with AI, prove skill on the board, then take paid outbound campaigns."
      />

      {step === 'accept' && (
        <Panel title="Accept SDR role" description="This unlocks the rep desk on the same login.">
          <label
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: '0.95rem', color: 'var(--ink)', lineHeight: 1.45 }}>
              I want to add the SDR (Sales Development Rep) role to my ColdCallReps account and
              understand campaign payouts require Stripe Connect.
            </span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={!accepted}
              onClick={() => setStep('profile')}
            >
              Continue
            </button>
            <Link href="/dashboard" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </Panel>
      )}

      {step === 'profile' && (
        <Panel
          title="SDR profile"
          description="Prefill from your account — edit what brands will see on hiring."
        >
          <div className="stack" style={{ gap: '0.75rem' }}>
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Display name
              <input
                className="field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                style={{ marginTop: '0.35rem' }}
              />
            </label>
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Profile image URL
              <input
                className="field"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                style={{ marginTop: '0.35rem' }}
              />
            </label>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                width={56}
                height={56}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--line)',
                }}
              />
            ) : null}
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Headline
              <input
                className="field"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Outbound SDR · SaaS / local services"
                style={{ marginTop: '0.35rem' }}
              />
            </label>
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Resume / experience
              <textarea
                className="field"
                rows={4}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Years dialing, verticals, tools…"
                style={{ marginTop: '0.35rem' }}
              />
            </label>

            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)',
                background: 'var(--bg-soft)',
              }}
            >
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--ink)' }}>
                Payouts (optional now)
              </p>
              <p className="muted" style={{ margin: '0 0 0.65rem', fontSize: '0.85rem' }}>
                Practice stays open without Connect. Finish Stripe Connect before brands can pay you.
              </p>
              <button
                type="button"
                className="btn-ghost"
                disabled={connectBusy}
                onClick={startConnect}
              >
                {connectBusy ? 'Opening…' : 'Start Stripe Connect'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                disabled={busy || !displayName.trim()}
                onClick={submit}
              >
                {busy ? 'Saving…' : 'Unlock SDR mode'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStep('accept')}>
                Back
              </button>
            </div>
          </div>
        </Panel>
      )}

      {msg && <p className="msg-err">{msg}</p>}
    </main>
  );
}
