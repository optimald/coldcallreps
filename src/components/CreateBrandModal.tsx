'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { writeBrandDeskMode, type BrandRef } from '@/lib/brand-context';
import { fileToLogoDataUrl } from '@/lib/brand-logo-upload';

export default function CreateBrandModal({
  open,
  onClose,
  onCreated,
  redirectTo,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with brand slug/id and ref after create. */
  onCreated?: (key: string, brand?: BrandRef) => void;
  /** Where to send the browser after create. Defaults to brand settings. */
  redirectTo?: string;
}) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<'auto' | 'upload' | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setWebsiteUrl('');
    setDescription('');
    setLogoUrl(null);
    setLogoSource(null);
    setLogoBroken(false);
    setMsg('');
    if (fileRef.current) fileRef.current.value = '';
  }

  useEffect(() => {
    if (!open) return;
    const trimmed = websiteUrl.trim();
    if (!trimmed || trimmed.length < 4) {
      if (logoSource !== 'upload') {
        setLogoUrl(null);
        setLogoSource(null);
        setLogoBroken(false);
      }
      return;
    }

    // Don't overwrite a manual upload while the user is typing the URL.
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
  }, [websiteUrl, open, logoSource === 'upload']);

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

  async function create() {
    if (!name.trim()) {
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
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim(),
          description: description.trim(),
          logoUrl: logoUrl || undefined,
          pack: {
            name: 'Default pack',
            icp: { segment: 'local SMB' },
            scripts: ['Open with a specific observation'],
            objections: ['We already have a site'],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not create brand');
        return;
      }
      const brand = data.brand as
        | { id?: string; slug?: string; name?: string; logoUrl?: string | null }
        | undefined;
      const key = brand?.slug || brand?.id;
      reset();
      onClose();
      if (key) {
        // New brands are Live — Demo mode only lists sample brands.
        writeBrandDeskMode('live');
        const ref: BrandRef | undefined = brand?.id
          ? {
              id: brand.id,
              slug: brand.slug || brand.id,
              name: brand.name || key,
              logoUrl: brand.logoUrl ?? null,
            }
          : undefined;
        onCreated?.(key, ref);
        window.location.href = redirectTo || `/brands/${key}`;
      } else {
        onCreated?.('');
      }
    } finally {
      setBusy(false);
    }
  }

  const showPreview = Boolean(logoUrl) && !logoBroken;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create brand"
      description="Logo fills from your website URL — click the square to upload your own."
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <div className="brand-create-row">
          <div className="brand-create-fields">
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Brand name
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void create()}
                placeholder="Acme Outreach"
                autoFocus
                style={{ marginTop: '0.35rem' }}
              />
            </label>
            <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
              Website URL
              <input
                className="field"
                value={websiteUrl}
                onChange={(e) => {
                  setWebsiteUrl(e.target.value);
                  if (logoSource !== 'upload') setLogoSource(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && void create()}
                placeholder="https://acme.com"
                inputMode="url"
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
                  style={{ fontSize: '0.75rem', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}
                >
                  Replace
                </button>
              ) : logoSource === 'upload' ? (
                <button
                  type="button"
                  className="soft-link"
                  style={{ fontSize: '0.75rem', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
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
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you sell and who you dial"
            style={{ marginTop: '0.35rem' }}
          />
        </label>
        {msg ? (
          <p className="msg-err" style={{ margin: 0 }}>
            {msg}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creating…' : 'Create brand'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
