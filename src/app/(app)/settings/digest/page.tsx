'use client';

import { useEffect, useState } from 'react';
import Toggle from '@/components/ui/Toggle';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';
import { PageHeader, SoftLink } from '@/components/ui/PagePrimitives';

type DigestForm = {
  enabled: boolean;
  email: string;
};

export default function DigestSettingsPage() {
  const { values, update, dirty, hydrate, markSaved, reset } = useUnsavedForm<DigestForm>({
    enabled: false,
    email: '',
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleGate, setRoleGate] = useState<'loading' | 'ok' | 'brand'>('loading');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const role = d?.platformRole || 'REP';
        if (role === 'BRAND' || role === 'RECRUITER') {
          setRoleGate('brand');
          return;
        }
        setRoleGate('ok');
      })
      .catch(() => setRoleGate('ok'));
  }, []);

  useEffect(() => {
    if (roleGate !== 'ok') return;
    fetch('/api/digests/weekly')
      .then((r) => r.json())
      .then((d) => {
        hydrate({
          enabled: Boolean(d.subscription?.enabled),
          email: d.subscription?.email || '',
        });
      })
      .catch(() => {});
  }, [hydrate, roleGate]);

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/digests/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: values.enabled, email: values.email }),
      });
      const data = await res.json();
      if (res.ok) {
        markSaved();
        setMsg('Preferences saved. Digests send Mondays via Resend cron.');
      } else {
        setMsg(data.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  }

  if (roleGate === 'loading') {
    return (
      <main className="app-page app-page--narrow">
        <PageHeader eyebrow="Account" title="Weekly digest" description="Loading…" />
      </main>
    );
  }

  if (roleGate === 'brand') {
    return (
      <main className="app-page app-page--narrow">
        <SoftLink href="/settings">← Settings</SoftLink>
        <PageHeader
          eyebrow="Account"
          title="Weekly digest"
          description="Weekly Top Reps is for SDRs. Switch to SDR in Settings if you want the board digest."
        />
      </main>
    );
  }

  return (
    <main className="app-page app-page--narrow">
      <SoftLink href="/settings">← Settings</SoftLink>
      <PageHeader
        eyebrow="Account"
        title="Weekly digest"
        description="Mondays via Resend — leaderboard highlights and your week."
      />
      <div style={{ margin: '1rem 0' }}>
        <Toggle
          checked={values.enabled}
          onChange={(enabled) => update({ enabled })}
          label="Email me Weekly Top Reps"
          description="Leaderboard highlights for practicing SDRs"
        />
      </div>
      <input
        className="field"
        value={values.email}
        onChange={(e) => update({ email: e.target.value })}
        placeholder="Email"
      />
      {msg && (
        <p className={msg.includes('Failed') ? 'msg-err' : 'msg-ok'} style={{ marginTop: '0.75rem' }}>
          {msg}
        </p>
      )}

      <UnsavedChangesBar
        dirty={dirty}
        saving={saving}
        onReset={() => {
          reset();
          setMsg('');
        }}
        onSave={save}
        saveLabel="Save"
      />
    </main>
  );
}
