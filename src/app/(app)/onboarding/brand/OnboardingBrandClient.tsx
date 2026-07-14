'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';
import { CAMPAIGN_TIERS } from '@/lib/campaign-tiers';
import { fileToLogoDataUrl } from '@/lib/brand-logo-upload';

type MePrefill = {
  displayName?: string | null;
  roleMode?: {
    modes?: { BRAND?: { onboarded?: boolean } };
  };
};

export default function OnboardingBrandClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<'auto' | 'upload' | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [pricingTier, setPricingTier] = useState('TIER2');
  const [fundWallet, setFundWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (searchParams.get('wallet') === 'cancel') {
      setMsg('Wallet checkout canceled — you can fund later from your brand page.');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MePrefill | null) => {
        if (!d) return;
        if (d.roleMode?.modes?.BRAND?.onboarded) {
          router.replace('/dashboard');
          return;
        }
        if (d.displayName) {
          setBrandName((n) => n || `${d.displayName}'s brand`);
        }
      })
      .catch(() => {});
  }, [router]);

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
          campaignTitle: campaignTitle.trim() || undefined,
          pricingTier,
          fundWalletCents: fundWallet ? 10000 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not finish Brand onboarding');
        return;
      }
      if (data.walletFundUrl) {
        window.location.href = data.walletFundUrl;
        return;
      }
      window.location.href = data.redirectTo || '/dashboard';
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not finish onboarding');
    } finally {
      setBusy(false);
    }
  }

  const showPreview = Boolean(logoUrl) && !logoBroken;

  return (
    <main className="app-page app-page--narrow">
      <PageHeader
        eyebrow="Brand"
        title="Create your brand"
        description="Logo auto-fills from your website. Creates a draft campaign and starter playbook."
      />

      <Panel
        title="Brand setup"
        description="Post campaigns, load leads, and pay SDRs for verified meetings."
      >
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you sell and who you dial"
              required
              style={{ marginTop: '0.35rem' }}
            />
          </label>
          <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
            Starter campaign title
            <input
              className="field"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              placeholder="Optional — defaults from brand name"
              style={{ marginTop: '0.35rem' }}
            />
          </label>
          <label className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
            Pricing tier
            <select
              className="field"
              value={pricingTier}
              onChange={(e) => setPricingTier(e.target.value)}
              style={{ marginTop: '0.35rem' }}
            >
              {CAMPAIGN_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.subtitle}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={fundWallet}
              onChange={(e) => setFundWallet(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.45 }}>
              Fund escrow wallet ($100) after setup — required before opening a live campaign.
              You can skip and fund later from Brands.
            </span>
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={busy || !brandName.trim() || !websiteUrl.trim() || !description.trim()}
              onClick={submit}
            >
              {busy ? 'Creating…' : fundWallet ? 'Create & fund wallet' : 'Create brand'}
            </button>
            <Link href="/onboarding" className="btn-ghost">
              Back
            </Link>
          </div>
        </div>
      </Panel>

      {msg && <p className={msg.includes('canceled') ? 'msg-ok' : 'msg-err'}>{msg}</p>}
    </main>
  );
}
