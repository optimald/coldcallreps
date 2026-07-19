'use client';

import { useCallback, useEffect, useState } from 'react';

type PoolNumber = {
  id: string;
  e164: string;
  areaCode: string;
  label: string | null;
  isActive: boolean;
  twilioSid: string | null;
};

export default function BrandPhonePoolPanel({ brandId }: { brandId: string }) {
  const [numbers, setNumbers] = useState<PoolNumber[]>([]);
  const [fallback, setFallback] = useState('');
  const [greeting, setGreeting] = useState('');
  const [attachE164, setAttachE164] = useState('');
  const [buyArea, setBuyArea] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [maxPool, setMaxPool] = useState(10);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [phMsg, setPhMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/phones`);
    if (!res.ok) return;
    const data = await res.json();
    setNumbers(data.numbers || []);
    setFallback(data.fallbackPhoneE164 || '');
    setGreeting(data.inboundGreeting || '');
    setMaxPool(data.maxPool || 10);
  }, [brandId]);

  const loadWallet = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/wallet`);
    if (!res.ok) return;
    const data = await res.json();
    setWalletLabel(data.balanceLabel || null);
  }, [brandId]);

  useEffect(() => {
    void load();
    void loadWallet();
  }, [load, loadWallet]);

  async function attach() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${brandId}/phones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e164: attachE164 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not attach');
        return;
      }
      setAttachE164('');
      setMsg('Number attached to pool. Inbound webhooks configured when SID is known.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function purchase() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${brandId}/phones/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaCode: buyArea }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Purchase failed');
        return;
      }
      setBuyArea('');
      setMsg(`Purchased ${data.number?.e164} for local presence.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveFallback() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${brandId}/phones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackPhoneE164: fallback.trim() || null,
          inboundGreeting: greeting.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not save');
        return;
      }
      setMsg('Fallback & greeting saved.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(numberId: string) {
    setBusy(true);
    try {
      await fetch(`/api/brands/${brandId}/phones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberId, isActive: false }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(numberId: string) {
    if (!confirm('Remove this number from the brand pool?')) return;
    setBusy(true);
    try {
      await fetch(`/api/brands/${brandId}/phones?numberId=${encodeURIComponent(numberId)}`, {
        method: 'DELETE',
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const activeCount = numbers.filter((n) => n.isActive).length;

  async function fundWallet() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${brandId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: 50000 }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMsg(data.error || 'Could not fund wallet');
    } finally {
      setBusy(false);
    }
  }

  async function importProductHunt() {
    setBusy(true);
    setPhMsg('');
    try {
      const res = await fetch('/api/product-hunt/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, limit: 25 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhMsg(data.error || 'Import failed');
        return;
      }
      setPhMsg(
        `Imported ${data.imported} launches · ${data.prospectsCreated} prospects. ${data.notice || ''}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <section className="brand-section" aria-labelledby="brand-escrow">
      <div className="brand-section__head">
        <div>
          <p className="brand-section__kicker">Escrow</p>
          <h2 id="brand-escrow" className="brand-section__title">
            Campaign wallet
          </h2>
          <p className="brand-section__lead">
            Prepaid balance locks when you open a campaign. Released to SDRs on AI-verified booked meetings.
          </p>
        </div>
      </div>
      <div className="brand-desk__actions" style={{ alignItems: 'center' }}>
        <strong style={{ fontSize: '1.25rem' }}>{walletLabel ?? '…'}</strong>
        <button type="button" className="btn" disabled={busy} onClick={() => void fundWallet()}>
          Fund $500
        </button>
      </div>
    </section>

    <section className="brand-section" aria-labelledby="brand-ph">
      <div className="brand-section__head">
        <div>
          <p className="brand-section__kicker">Distribution</p>
          <h2 id="brand-ph" className="brand-section__title">
            Product Hunt pipeline
          </h2>
          <p className="brand-section__lead">
            Import recent launches as brand prospects — capital-aware founders for outbound.
          </p>
        </div>
      </div>
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => void importProductHunt()}>
        Import Product Hunt launches
      </button>
      {phMsg ? <p className="muted" style={{ marginTop: '0.65rem' }}>{phMsg}</p> : null}
    </section>

    <section className="brand-section" aria-labelledby="brand-phones">
      <div className="brand-section__head">
        <div>
          <p className="brand-section__kicker">Outbound identity</p>
          <h2 id="brand-phones" className="brand-section__title">
            Phone pool
          </h2>
          <p className="brand-section__lead">
            Brand-owned local Twilio numbers (platform-masked). SDRs never dial from personal cells.
            Aim for 3–5 area codes matching your ICP. Max {maxPool} active.
          </p>
        </div>
      </div>

      {msg ? <p className="muted" style={{ marginBottom: '0.75rem' }}>{msg}</p> : null}

      {activeCount === 0 ? (
        <p className="muted" style={{ marginBottom: '0.85rem' }}>
          Pool empty — SDRs cannot place paid campaign dials until you add at least one number.
        </p>
      ) : null}

      <ul className="brand-list" style={{ marginBottom: '1rem' }}>
        {numbers.length === 0 ? (
          <li>
            <span className="muted">No numbers yet</span>
          </li>
        ) : (
          numbers.map((n) => (
            <li key={n.id}>
              <span>
                {n.e164}
                <span className="muted">
                  {' '}
                  · {n.areaCode}
                  {n.label ? ` · ${n.label}` : ''}
                  {!n.isActive ? ' · inactive' : ''}
                </span>
              </span>
              <span style={{ display: 'flex', gap: '0.5rem' }}>
                {n.isActive ? (
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => void deactivate(n.id)}>
                    Deactivate
                  </button>
                ) : null}
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void remove(n.id)}>
                  Remove
                </button>
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="brand-settings-grid">
        <label className="brand-field">
          <span>Attach existing Twilio DID (E.164)</span>
          <input
            className="field"
            value={attachE164}
            onChange={(e) => setAttachE164(e.target.value)}
            placeholder="+13125550100"
          />
        </label>
        <div className="brand-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="btn" disabled={busy || !attachE164.trim()} onClick={() => void attach()}>
            Attach to pool
          </button>
        </div>
        <label className="brand-field">
          <span>Buy local number (area code)</span>
          <input
            className="field"
            value={buyArea}
            onChange={(e) => setBuyArea(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="312"
            inputMode="numeric"
          />
        </label>
        <div className="brand-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || buyArea.length !== 3}
            onClick={() => void purchase()}
          >
            Purchase from Twilio
          </button>
        </div>
        <label className="brand-field">
          <span>Fallback line (founder / central)</span>
          <input
            className="field"
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            placeholder="+14155551212"
          />
        </label>
        <label className="brand-field brand-field--full">
          <span>Inbound greeting</span>
          <textarea
            className="field"
            rows={2}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Thanks for calling back Acme — connecting you now."
          />
        </label>
      </div>
      <div className="brand-desk__actions" style={{ marginTop: '0.85rem' }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void saveFallback()}>
          Save fallback & greeting
        </button>
      </div>
    </section>
    </>
  );
}
