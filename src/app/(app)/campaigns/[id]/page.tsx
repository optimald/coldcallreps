'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

function defaultStartLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultEndLocal(startLocal: string): string {
  const d = new Date(startLocal);
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [campaign, setCampaign] = useState<any>(null);
  const [canManage, setCanManage] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('OPEN');

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookTitle, setBookTitle] = useState('');
  const [bookEmails, setBookEmails] = useState('');
  const [bookStart, setBookStart] = useState(defaultStartLocal);
  const [bookEnd, setBookEnd] = useState(() => defaultEndLocal(defaultStartLocal()));
  const [bookAppId, setBookAppId] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimProspect, setClaimProspect] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [myAppStatus, setMyAppStatus] = useState<string | null>(null);

  async function loadBookings() {
    if (!id) return;
    const res = await fetch(`/api/campaigns/${id}/book`);
    if (!res.ok) return;
    const d = await res.json();
    setCalendarConnected(Boolean(d.calendarConnected));
    setBookings(d.bookings || []);
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setCampaign(null);
        return;
      }
      const d = await res.json();
      setCampaign(d.campaign);
      setCanManage(Boolean(d.canManage));
      setStatus(d.campaign?.status || 'OPEN');
      setBookTitle(d.campaign?.title ? `Intro · ${d.campaign.title}` : 'Intro meeting');
      setMyAppStatus(d.campaign?.myApplication?.status || null);
      if (d.canManage) {
        const appsRes = await fetch(`/api/campaigns/${id}/applications`);
        if (appsRes.ok) {
          const apps = await appsRes.json();
          setApplications(apps.applications || []);
        }
      }
      await loadBookings();
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    setBookEnd(defaultEndLocal(bookStart));
  }, [bookStart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payout') === 'success') {
      setMsg('Payout submitted — Stripe will confirm shortly. Refresh if status is still pending.');
      load();
    } else if (params.get('payout') === 'cancel') {
      setErr('Payout checkout canceled.');
    }
  }, [id]);

  async function payApplicant(applicationId: string) {
    setPayingId(applicationId);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/campaigns/${id}/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(data.error || 'Could not start payout');
    } catch (e: any) {
      setErr(e.message || 'Could not start payout');
    } finally {
      setPayingId(null);
    }
  }

  async function saveStatus() {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'Status updated.' : '');
    setErr(res.ok ? '' : data.error || 'Update failed');
    if (res.ok) setCampaign(data.campaign);
  }

  async function setAppStatus(applicationId: string, next: string) {
    const res = await fetch(`/api/campaigns/${id}/applications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, status: next }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? data.notice || `Marked ${next}.` : '');
    setErr(res.ok ? '' : data.error || 'Update failed');
    if (res.ok) load();
  }

  async function bookMeeting(e: React.FormEvent) {
    e.preventDefault();
    setBookingBusy(true);
    setMsg('');
    setErr('');
    const attendeeEmails = bookEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const res = await fetch(`/api/campaigns/${id}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: bookTitle,
        attendeeEmails,
        startsAt: new Date(bookStart).toISOString(),
        endsAt: new Date(bookEnd).toISOString(),
        applicationId: bookAppId || campaign?.myApplication?.id || undefined,
        createMeetLink: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBookingBusy(false);
    if (!res.ok) {
      setErr(data.error || 'Booking failed');
      return;
    }
    setMsg(data.notice || 'Meeting booked.');
    setBookEmails('');
    await loadBookings();
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (notFound || !campaign) {
    return (
      <main className="app-page">
        <PageHeader title="Campaign not found" description="This campaign may be closed or the link is wrong." />
        <Link href="/campaigns" className="soft-link">
          ← Back to campaigns
        </Link>
      </main>
    );
  }

  const myApp = campaign.myApplication;
  const canBook =
    canManage ||
    myApp?.status === 'ACTIVE' ||
    myApp?.status === 'ACCEPTED';
  const activeApps = applications.filter(
    (a) => a.status === 'ACTIVE' || a.status === 'ACCEPTED'
  );

  return (
    <main className="app-page">
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href={canManage ? '/campaigns' : '/gigs'} className="muted" style={{ fontWeight: 600 }}>
          ← {canManage ? 'Campaigns' : 'Gigs'}
        </Link>
      </p>

      <PageHeader
        eyebrow={campaign.brand?.name || 'Campaign'}
        title={campaign.title}
        description={`${campaign.payoutLabel} per ${campaign.goalLabel?.toLowerCase() || 'result'} · ${campaign.status}`}
        actions={
          campaign.practiceHref ? (
            <Link href={campaign.practiceHref} className="btn">
              Practice pack →
            </Link>
          ) : undefined
        }
      />

      <Panel>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{campaign.description}</p>
        {campaign.icpText && (
          <>
            <h3 style={{ marginTop: '1.25rem', fontSize: '0.95rem' }}>ICP</h3>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {campaign.icpText}
            </p>
          </>
        )}
        <p className="muted" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.9rem' }}>
          {campaign.pack?.name ? `Pack: ${campaign.pack.name}` : 'No pack linked'}
          {campaign.playbook?.title ? ` · Playbook: ${campaign.playbook.title}` : ''}
          {campaign.minScore != null ? ` · Min score ${campaign.minScore}` : ''}
          {campaign.requireCertification ? ' · Certification required' : ''}
          {myApp ? ` · Your status: ${myApp.status}` : ''}
        </p>
      </Panel>

      {myApp && !canManage && (
        <Panel title="Your payout" description="Connect Stripe under Billing so brands can pay you when they approve a result.">
          <p className="muted" style={{ margin: 0 }}>
            Campaign pays {campaign.payoutLabel} per {campaign.goalLabel?.toLowerCase() || 'result'} (~
            {Math.round((campaign.platformFeeBps || 2000) / 100)}% platform fee). Manage Connect on{' '}
            <Link href="/billing" className="soft-link">
              Billing
            </Link>
            .
          </p>
        </Panel>
      )}

      {canManage && (
        <>
          <Panel title="Status" description="OPEN campaigns appear on the Gigs board for reps.">
            <div className="search-row" style={{ flexWrap: 'wrap' }}>
              <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="OPEN">Open</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button type="button" className="btn" onClick={saveStatus}>
                Save status
              </button>
            </div>
          </Panel>

          <Panel
            title="Applicants"
            description="Accept → Active to start work. When the outcome is delivered, pay the SDR via Stripe Connect (~20% platform fee)."
          >
            {applications.length === 0 ? (
              <EmptyState title="No applicants yet" description="Share the Gigs board or Arena with SDRs." />
            ) : (
              <div className="stack">
                {applications.map((a) => {
                  const paid = a.payout?.status === 'PAID';
                  const payoutPending = a.payout?.status === 'PENDING';
                  const canPay =
                    !paid &&
                    (a.status === 'ACTIVE' || a.status === 'ACCEPTED' || a.status === 'COMPLETED');
                  return (
                    <div
                      key={a.id}
                      className="session-row"
                      style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}
                    >
                      <div>
                        <strong>{a.applicant?.displayName || 'Rep'}</strong>
                        <div className="session-row__meta">
                          {a.status}
                          {paid
                            ? ' · Paid'
                            : payoutPending
                              ? ' · Payout pending'
                              : a.applicant?.connectReady
                                ? ' · Connect ready'
                                : ' · Connect incomplete'}
                          {a.applicant?.totalPoints != null ? ` · ${a.applicant.totalPoints} pts` : ''}
                          {a.applicant?.profileSlug ? (
                            <>
                              {' · '}
                              <Link href={`/${a.applicant.profileSlug}`}>profile</Link>
                            </>
                          ) : null}
                        </div>
                        {a.message && (
                          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                            {a.message}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {a.status === 'APPLIED' && (
                          <button type="button" className="btn" onClick={() => setAppStatus(a.id, 'ACTIVE')}>
                            Accept → Active
                          </button>
                        )}
                        {a.status !== 'REJECTED' && a.status !== 'COMPLETED' && !paid && (
                          <button type="button" className="btn-ghost" onClick={() => setAppStatus(a.id, 'REJECTED')}>
                            Reject
                          </button>
                        )}
                        {a.status === 'ACTIVE' && !paid && (
                          <button type="button" className="btn-ghost" onClick={() => setAppStatus(a.id, 'COMPLETED')}>
                            Mark complete
                          </button>
                        )}
                        {canPay && (
                          <button
                            type="button"
                            className="btn"
                            disabled={payingId === a.id}
                            onClick={() => payApplicant(a.id)}
                          >
                            {payingId === a.id ? 'Opening checkout…' : `Pay ${campaign.payoutLabel}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}

      {canBook && (
        <Panel
          title="Book meeting"
          description="Create an event on the brand’s Google Calendar (SDR → brand handoff)."
        >
          {!calendarConnected ? (
            <EmptyState
              title="Google Calendar not connected"
              description={
                canManage
                  ? 'Connect Google Calendar under Integrations so reps can book meetings onto your calendar.'
                  : 'This brand has not connected Google Calendar yet. Ask them to connect under Integrations.'
              }
              action={
                canManage ? (
                  <Link href="/integrations" className="btn" style={{ marginTop: '1rem' }}>
                    Connect Google Calendar
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <form onSubmit={bookMeeting} className="stack" style={{ gap: '0.75rem' }}>
              <label className="muted" style={{ fontSize: '0.85rem' }}>
                Title
                <input
                  className="field"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  required
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <label className="muted" style={{ fontSize: '0.85rem' }}>
                Attendee emails (comma-separated)
                <input
                  className="field"
                  value={bookEmails}
                  onChange={(e) => setBookEmails(e.target.value)}
                  placeholder="prospect@company.com"
                  required
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 180 }}>
                  Starts
                  <input
                    className="field"
                    type="datetime-local"
                    value={bookStart}
                    onChange={(e) => setBookStart(e.target.value)}
                    required
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 180 }}>
                  Ends
                  <input
                    className="field"
                    type="datetime-local"
                    value={bookEnd}
                    onChange={(e) => setBookEnd(e.target.value)}
                    required
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>
              {canManage && activeApps.length > 0 && (
                <label className="muted" style={{ fontSize: '0.85rem' }}>
                  Link to applicant (optional)
                  <select
                    className="field"
                    value={bookAppId}
                    onChange={(e) => setBookAppId(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  >
                    <option value="">—</option>
                    {activeApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.applicant?.displayName || 'Rep'} · {a.status}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className="btn" disabled={bookingBusy}>
                {bookingBusy ? 'Booking…' : 'Book on Google Calendar'}
              </button>
            </form>
          )}

          {bookings.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Recent bookings</h3>
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {bookings.map((b) => (
                  <li key={b.id} className="muted" style={{ fontSize: '0.9rem' }}>
                    <strong style={{ color: 'var(--ink)' }}>{b.title}</strong>
                    {' · '}
                    {new Date(b.startsAt).toLocaleString()}
                    {b.meetLink && (
                      <>
                        {' · '}
                        <a href={b.meetLink} target="_blank" rel="noreferrer">
                          Meet
                        </a>
                      </>
                    )}
                    {b.htmlLink && (
                      <>
                        {' · '}
                        <a href={b.htmlLink} target="_blank" rel="noreferrer">
                          Calendar
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {msg && <p className="msg-ok">{msg}</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      {!canManage && myAppStatus && ['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(myAppStatus) && (
        <Panel
          title="Claim booked meeting"
          description="Submit notes from the live call. AI audits BANT + meeting set, then escrow releases to your Connect account."
        >
          <div className="stack" style={{ gap: '0.65rem', maxWidth: 520 }}>
            <input
              className="field"
              value={claimProspect}
              onChange={(e) => setClaimProspect(e.target.value)}
              placeholder="Prospect name / company"
            />
            <textarea
              className="field"
              rows={5}
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder="Call notes: who you spoke with, authority, need, meeting day/time agreed…"
            />
            <button
              type="button"
              className="btn"
              disabled={claimBusy || claimNotes.trim().length < 40}
              onClick={async () => {
                setClaimBusy(true);
                setErr('');
                setMsg('');
                const res = await fetch(`/api/campaigns/${id}/claims`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    notes: claimNotes,
                    prospectName: claimProspect || undefined,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                setClaimBusy(false);
                if (!res.ok) {
                  setErr(data.error || 'Claim failed audit');
                  return;
                }
                setMsg(data.notice || 'Claim submitted.');
                setClaimNotes('');
              }}
            >
              {claimBusy ? 'Auditing…' : 'Submit for AI audit + payout'}
            </button>
          </div>
        </Panel>
      )}
    </main>
  );
}
