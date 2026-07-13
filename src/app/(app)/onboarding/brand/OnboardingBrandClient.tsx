'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';
import { CAMPAIGN_TIERS } from '@/lib/campaign-tiers';

type MePrefill = {
  displayName?: string | null;
  roleMode?: {
    modes?: { BRAND?: { onboarded?: boolean } };
  };
};

export default function OnboardingBrandClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'accept' | 'setup'>('accept');
  const [accepted, setAccepted] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [pricingTier, setPricingTier] = useState('TIER2');
  const [fundWallet, setFundWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (searchParams.get('wallet') === 'cancel') {
      setMsg('Wallet checkout canceled — you can fund later from your brand page.');
      setStep('setup');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MePrefill | null) => {
        if (!d) return;
        if (d.roleMode?.modes?.BRAND?.onboarded) {
          router.replace('/brands');
          return;
        }
        if (d.displayName) {
          setBrandName((n) => n || `${d.displayName}'s brand`);
        }
      })
      .catch(() => {});
  }, [router]);

  async function submit() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/onboarding/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accept: true,
          brandName,
          logoUrl: logoUrl.trim() || null,
          description,
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
      router.replace(data.redirectTo || '/brands');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not finish onboarding');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-page app-page--narrow">
      <PageHeader
        eyebrow="Mode"
        title="Add Brand to your account"
        description="Post campaigns, load leads, and pay SDRs for verified meetings."
      />

      {step === 'accept' && (
        <Panel title="Accept Brand role" description="Same login — separate desk and nav.">
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
              I want to add the Brand / Founder role to my account. Live campaigns need a funded
              escrow wallet (~20% platform fee on payouts).
            </span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={!accepted}
              onClick={() => setStep('setup')}
            >
              Continue
            </button>
            <Link href="/dashboard" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </Panel>
      )}

      {step === 'setup' && (
        <Panel
          title="Brand setup"
          description="Creates your brand, a draft campaign, and a starter playbook."
        >
          <div className="stack" style={{ gap: '0.75rem' }}>
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
              Logo URL
              <input
                className="field"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://… or /brands/logo.svg"
                style={{ marginTop: '0.35rem' }}
              />
            </label>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                width={48}
                height={48}
                style={{
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--bg-elevated)',
                }}
              />
            ) : null}
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
                disabled={busy || !brandName.trim()}
                onClick={submit}
              >
                {busy ? 'Creating…' : fundWallet ? 'Create & fund wallet' : 'Unlock Brand mode'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStep('accept')}>
                Back
              </button>
            </div>
          </div>
        </Panel>
      )}

      {msg && <p className={msg.includes('canceled') ? 'msg-ok' : 'msg-err'}>{msg}</p>}
    </main>
  );
}
