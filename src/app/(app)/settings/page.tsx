'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN } from '@/lib/product';

export default function SettingsPage() {
  const [referral, setReferral] = useState<{ code?: string; link?: string; bonusMinutes?: number }>({});
  const [applyCode, setApplyCode] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/referrals')
      .then((r) => r.json())
      .then(setReferral)
      .catch(() => {});
  }, []);

  async function applyReferral() {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: applyCode }),
    });
    const data = await res.json();
    setMsg(res.ok ? data.message : data.error);
  }

  async function checkout(tier: 'STARTER' | 'PRO') {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMsg(data.error || 'Checkout failed');
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Settings</h1>

      <section style={{ margin: '1.5rem 0', padding: '1.15rem', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Billing</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
          Starter ${PLAN.STARTER.price}/mo · Pro ${PLAN.PRO.price}/mo
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => checkout('STARTER')} style={btnStyle}>
            Get Starter
          </button>
          <button type="button" onClick={() => checkout('PRO')} style={{ ...btnStyle, background: 'var(--accent)' }}>
            Get Pro
          </button>
          <Link href="/pricing" style={{ ...btnStyle, display: 'inline-block', textDecoration: 'none' }}>
            Compare
          </Link>
        </div>
      </section>

      <section style={{ margin: '1.5rem 0', padding: '1.15rem', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--line)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Referrals</h2>
        <p style={{ color: 'var(--muted)' }}>
          Share your code — you and your friend each get {referral.bonusMinutes ?? 30} bonus minutes.
        </p>
        {referral.code && (
          <p>
            <strong>{referral.code}</strong>
            <br />
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', wordBreak: 'break-all' }}>{referral.link}</span>
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            value={applyCode}
            onChange={(e) => setApplyCode(e.target.value)}
            placeholder="Have a code?"
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--bg-soft)',
              color: 'var(--ink)',
            }}
          />
          <button type="button" onClick={applyReferral} style={btnStyle}>
            Apply
          </button>
        </div>
      </section>

      {msg && <p style={{ color: 'var(--accent-2)' }}>{msg}</p>}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '0.55rem 0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};
