'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, SoftLink } from '@/components/ui/PagePrimitives';

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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<CalendarMeta>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Could not load integrations.');
        return;
      }
      setConnections(data.connections || []);
      setCalendar(data.calendar || {});
    } catch {
      setErr('Could not load integrations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
  const googleAccount = googleConn?.email || googleConn?.externalId || null;
  const canConnect = Boolean(calendar.canConnectCalendar);
  const googleReady = Boolean(calendar.googleConfigured);

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
        description="Connect calendars for meeting handoffs, CRM for pipeline sync, and payouts when you’re ready to get paid."
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
                  OAuth connect for brand meeting handoffs from booked gigs.
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
                <Link href="/gigs">active gig</Link> once the brand is linked.
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
          <h2 className="integration-section__title">CRM</h2>
          <p className="integration-section__desc">
            Push booked meetings and lead outcomes into your pipeline. Full OAuth sync is on the
            roadmap — not fake workspace links.
          </p>
        </header>

        <div className="integration-grid">
          <article className="integration-card integration-card--muted">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">Close</h3>
                <p className="integration-card__blurb">
                  Sales CRM sync for marketplace dials, meetings, and campaign outcomes.
                </p>
              </div>
              <StatusChip tone="soon" label="Coming soon" />
            </div>
          </article>

          <article className="integration-card integration-card--muted">
            <div className="integration-card__top">
              <div>
                <h3 className="integration-card__name">HubSpot</h3>
                <p className="integration-card__blurb">
                  Contacts and deal stages for brands running outbound campaigns.
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
                  Track gig payouts on Earnings; practice-minute plans stay on Billing.
                </p>
              </div>
              <StatusChip tone="available" label="Via Earnings" />
            </div>
            <div className="integration-card__actions">
              <Link href="/earnings" className="btn-ghost">
                Open Earnings
              </Link>
              <SoftLink href="/billing">Minute plans →</SoftLink>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
