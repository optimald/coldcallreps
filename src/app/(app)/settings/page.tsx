'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { PLAN, REFERRAL_BONUS_MINUTES, REFERRAL_REWARD_LABEL } from '@/lib/product';
import { PageHeader, Panel, SoftLink } from '@/components/ui/PagePrimitives';
import { repPublicPath } from '@/lib/public-urls';

type ReferralState = {
  code?: string;
  link?: string;
  bonusMinutes?: number;
  rewardLabel?: string;
  rewardedCount?: number;
  referredByCode?: string | null;
};

export default function SettingsPage() {
  const { signOut } = useClerk();
  const [referral, setReferral] = useState<ReferralState>({});
  const [me, setMe] = useState<{
    plan?: string;
    minutesRemaining?: number;
    hasSubscription?: boolean;
    platformRole?: string;
    bountyCredits?: number;
    profileSlug?: string | null;
    referredByCode?: string | null;
  }>({ plan: 'FREE' });
  const [applyCode, setApplyCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'ok' | 'err'>('ok');
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [applying, setApplying] = useState(false);

  const role = me.platformRole || 'REP';
  const isBrand = role === 'BRAND' || role === 'RECRUITER';
  const isRepFacing = role === 'REP' || role === 'MANAGER' || role === 'SUPERADMIN';
  const bonusMinutes = referral.bonusMinutes ?? REFERRAL_BONUS_MINUTES;
  const rewardLabel = referral.rewardLabel ?? REFERRAL_REWARD_LABEL;
  const alreadyReferred = Boolean(me.referredByCode || referral.referredByCode);

  useEffect(() => {
    fetch('/api/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load profile.');
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setMe(d);
        const r = d.platformRole || 'REP';
        if (r === 'BRAND' || r === 'RECRUITER') return;
        return fetch('/api/referrals')
          .then(async (res) => {
            if (!res.ok) throw new Error('Could not load referrals.');
            return res.json();
          })
          .then(setReferral);
      })
      .catch((e) => setLoadError(e.message || 'Could not load settings.'));
  }, []);

  function flash(text: string, tone: 'ok' | 'err' = 'ok') {
    setMsg(text);
    setMsgTone(tone);
  }

  async function copyText(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      flash('Could not copy — select the text manually.', 'err');
    }
  }

  async function switchRole(platformRole: string) {
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeRole: platformRole, platformRole }),
    });
    const data = await res.json();
    if (res.status === 409 && data.onboardingPath) {
      window.location.href = data.onboardingPath;
      return;
    }
    if (res.ok) {
      setMe((m) => ({ ...m, platformRole: data.platformRole }));
      window.location.href =
        data.redirectTo || (platformRole === 'BRAND' ? '/brands' : '/dashboard');
      return;
    }
    if (res.status === 402 && data.requiredPlan) {
      flash(data.error || 'Plan required', 'err');
      const checkout = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: data.requiredPlan }),
      });
      const c = await checkout.json();
      if (c.url) window.location.href = c.url;
      return;
    }
    flash(data.error || data.notice || 'Could not switch role', 'err');
  }

  async function exportData() {
    const res = await fetch('/api/account/export');
    const data = await res.json();
    if (!res.ok) {
      flash(data.error || 'Export failed', 'err');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coldcallreps-export.json';
    a.click();
    URL.revokeObjectURL(url);
    flash('Export downloaded.');
  }

  async function deleteAccount() {
    if (!confirm('Clear your account data? This cannot be undone.')) return;
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash(data.error || 'Delete failed', 'err');
      return;
    }
    flash(data.notice || 'Account data cleared.');
    await signOut({ redirectUrl: '/' });
  }

  async function applyReferral() {
    if (!applyCode.trim()) {
      flash('Enter a referral code first.', 'err');
      return;
    }
    setApplying(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: applyCode }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(data.message || `Applied — ${rewardLabel}`);
        setMe((m) => ({
          ...m,
          referredByCode: applyCode.trim().toUpperCase(),
          minutesRemaining:
            typeof m.minutesRemaining === 'number' && data.bonusMinutes
              ? m.minutesRemaining + data.bonusMinutes
              : m.minutesRemaining,
        }));
        setReferral((r) => ({
          ...r,
          referredByCode: applyCode.trim().toUpperCase(),
        }));
        setApplyCode('');
      } else {
        flash(data.error || 'Could not apply code', 'err');
      }
    } finally {
      setApplying(false);
    }
  }

  async function checkout(tier: 'STARTER') {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else flash(data.error || 'Checkout failed', 'err');
  }

  async function openPortal() {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else flash(data.error || 'Portal unavailable', 'err');
  }

  return (
    <main className="app-page app-page--narrow">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description={
          isBrand
            ? 'Billing, desk mode, and privacy.'
            : 'Billing, role, referrals, digest, and privacy.'
        }
      />
      {loadError && <p className="msg-err">{loadError}</p>}

      <Panel
        title="Billing"
        description={
          isBrand
            ? 'Campaign escrow and invoices live on Billing. Desk mode and privacy below.'
            : 'Manage plan and practice minutes.'
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {me.plan ? (
            <>
              Plan <strong style={{ color: 'var(--ink)' }}>{me.plan}</strong>
              {me.minutesRemaining != null && <> · {me.minutesRemaining} min left</>}
            </>
          ) : (
            <>
              Free to start · Starter ${PLAN.STARTER.price}/mo
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isRepFacing && (
            <button type="button" onClick={() => checkout('STARTER')} className="btn-ghost">
              Get Starter
            </button>
          )}
          {me.hasSubscription && (
            <button type="button" onClick={openPortal} className="btn-ghost">
              Manage subscription
            </button>
          )}
          <Link href="/billing" className="btn-ghost">
            Compare plans
          </Link>
        </div>
      </Panel>

      {isRepFacing && (
        <Panel title="Public profile" description="Resume, handle, and open-to-work status.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <SoftLink href="/hiring">Edit resume →</SoftLink>
            {me.profileSlug ? (
              <SoftLink href={repPublicPath(me.profileSlug)}>
                View live page → /{me.profileSlug}
              </SoftLink>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Claim a handle on your resume to get a public URL.
              </p>
            )}
          </div>
        </Panel>
      )}

      <Panel
        title="Role"
        description="Switch desks from the sidebar, or here. First-time Brand or SDR unlocks run a short onboarding."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Current: <strong style={{ color: 'var(--ink)' }}>{role}</strong> · plan{' '}
          <strong style={{ color: 'var(--ink)' }}>{me.plan || 'FREE'}</strong>
          {typeof me.bountyCredits === 'number' && me.bountyCredits > 0 && (
            <> · {me.bountyCredits}¢ bounty credits</>
          )}
        </p>
        {role === 'RECRUITER' && (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Recruiter desk was demoted — switch to Brand to manage campaigns and leads.
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(
            [
              { r: 'REP', label: 'SDR' },
              { r: 'BRAND', label: 'Brand / Founder' },
            ] as const
          ).map(({ r, label }) => (
            <button
              key={r}
              type="button"
              onClick={() => switchRole(r)}
              className="btn-ghost"
              style={{
                borderColor: role === r ? 'var(--accent)' : undefined,
                opacity: role === r ? 1 : 0.8,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {!isBrand ? (
      <Panel
        title="Referrals"
        description={`Share your link — you and your friend each get ${rewardLabel}.`}
      >
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Reward is practice minutes equal to one month of Starter ({bonusMinutes} min) — credited
          instantly to both accounts when they sign up with your code. Not a Stripe coupon.
        </p>

        {referral.code && (
          <div
            style={{
              display: 'grid',
              gap: '0.65rem',
              marginTop: '0.35rem',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(var(--accent-rgb), 0.28)',
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent-2) 8%, transparent))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p
                  className="muted"
                  style={{ margin: 0, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  Your code
                </p>
                <p
                  style={{
                    margin: '0.15rem 0 0',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--ink)',
                  }}
                >
                  {referral.code}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => referral.code && copyText(referral.code, 'code')}
              >
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
            </div>
            {referral.link && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <code
                  style={{
                    flex: '1 1 12rem',
                    minWidth: 0,
                    fontSize: '0.8rem',
                    wordBreak: 'break-all',
                    color: 'var(--muted)',
                    background: 'transparent',
                  }}
                >
                  {referral.link}
                </code>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => referral.link && copyText(referral.link, 'link')}
                >
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
            {typeof referral.rewardedCount === 'number' && referral.rewardedCount > 0 && (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {referral.rewardedCount} successful referral
                {referral.rewardedCount === 1 ? '' : 's'} · +
                {referral.rewardedCount * bonusMinutes} min earned
              </p>
            )}
          </div>
        )}

        {!alreadyReferred ? (
          <div className="search-row" style={{ marginBottom: 0, marginTop: '0.9rem' }}>
            <input
              className="field"
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value)}
              placeholder="Friend’s code"
              aria-label="Referral code"
            />
            <button
              type="button"
              onClick={applyReferral}
              className="btn-ghost"
              disabled={applying}
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: '0.85rem 0 0', fontSize: '0.9rem' }}>
            Referral applied ({me.referredByCode || referral.referredByCode}).
          </p>
        )}
      </Panel>
      ) : null}

      {isRepFacing && (
        <Panel
          title="Weekly Top Reps digest"
          description="Email digest of the weekly board (Mondays via Resend cron)."
        >
          <SoftLink href="/settings/digest">Digest preferences →</SoftLink>
        </Panel>
      )}

      <Panel title="More">
        <div className="stack" style={{ gap: '0.45rem' }}>
          {isRepFacing && (
            <>
              <SoftLink href="/academy">Org academy →</SoftLink>
              <SoftLink href="/playbooks">Playbooks →</SoftLink>
            </>
          )}
          {isBrand && <SoftLink href="/leads">Leads →</SoftLink>}
          {isBrand && <SoftLink href="/brands">Brands →</SoftLink>}
          <SoftLink href="/developers">Developer API →</SoftLink>
          {role === 'SUPERADMIN' && <SoftLink href="/admin">Superadmin console →</SoftLink>}
        </div>
      </Panel>

      <Panel title="Privacy">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={exportData} className="btn-ghost">
            Export my data
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            className="btn-ghost"
            style={{ color: 'var(--bad)' }}
          >
            Delete account data
          </button>
        </div>
      </Panel>

      {msg && <p className={msgTone === 'err' ? 'msg-err' : 'msg-ok'}>{msg}</p>}
    </main>
  );
}
