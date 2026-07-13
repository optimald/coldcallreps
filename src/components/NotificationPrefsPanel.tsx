'use client';

import { useEffect, useMemo, useState } from 'react';
import { NOTIFICATION_CATALOG } from '@/lib/notifications/catalog';
import type { NotificationEventKey } from '@/lib/notifications/types';

const GROUPS: {
  id: string;
  title: string;
  description: string;
  audience: 'sdr' | 'brand' | 'both';
  events: NotificationEventKey[];
}[] = [
  {
    id: 'applications',
    title: 'Applications & recruiting',
    description: 'Applies, accept/reject, and talent shortlists.',
    audience: 'both',
    events: [
      'campaign.application.submitted',
      'campaign.application.accepted',
      'campaign.application.rejected',
      'talent.interested',
      'campaign.apply.blocked',
    ],
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    description: 'Open, pause, end, dial gates, and lead assignment.',
    audience: 'both',
    events: [
      'campaign.opened',
      'campaign.paused',
      'campaign.ended',
      'campaign.dial.blocked',
      'campaign.callback.locked',
      'lead.assigned',
    ],
  },
  {
    id: 'budget',
    title: 'Budget & wallet',
    description: 'Spend caps, escrow, and wallet funding.',
    audience: 'brand',
    events: [
      'campaign.budget.low',
      'campaign.budget.exhausted',
      'brand.phone_pool.empty',
      'brand.escrow.insufficient',
      'wallet.funded',
      'escrow.locked',
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings & appointments',
    description: 'Bookings, verification, and audit outcomes.',
    audience: 'both',
    events: ['appointment.booked', 'appointment.verified', 'appointment.failed_audit'],
  },
  {
    id: 'payouts',
    title: 'Payouts',
    description: 'Checkout, paid, failed, and Connect status.',
    audience: 'sdr',
    events: ['payout.ready', 'payout.paid', 'payout.failed', 'connect.required', 'connect.ready'],
  },
];

function audienceMatch(
  groupAudience: 'sdr' | 'brand' | 'both',
  roleAudience: 'sdr' | 'brand'
) {
  return groupAudience === 'both' || groupAudience === roleAudience;
}

function eventMatch(
  key: NotificationEventKey,
  roleAudience: 'sdr' | 'brand'
) {
  const entry = NOTIFICATION_CATALOG[key];
  if (!entry) return false;
  return entry.audience === 'both' || entry.audience === roleAudience;
}

export default function NotificationPrefsPanel({
  roleAudience,
}: {
  roleAudience: 'sdr' | 'brand';
}) {
  const [emailOn, setEmailOn] = useState(true);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notifications/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.prefs) return;
        setEmailOn(d.prefs.emailEnabled !== false);
        setMuted(new Set(d.prefs.mutedEvents || []));
      })
      .catch(() => {});
  }, []);

  const groups = useMemo(
    () =>
      GROUPS.filter((g) => audienceMatch(g.audience, roleAudience)).map((g) => ({
        ...g,
        events: g.events.filter((e) => eventMatch(e, roleAudience)),
      })).filter((g) => g.events.length > 0),
    [roleAudience]
  );

  async function save(next: { emailEnabled?: boolean; mutedEvents?: string[] }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/notifications/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      if (data.prefs) {
        setEmailOn(data.prefs.emailEnabled !== false);
        setMuted(new Set(data.prefs.mutedEvents || []));
      }
      setMsg('Saved');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  function toggleMaster(on: boolean) {
    setEmailOn(on);
    void save({ emailEnabled: on, mutedEvents: [...muted] });
  }

  function toggleEvent(key: string, enabled: boolean) {
    const next = new Set(muted);
    if (enabled) next.delete(key);
    else next.add(key);
    setMuted(next);
    void save({ emailEnabled: emailOn, mutedEvents: [...next] });
  }

  return (
    <div className="notif-prefs">
      <label className="notif-prefs__master">
        <input
          type="checkbox"
          checked={emailOn}
          disabled={busy}
          onChange={(e) => toggleMaster(e.target.checked)}
        />
        <span>
          <strong>Email notifications on</strong>
          <span className="muted">
            Master switch. Brand emails send as “Brand via ColdCallReps”.
          </span>
        </span>
      </label>

      <div className={`notif-prefs__groups${emailOn ? '' : ' is-disabled'}`}>
        {groups.map((group) => (
          <section key={group.id} className="notif-prefs__group">
            <header className="notif-prefs__group-head">
              <h3 className="notif-prefs__group-title">{group.title}</h3>
              <p className="muted notif-prefs__group-desc">{group.description}</p>
            </header>
            <ul className="notif-prefs__list">
              {group.events.map((key) => {
                const entry = NOTIFICATION_CATALOG[key];
                const on = emailOn && !muted.has(key);
                return (
                  <li key={key}>
                    <label className="notif-prefs__row">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busy || !emailOn}
                        onChange={(e) => toggleEvent(key, e.target.checked)}
                      />
                      <span>
                        <span className="notif-prefs__row-label">
                          {entry?.description || key}
                        </span>
                        <span className="notif-prefs__row-key muted">{key}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {msg ? (
        <p className={msg === 'Saved' ? 'msg-ok' : 'msg-err'} style={{ marginTop: '0.65rem' }}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
