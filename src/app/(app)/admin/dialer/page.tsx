'use client';

import { useMemo, useState } from 'react';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  useAdminFetch,
} from '@/components/AdminPageKit';
import { Stat, StatGrid } from '@/components/ui/PagePrimitives';

type DialerData = {
  kpis: {
    calls7d: number;
    connectRatePct: number | null;
    avgDurationSec: number | null;
    activePhones: number;
    dncEntries: number;
  };
  phones: Array<{
    id: string;
    e164: string;
    isActive: boolean;
    brandId?: string;
    brandName: string;
    label: string | null;
  }>;
  recentCalls: Array<{
    id: string;
    status: string;
    toNumber: string | null;
    duration: number | null;
    recordingConsent: boolean | null;
    repName: string | null;
    brandName: string | null;
    createdAt: string;
  }>;
  dncEntries: Array<{
    id: string;
    phoneE164: string;
    scope: string;
    brandId?: string | null;
    brandName?: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  brandVolume: Array<{ brandName: string; calls: number; avgDurationSec: number | null }>;
};

function formatDuration(sec: number | null | undefined) {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function formatScope(scope: string) {
  const s = scope.trim().toLowerCase();
  if (s === 'brand') return 'Brand';
  return 'Global';
}

export default function AdminDialerPage() {
  const { data, forbidden, reload, error, isDemo, demoMsg } =
    useAdminFetch<DialerData>('/api/admin/dialer');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState<'global' | 'brand'>('global');
  const [brandId, setBrandId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.phones || []) {
      if (p.brandId) map.set(p.brandId, p.brandName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.phones]);

  async function addDnc() {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    if (!phone.trim()) {
      setMsg('Enter a phone number in E.164 format.');
      return;
    }
    if (scope === 'brand' && !brandId) {
      setMsg('Pick a brand for brand-scoped DNC.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/dialer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dnc_add',
        phone,
        reason,
        ...(scope === 'brand' && brandId ? { brandId } : {}),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Added to DNC list.' : d.error || 'Failed to add DNC entry');
    if (res.ok) {
      setPhone('');
      setReason('');
      setScope('global');
      setBrandId('');
      reload();
    }
  }

  async function removeDnc(id: string) {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/dialer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dnc_remove', id }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || 'Failed to remove DNC entry');
      return;
    }
    reload();
  }

  async function retirePhone(id: string) {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/dialer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'phone_retire', id }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || 'Failed to retire number');
      return;
    }
    setMsg('Number retired.');
    reload();
  }

  const dncRows = data?.dncEntries || [];
  const phoneRows = data?.phones || [];
  const callRows = data?.recentCalls || [];
  const volumeRows = data?.brandVolume || [];

  return (
    <AdminGate title="Dialer" forbidden={forbidden}>
      <AdminPageChrome
        title="Dialer compliance & inventory"
        description="TCPA Do Not Call, outbound DID inventory, and call volume — not campaign management. Blocks apply before CallLog create."
      >
        <div className="admin-dialer">
          {data?.kpis ? (
            <StatGrid>
              <Stat label="Calls 7d" value={data.kpis.calls7d} tone="accent" />
              <Stat
                label="Connect %"
                value={
                  data.kpis.connectRatePct != null ? `${data.kpis.connectRatePct}%` : '—'
                }
              />
              <Stat
                label="Avg duration"
                value={
                  data.kpis.avgDurationSec != null
                    ? formatDuration(data.kpis.avgDurationSec)
                    : '—'
                }
              />
              <Stat label="Active DIDs" value={data.kpis.activePhones} />
              <Stat label="DNC entries" value={data.kpis.dncEntries} tone="warn" />
            </StatGrid>
          ) : null}

          <Panel
            title="Do Not Call"
            description="Blocks outbound dials before a CallLog is created (TCPA). Global entries apply platform-wide; brand scope limits the block to one brand."
          >
            <div className="admin-dialer__form">
              <label className="field-label">
                Phone (E.164)
                <input
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15551234567"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={busy}
                />
              </label>
              <label className="field-label">
                Reason
                <input
                  className="field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Consumer request, wrong number…"
                  disabled={busy}
                />
              </label>
              <label className="field-label">
                Scope
                <select
                  className="field"
                  value={scope}
                  onChange={(e) => {
                    const next = e.target.value === 'brand' ? 'brand' : 'global';
                    setScope(next);
                    if (next === 'global') setBrandId('');
                  }}
                  disabled={busy}
                >
                  <option value="global">Global (all brands)</option>
                  <option value="brand" disabled={brands.length === 0}>
                    Brand
                  </option>
                </select>
              </label>
              {scope === 'brand' ? (
                <label className="field-label">
                  Brand
                  <select
                    className="field"
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    disabled={busy || brands.length === 0}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="admin-dialer__form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={addDnc}
                  disabled={busy}
                  title={isDemo ? demoMsg : 'Add phone to Do Not Call list'}
                >
                  Add to DNC
                </button>
                <p className="form-field__hint admin-dialer__form-hint">
                  Adds or refreshes a DNC entry. Demo mode cannot mutate live data.
                </p>
              </div>
            </div>

            {dncRows.length === 0 ? (
              <p className="admin-dialer__empty">No DNC entries yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-dialer__table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Scope</th>
                      <th>Reason</th>
                      <th>Added</th>
                      <th className="admin-dialer__col-actions"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dncRows.map((e) => (
                      <tr key={e.id}>
                        <td className="admin-dialer__mono">{e.phoneE164}</td>
                        <td>
                          <span className="admin-dialer__scope">
                            {formatScope(e.scope)}
                            {e.scope?.toLowerCase() === 'brand' &&
                            (e.brandName || e.brandId)
                              ? ` · ${e.brandName || e.brandId}`
                              : ''}
                          </span>
                        </td>
                        <td>{e.reason || '—'}</td>
                        <td className="admin-dialer__muted">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                        <td className="admin-dialer__col-actions">
                          <button
                            type="button"
                            className="btn-ghost btn-ghost--sm"
                            onClick={() => removeDnc(e.id)}
                            disabled={busy}
                            title={isDemo ? demoMsg : 'Remove from DNC'}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Phone inventory"
            description="Brand DIDs used for outbound. Retire takes a number out of rotation (sets inactive) — it does not provision new Twilio numbers."
          >
            {phoneRows.length === 0 ? (
              <p className="admin-dialer__empty">No numbers in inventory.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-dialer__table">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Brand</th>
                      <th>Label</th>
                      <th>Status</th>
                      <th className="admin-dialer__col-actions"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {phoneRows.map((p) => (
                      <tr key={p.id}>
                        <td className="admin-dialer__mono">{p.e164}</td>
                        <td>{p.brandName}</td>
                        <td>{p.label || '—'}</td>
                        <td>
                          <span
                            className={
                              p.isActive
                                ? 'admin-dialer__status admin-dialer__status--active'
                                : 'admin-dialer__status admin-dialer__status--retired'
                            }
                          >
                            {p.isActive ? 'Active' : 'Retired'}
                          </span>
                        </td>
                        <td className="admin-dialer__col-actions">
                          {p.isActive ? (
                            <button
                              type="button"
                              className="btn-ghost btn-ghost--sm"
                              onClick={() => retirePhone(p.id)}
                              disabled={busy}
                              title={isDemo ? demoMsg : 'Retire this DID'}
                            >
                              Retire
                            </button>
                          ) : (
                            <span className="admin-dialer__muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="admin-dialer__lower">
            <Panel
              title="Recent calls"
              description="Latest outbound / dialer CallLog rows across brands."
            >
              {callRows.length === 0 ? (
                <p className="admin-dialer__empty">No recent calls.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-dialer__table admin-dialer__calls">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>To</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Consent</th>
                        <th>Rep</th>
                        <th>Brand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callRows.map((c) => (
                        <tr key={c.id}>
                          <td className="admin-dialer__muted admin-dialer__nowrap">
                            {new Date(c.createdAt).toLocaleString()}
                          </td>
                          <td className="admin-dialer__mono">{c.toNumber || '—'}</td>
                          <td>{c.status}</td>
                          <td className="admin-dialer__num">
                            {formatDuration(c.duration)}
                          </td>
                          <td>
                            {c.recordingConsent == null
                              ? '—'
                              : c.recordingConsent
                                ? 'Yes'
                                : 'No'}
                          </td>
                          <td>{c.repName || '—'}</td>
                          <td>{c.brandName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Brand volume (7d)" description="Call count and average talk time.">
              {volumeRows.length === 0 ? (
                <p className="admin-dialer__empty">No volume in the last 7 days.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-dialer__table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th className="admin-dialer__num">Calls</th>
                        <th className="admin-dialer__num">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {volumeRows.map((b) => (
                        <tr key={b.brandName}>
                          <td>{b.brandName}</td>
                          <td className="admin-dialer__num">{b.calls}</td>
                          <td className="admin-dialer__num">
                            {formatDuration(b.avgDurationSec)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {msg || error ? (
            <p className={msg.includes('Added') || msg.includes('retired') ? 'msg-ok' : 'msg-err'}>
              {msg || error}
            </p>
          ) : null}
        </div>
      </AdminPageChrome>
    </AdminGate>
  );
}
