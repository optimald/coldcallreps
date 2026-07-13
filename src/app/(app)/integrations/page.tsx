'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, SoftLink } from '@/components/ui/PagePrimitives';
import { useShell } from '@/components/ShellProvider';

type CalendarMeta = {
  googleConfigured?: boolean;
  microsoftAvailable?: boolean;
  canConnectCalendar?: boolean;
};

type Connection = {
  id: string;
  provider: string;
  status: string;
  email?: string | null;
  externalId?: string | null;
};

type StatusTone = 'connected' | 'available' | 'setup' | 'soon' | 'role';

function StatusChip({ tone, label }: { tone: StatusTone; label: string }) {
  return <span className={`integration-status integration-status--${tone}`}>{label}</span>;
}

export default function IntegrationsPage() {
  const search = useSearchParams();
  const shell = useShell();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<CalendarMeta>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(() => shell?.role || null);

  async function load() {
    setLoading(true);
    try {
      const intRes = await fetch('/api/integrations');
      const data = await intRes.json();
      if (!intRes.ok) {
        setErr(data.error || 'Could not load integrations.');
        return;
      }
      setConnections(data.connections || []);
      setCalendar(data.calendar || {});
      if (!role && shell?.role) setRole(shell.role);
    } catch {
      setErr('Could not load integrations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Mount-only — OAuth query params handled below without refetching /api/me.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const connected = search.get('connected');
    const error = search.get('error');
    if (connected === 'google_calendar') {
      setMsg('Google Calendar connected — campaign meetings can land on your calendar.');
    } else if (connected) {
      setMsg(`${connected.replace(/_/g, ' ')} connected.`);
    }
    if (error) setErr(error);
  }, [search]);

  function connectGoogle() {
    window.location.href = '/api/integrations/google_calendar/connect';
  }

  function connectHubspot() {
    window.location.href = '/api/integrations/hubspot/connect';
  }

  async function pullCrm() {
    setBusyId('crm-pull');
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/integrations/crm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'pull' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pull failed');
      const n = (data.results || []).reduce(
        (acc: number, r: { updated?: number }) => acc + (r.updated || 0),
        0
      );
      setMsg(`Pulled CRM updates — ${n} mapped lead${n === 1 ? '' : 's'} updated.`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Pull failed');
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: string) {
    setBusyId(id);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/integrations?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMsg('Disconnected.');
        await load();
      } else {
        setErr(data.error || 'Disconnect failed');
      }
    } catch {
      setErr('Disconnect failed');
    } finally {
      setBusyId(null);
    }
  }

  const googleConn = connections.find(
    (c) => c.provider === 'google_calendar' && c.status === 'connected'
  );
  const hubspotConn = connections.find(
    (c) => c.provider === 'hubspot' && c.status === 'connected'
  );
  const googleAccount = googleConn?.email || googleConn?.externalId || null;
  const canConnect = Boolean(calendar.canConnectCalendar);
  const googleReady = Boolean(calendar.googleConfigured);
  const hideConnectPayouts = role === 'BRAND' || role === 'RECRUITER';

  let googleStatus: { tone: StatusTone; label: string };
  if (!canConnect) {
    googleStatus = { tone: 'role', label: 'Brand accounts' };
  } else if (googleConn) {
    googleStatus = { tone: 'connected', label: 'Connected' };
  } else if (!googleReady) {
    googleStatus = { tone: 'setup', label: 'Not configured' };
  } else {
    googleStatus = { tone: 'available', label: 'Available' };
  }

  return (
    <main className="app-page app-page--narrow">
      <PageHeader
        eyebrow="Workspace"
        title="Integrations"
        description={
          hideConnectPayouts
            ? 'Connect calendars for meeting handoffs. ColdCallReps Leads is your CRM — HubSpot (and other adapters) only sync.'
            : 'Connect calendars for meeting handoffs, sync your CRM adapters, and set up payouts when you’re ready to get paid.'
        }
      />

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}

      <section className="integration-section">
        <header className="integration-section__head">
          <h2 className="integration-section__title">Calendar</h2>
          <p className="integration-section__desc">
            Brands connect a calendar so SDRs can book qualified meetings as campaign outcomes.
          </p>
        </header>

        <div className="integration-grid">
          <article className="integration-card">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Google Calendar</h3>
                <p className="integration-card__blurb">
                  OAuth connect for brand meeting handoffs from booked brand deals.
                </p>
              </div>
              <StatusChip tone={googleStatus.tone} label={googleStatus.label} />
            </div>

            {googleConn && googleAccount ? (
              <p className="integration-card__meta">{googleAccount}</p>
            ) : null}

            {!canConnect ? (
              <p className="integration-card__hint">
                Switch to a Brand account to connect. SDRs book from an{' '}
                <Link href="/gigs">active brand deal</Link> once the brand is linked.
              </p>
            ) : null}

            {canConnect && !googleReady && !googleConn ? (
              <p className="integration-card__hint">
                Server OAuth isn’t set up yet. Add Google client credentials in env when you’re ready
                to go live — see <code>.env.example</code>.
              </p>
            ) : null}

            <div className="integration-card__actions">
              {canConnect && googleConn ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === googleConn.id || loading}
                    onClick={() => disconnect(googleConn.id)}
                  >
                    {busyId === googleConn.id ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!googleReady || loading}
                    onClick={connectGoogle}
                  >
                    Reconnect
                  </button>
                </>
              ) : null}
              {canConnect && !googleConn ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!googleReady || loading}
                  onClick={connectGoogle}
                >
                  Connect Google
                </button>
              ) : null}
            </div>
          </article>

          <article className="integration-card integration-card--muted">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Microsoft Calendar</h3>
                <p className="integration-card__blurb">
                  Outlook / Microsoft 365 booking for brands — same handoff flow as Google.
                </p>
              </div>
              <StatusChip tone="soon" label="Coming soon" />
            </div>
          </article>
        </div>
      </section>

      <section className="integration-section">
        <header className="integration-section__head">
          <h2 className="integration-section__title">CRM sync</h2>
          <p className="integration-section__desc">
            ColdCallReps Leads is your CRM. Connect an external tool to two-way sync contacts —
            never a second system of record.
          </p>
        </header>

        <div className="integration-grid">
          <article className={`integration-card${hubspotConn ? '' : ' integration-card--muted'}`}>
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">HubSpot</h3>
                <p className="integration-card__blurb">
                  Push enriched leads and pull contact updates. Portal{' '}
                  {hubspotConn?.externalId ? `#${hubspotConn.externalId}` : 'not linked'}.
                </p>
              </div>
              <StatusChip
                tone={hubspotConn ? 'connected' : 'available'}
                label={hubspotConn ? 'Connected' : 'Available'}
              />
            </div>
            <div className="integration-card__actions">
              {hubspotConn ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === 'crm-pull'}
                    onClick={() => void pullCrm()}
                  >
                    {busyId === 'crm-pull' ? 'Pulling…' : 'Pull updates'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === hubspotConn.id}
                    onClick={() => void disconnect(hubspotConn.id)}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button type="button" className="btn" onClick={connectHubspot}>
                  Connect HubSpot
                </button>
              )}
              <SoftLink href="/leads">Open leads →</SoftLink>
            </div>
          </article>

          <article className="integration-card integration-card--muted">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Close</h3>
                <p className="integration-card__blurb">
                  Sync adapter for dials, meetings, and campaign outcomes.
                </p>
              </div>
              <StatusChip tone="soon" label="Coming soon" />
            </div>
          </article>

          <article className="integration-card integration-card--muted">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Salesforce</h3>
                <p className="integration-card__blurb">
                  Enterprise pipeline sync when your team already lives in Salesforce.
                </p>
              </div>
              <StatusChip tone="soon" label="Coming soon" />
            </div>
          </article>
        </div>
      </section>

      {!hideConnectPayouts ? (
      <section className="integration-section">
        <header className="integration-section__head">
          <h2 className="integration-section__title">Payouts</h2>
          <p className="integration-section__desc">
            Campaign earnings and Connect onboarding live on{' '}
            <Link href="/earnings" className="soft-link">
              Earnings
            </Link>{' '}
            — not a separate OAuth card.
          </p>
        </header>

        <div className="integration-grid">
          <article className="integration-card">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Stripe Connect</h3>
                <p className="integration-card__blurb">
                  Track brand deal payouts on Earnings; practice-minute plans stay on Billing.
                </p>
              </div>
              <StatusChip tone="available" label="Via Earnings" />
            </div>
            <div className="integration-card__actions">
              <Link href="/earnings" className="btn-ghost">
                Open Earnings
              </Link>
              <SoftLink href="/subscribe/sdr">Minute plans →</SoftLink>
            </div>
          </article>
        </div>
      </section>
      ) : null}
    </main>
  );
}
