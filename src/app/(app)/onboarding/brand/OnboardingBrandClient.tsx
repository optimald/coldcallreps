'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import { fileToLogoDataUrl } from '@/lib/brand-logo-upload';

type MePrefill = {
  displayName?: string | null;
  roleMode?: {
    modes?: {
      REP?: { onboarded?: boolean };
      BRAND?: { onboarded?: boolean };
    };
  };
};

export default function OnboardingBrandClient() {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<'auto' | 'upload' | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Switch-to-Brand from an existing desk → Back goes home. First-time chooser → Back to /onboarding.
  const [backHref, setBackHref] = useState('/onboarding');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MePrefill | null) => {
        if (!d) return;
        if (d.roleMode?.modes?.BRAND?.onboarded) {
          window.location.replace('/dashboard');
          return;
        }
        const alreadyHasDesk = Boolean(d.roleMode?.modes?.REP?.onboarded);
        setBackHref(alreadyHasDesk ? '/dashboard' : '/onboarding');
        if (d.displayName) {
          setBrandName((n) => n || `${d.displayName}'s brand`);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const trimmed = websiteUrl.trim();
    if (!trimmed || trimmed.length < 4) {
      if (logoSource !== 'upload') {
        setLogoUrl(null);
        setLogoSource(null);
        setLogoBroken(false);
      }
      return;
    }
    if (logoSource === 'upload') return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLogoBusy(true);
      fetch('/api/brands/logo-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: trimmed }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.logoUrl) return;
          setLogoUrl(d.logoUrl);
          setLogoSource('auto');
          setLogoBroken(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        })
        .finally(() => setLogoBusy(false));
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [websiteUrl, logoSource === 'upload']);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setMsg('');
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setLogoUrl(dataUrl);
      setLogoSource('upload');
      setLogoBroken(false);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not read image');
    }
  }

  async function submit() {
    if (!brandName.trim()) {
      setMsg('Add a brand name first.');
      return;
    }
    if (!websiteUrl.trim()) {
      setMsg('Add your company website URL so we can pull the logo.');
      return;
    }
    if (!description.trim()) {
      setMsg('Add a short description of what you sell.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/onboarding/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accept: true,
          brandName,
          websiteUrl: websiteUrl.trim(),
          description: description.trim(),
          logoUrl: logoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not create brand');
        return;
      }
      window.location.href = data.redirectTo || '/dashboard';
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not create brand');
    } finally {
      setBusy(false);
    }
  }

  const showPreview = Boolean(logoUrl) && !logoBroken;

  return (
    <main className="auth-shell">
      <div className="onboarding-brand">
        <div className="onboarding-brand__brand">
          <BrandMark href="/" size="md" />
        </div>
        <header className="onboarding-brand__head">
          <h1 className="onboarding-brand__title">Create your brand</h1>
          <p className="onboarding-brand__sub">
            Name, website, and a short description — logo auto-fills from your site.
          </p>
        </header>

        <div className="onboarding-brand__card">
          <div className="stack" style={{ gap: '0.75rem' }}>
            <div className="brand-create-row">
              <div className="brand-create-fields">
                <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
                  Brand name
                  <input
                    className="field"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Acme Outreach"
                    required
                    style={{ marginTop: '0.35rem' }}
                  />
                </label>
                <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
                  Website URL
                  <input
                    className="field"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://acme.com"
                    inputMode="url"
                    required
                    style={{ marginTop: '0.35rem' }}
                  />
                </label>
              </div>

              <div className="brand-create-logo">
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Logo
                </span>
                <input
                  ref={fileRef}
                  id={fileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor={fileInputId}
                  className={`brand-logo-field${showPreview ? ' is-filled' : ''}${logoBusy ? ' is-loading' : ''}`}
                  title="Upload logo or wait for auto-fill from URL"
                >
                  {showPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl!}
                      alt=""
                      className="brand-logo-field__img"
                      onError={() => setLogoBroken(true)}
                    />
                  ) : (
                    <span className="brand-logo-field__placeholder">
                      {logoBusy ? '…' : '+'}
                    </span>
                  )}
                </label>
                <div className="brand-logo-field__meta">
                  {logoSource === 'auto' ? (
                    <button
                      type="button"
                      className="soft-link"
                      style={{
                        fontSize: '0.75rem',
                        background: 'none',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => fileRef.current?.click()}
                    >
                      Replace
                    </button>
                  ) : logoSource === 'upload' ? (
                    <button
                      type="button"
                      className="soft-link"
                      style={{
                        fontSize: '0.75rem',
                        background: 'none',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setLogoSource(null);
                        setLogoUrl(null);
                        setLogoBroken(false);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      Use URL logo
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: '0.72rem' }}>
                      From URL
                    </span>
                  )}
                </div>
              </div>
            </div>

            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Short description
              <textarea
                className="field"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you sell and who you dial"
                required
                style={{ marginTop: '0.35rem' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              <button
                type="button"
                className="btn"
                disabled={busy || !brandName.trim() || !websiteUrl.trim() || !description.trim()}
                onClick={submit}
              >
                {busy ? 'Creating…' : 'Create brand'}
              </button>
            <Link href={backHref} className="btn-ghost">
              Back
            </Link>
            </div>
          </div>
        </div>

        {msg ? <p className="msg-err" style={{ textAlign: 'center' }}>{msg}</p> : null}
      </div>
    </main>
  );
}
