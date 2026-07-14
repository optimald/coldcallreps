'use client';

import { useMemo, useState } from 'react';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  SoftLink,
  useAdminFetch,
} from '@/components/AdminPageKit';
import { Stat, StatGrid } from '@/components/ui/PagePrimitives';

type Data = {
  kpis: {
    webhooks: number;
    webhookErrors: number;
    apiKeys: number;
    revokedKeys: number;
    disputesOpen: number;
    notifFails24h: number;
  };
  webhooks: Array<{
    id: string;
    url: string;
    active: boolean;
    lastError: string | null;
    userEmail: string | null;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    revokedAt: string | null;
    userEmail: string | null;
  }>;
  disputes: Array<{
    id: string;
    stripeDisputeId: string;
    status: string;
    reason: string | null;
    amountLabel: string;
  }>;
  configs: Array<{ key: string; valueJSON: string }>;
  stripeEvents: Array<{ id: string; type: string; processedAt: string }>;
};

type KnownFlag =
  | {
      key: string;
      label: string;
      hint: string;
      kind: 'enabled';
      defaultEnabled: boolean;
    }
  | {
      key: string;
      label: string;
      hint: string;
      kind: 'cents';
      defaultCents: number;
    };

const KNOWN_FLAGS: KnownFlag[] = [
  {
    key: 'feature.demoDesk',
    label: 'Demo desk',
    hint: 'Lets ops browse admin surfaces with fixture data.',
    kind: 'enabled',
    defaultEnabled: false,
  },
  {
    key: 'voice.costPerMinCents',
    label: 'Estimated voice cost ¢/min',
    hint: 'Used for cost estimates in dialer / voice reporting.',
    kind: 'cents',
    defaultCents: 30,
  },
];

const KNOWN_KEYS = new Set(KNOWN_FLAGS.map((f) => f.key));

function configMap(configs: Array<{ key: string; valueJSON: string }> | undefined) {
  const map = new Map<string, string>();
  for (const c of configs || []) map.set(c.key, c.valueJSON);
  return map;
}

function parseEnabled(valueJSON: string | undefined, fallback: boolean): boolean {
  if (valueJSON == null || valueJSON === '') return fallback;
  try {
    const v = JSON.parse(valueJSON) as unknown;
    if (typeof v === 'boolean') return v;
    if (v && typeof v === 'object' && typeof (v as { enabled?: unknown }).enabled === 'boolean') {
      return (v as { enabled: boolean }).enabled;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

function parseCents(valueJSON: string | undefined, fallback: number): number {
  if (valueJSON == null || valueJSON === '') return fallback;
  try {
    const v = JSON.parse(valueJSON) as unknown;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v && typeof v === 'object' && typeof (v as { cents?: unknown }).cents === 'number') {
      return (v as { cents: number }).cents;
    }
  } catch {
    const n = Number(valueJSON);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'fail' | 'muted' | 'warn';
  children: string;
}) {
  const cls =
    tone === 'ok'
      ? 'admin-job-status admin-job-status--ok'
      : tone === 'fail'
        ? 'admin-job-status admin-job-status--fail'
        : tone === 'warn'
          ? 'admin-job-status admin-job-status--queued'
          : 'admin-job-status';
  return <span className={cls}>{children}</span>;
}

function webhookStatus(w: { active: boolean; lastError: string | null }) {
  if (w.lastError) return { tone: 'fail' as const, label: 'Error' };
  if (w.active) return { tone: 'ok' as const, label: 'Active' };
  return { tone: 'muted' as const, label: 'Inactive' };
}

function apiKeyStatus(k: { revokedAt: string | null }) {
  if (k.revokedAt) return { tone: 'muted' as const, label: 'Revoked' };
  return { tone: 'ok' as const, label: 'Active' };
}

export default function AdminHealthPage() {
  const { data, forbidden, reload, error, isDemo, demoMsg } =
    useAdminFetch<Data>('/api/admin/health');
  const [flagKey, setFlagKey] = useState('feature.demoDesk');
  const [flagValue, setFlagValue] = useState('{"enabled":true}');
  const [costDraft, setCostDraft] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const byKey = useMemo(() => configMap(data?.configs), [data?.configs]);
  const otherConfigs = useMemo(
    () => (data?.configs || []).filter((c) => !KNOWN_KEYS.has(c.key)),
    [data?.configs]
  );

  const costValue = parseCents(byKey.get('voice.costPerMinCents'), 30);
  const costInput = costDraft ?? String(costValue);

  async function saveConfig(key: string, valueJSON: string, okLabel = 'Flag saved.') {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/health', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, valueJSON }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? okLabel : d.error || 'Failed');
    if (res.ok) {
      setCostDraft(null);
      reload();
    }
  }

  async function toggleEnabled(key: string, currentlyEnabled: boolean) {
    await saveConfig(key, JSON.stringify({ enabled: !currentlyEnabled }), 'Flag updated.');
  }

  async function saveCost() {
    const n = Number(costInput);
    if (!Number.isFinite(n) || n < 0) {
      setMsg('Enter a non-negative number for voice cost ¢/min.');
      return;
    }
    await saveConfig('voice.costPerMinCents', JSON.stringify(Math.round(n)), 'Voice cost saved.');
  }

  async function saveAdvanced() {
    await saveConfig(flagKey.trim(), flagValue.trim());
  }

  const disputes = (data?.disputes || []).slice(0, 5);
  const stripeEvents = (data?.stripeEvents || []).slice(0, 12);

  return (
    <AdminGate title="Health" forbidden={forbidden}>
      <AdminPageChrome
        title="System health"
        description="Infra and ops telemetry for the platform — developer webhooks, API keys, Stripe event/dispute signals, notification failures, and AdminConfig kill switches. Not CMS or brand content; chargeback work lives on Refunds."
        actions={<SoftLink href="/admin">← Command</SoftLink>}
      >
        {data?.kpis ? (
          <StatGrid>
            <Stat label="Webhooks" value={data.kpis.webhooks} />
            <Stat label="Webhook errors" value={data.kpis.webhookErrors} tone="warn" />
            <Stat label="API keys" value={data.kpis.apiKeys} />
            <Stat label="Revoked keys" value={data.kpis.revokedKeys} />
            <Stat label="Open disputes" value={data.kpis.disputesOpen} tone="warn" />
            <Stat label="Notif fails 24h" value={data.kpis.notifFails24h} tone="warn" />
          </StatGrid>
        ) : null}

        <Panel
          title="Feature flags & kill switches"
          description="Typed AdminConfig controls — common flags first; raw key/JSON under Advanced."
        >
          <ul className="admin-health__flags">
            {KNOWN_FLAGS.map((flag) => {
              if (flag.kind === 'enabled') {
                const enabled = parseEnabled(byKey.get(flag.key), flag.defaultEnabled);
                const present = byKey.has(flag.key);
                return (
                  <li key={flag.key} className="admin-health__flag">
                    <div className="admin-health__flag-main">
                      <span className="admin-health__flag-label">{flag.label}</span>
                      <span className="admin-health__flag-meta">
                        <code>{flag.key}</code>
                        {present ? '' : ' · not set'}
                        {' · '}
                        {flag.hint}
                      </span>
                    </div>
                    <div className="admin-health__flag-actions">
                      <StatusBadge tone={enabled ? 'ok' : 'muted'}>
                        {enabled ? 'On' : 'Off'}
                      </StatusBadge>
                      <button
                        type="button"
                        className="btn-ghost btn-ghost--sm"
                        disabled={busy}
                        onClick={() => toggleEnabled(flag.key, enabled)}
                        aria-pressed={enabled}
                      >
                        {enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={flag.key} className="admin-health__flag">
                  <div className="admin-health__flag-main">
                    <span className="admin-health__flag-label">{flag.label}</span>
                    <span className="admin-health__flag-meta">
                      <code>{flag.key}</code>
                      {' · '}
                      {flag.hint}
                    </span>
                  </div>
                  <div className="admin-health__flag-actions admin-health__flag-actions--cost">
                    <input
                      className="field admin-health__cost-input"
                      type="number"
                      min={0}
                      step={1}
                      value={costInput}
                      disabled={busy}
                      onChange={(e) => setCostDraft(e.target.value)}
                      aria-label={flag.label}
                    />
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={busy}
                      onClick={() => saveCost()}
                    >
                      Save
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <details className="admin-health__advanced">
            <summary>Advanced — arbitrary key / JSON</summary>
            <div className="search-row">
              <input
                className="field"
                value={flagKey}
                onChange={(e) => setFlagKey(e.target.value)}
                placeholder="key"
                aria-label="Config key"
              />
              <input
                className="field"
                value={flagValue}
                onChange={(e) => setFlagValue(e.target.value)}
                placeholder='{"enabled":true}'
                aria-label="Config value JSON"
              />
              <button type="button" className="btn" disabled={busy} onClick={() => saveAdvanced()}>
                Save
              </button>
            </div>
            {otherConfigs.length ? (
              <ul className="list-quiet admin-health__other">
                {otherConfigs.map((c) => (
                  <li key={c.key}>
                    <code>{c.key}</code> = {c.valueJSON}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted admin-health__other-empty">No other AdminConfig keys stored.</p>
            )}
          </details>
        </Panel>

        <div className="admin-split">
          <Panel
            title="Developer webhooks"
            description="Outbound webhook endpoints registered by accounts."
          >
            {(data?.webhooks || []).length === 0 ? (
              <p className="muted">No webhooks registered.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>URL</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.webhooks || []).map((w) => {
                      const st = webhookStatus(w);
                      return (
                        <tr
                          key={w.id}
                          className={w.lastError ? 'admin-table__row--risk' : undefined}
                        >
                          <td>{w.userEmail || '—'}</td>
                          <td className="admin-health__mono" title={w.url}>
                            {w.url.length > 48 ? `${w.url.slice(0, 48)}…` : w.url}
                          </td>
                          <td>
                            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                            {w.lastError ? (
                              <span className="admin-job-error" title={w.lastError}>
                                {w.lastError}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="API keys" description="Developer API key inventory.">
            {(data?.apiKeys || []).length === 0 ? (
              <p className="muted">No API keys.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Name</th>
                      <th>Prefix</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.apiKeys || []).map((k) => {
                      const st = apiKeyStatus(k);
                      return (
                        <tr key={k.id}>
                          <td>{k.userEmail || '—'}</td>
                          <td>{k.name}</td>
                          <td className="admin-health__mono">{k.keyPrefix}…</td>
                          <td>
                            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="admin-split">
          <Panel
            title="Stripe dispute signals"
            description="Signal strip only — investigate and respond in the chargeback inbox."
            actions={<SoftLink href="/admin/refunds">Open chargeback inbox →</SoftLink>}
          >
            {disputes.length === 0 ? (
              <p className="muted">None yet — populated from charge.dispute.* webhooks.</p>
            ) : (
              <ul className="list-quiet">
                {disputes.map((d) => (
                  <li key={d.id}>
                    <code>{d.stripeDisputeId}</code> · {d.status} · {d.amountLabel}
                    {d.reason ? ` · ${d.reason}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent Stripe events" description="Latest processed webhook events.">
            {stripeEvents.length === 0 ? (
              <p className="muted">No events recorded.</p>
            ) : (
              <ul className="list-quiet admin-health__events">
                {stripeEvents.map((e) => (
                  <li key={e.id}>
                    <span className="admin-health__event-type">{e.type}</span>
                    <span className="muted">
                      {' '}
                      · {new Date(e.processedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {msg || error ? (
          <p className={msg.includes('saved') || msg.includes('updated') ? 'msg-ok' : 'msg-err'}>
            {msg || error}
          </p>
        ) : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
