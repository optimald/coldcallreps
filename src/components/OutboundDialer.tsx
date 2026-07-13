'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CheatSheetPanel, { type CheatSheetSection } from '@/components/CheatSheetPanel';
import FloatingCallWidget, { type CallDisposition } from '@/components/FloatingCallWidget';
import CallWrapUpPanel from '@/components/CallWrapUpPanel';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { MAX_DIAL_ATTEMPTS } from '@/lib/lead-queue-shared';
import { parseHooks as parseHooksPayload } from '@/lib/prospect-intel';

export type OutboundProspect = {
  id: string;
  companyName: string;
  phone: string | null;
  ownerName: string | null;
  ownerTitle?: string | null;
  city: string | null;
  status: string;
  website?: string | null;
  hooksJSON?: string | null;
  notes?: string | null;
  brandName?: string | null;
  brandSlug?: string | null;
  attemptCount?: number;
  nextCallAt?: string | null;
  lastDisposition?: string | null;
};

export type ColdCallGig = {
  id: string;
  campaignId: string;
  title: string;
  brandName: string;
  brandSlug?: string | null;
  status: string;
  packId?: string | null;
  playbookId?: string | null;
  goalType?: string | null;
  bookingLink?: string | null;
  meetingDurationMinutes?: number | null;
  payoutCents?: number | null;
  qualifiedPayoutCents?: number | null;
};

export type ColdCallPendingApp = {
  id: string;
  campaignId: string;
  title: string;
  brandName: string;
  status: string;
};

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

/** Stroke lock — same visual language as NavIcon / PhoneIcon (no emoji). */
function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function parseHooks(hooksJSON?: string | null): string[] {
  return parseHooksPayload(hooksJSON).slice(0, 4);
}

export default function OutboundDialer({
  campaignProspects,
  campaignId = null,
  activeGigs = [],
  pendingApps = [],
  hasAcceptedCampaign = false,
  initialLeadId = null,
}: {
  campaignProspects: OutboundProspect[];
  campaignId?: string | null;
  activeGigs?: ColdCallGig[];
  pendingApps?: ColdCallPendingApp[];
  hasAcceptedCampaign?: boolean;
  initialLeadId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId);
  const [manualNumber, setManualNumber] = useState('');
  const [activeProspectId, setActiveProspectId] = useState<string | null>(null);
  const [wrapNotes, setWrapNotes] = useState('');
  const [wrapDisposition, setWrapDisposition] = useState<CallDisposition | null>(null);
  const [wrapSaving, setWrapSaving] = useState(false);
  const [lastEnded, setLastEnded] = useState<{ duration: number; callLogId: string | null } | null>(
    null
  );
  const [bookingStarting, setBookingStarting] = useState(false);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [bookingEmbedUrl, setBookingEmbedUrl] = useState<string | null>(null);
  const [bookingProvider, setBookingProvider] = useState<string | undefined>();
  const [bookingBooked, setBookingBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const router = useRouter();
  const [cheatOpen, setCheatOpen] = useState(false);
  const [cheatSections, setCheatSections] = useState<CheatSheetSection[]>([]);
  const [cheatProductUrl, setCheatProductUrl] = useState<string | undefined>();
  const [cheatTrainingImages, setCheatTrainingImages] = useState<string[]>([]);
  const [cheatTrainingVideoUrl, setCheatTrainingVideoUrl] = useState<string | undefined>();
  const [cheatLoading, setCheatLoading] = useState(false);
  const [mobilePane, setMobilePane] = useState<'queue' | 'dial' | 'intel'>('dial');

  const withPhone = useMemo(
    () => campaignProspects.filter((p) => p.phone?.trim()),
    [campaignProspects]
  );

  const selected = useMemo(() => {
    const fromQueue = campaignProspects.find((p) => p.id === selectedId);
    if (fromQueue) return fromQueue;
    return withPhone[0] ?? campaignProspects[0] ?? null;
  }, [campaignProspects, selectedId, withPhone]);

  useEffect(() => {
    if (selectedId && campaignProspects.some((p) => p.id === selectedId)) return;
    const first = withPhone[0] ?? campaignProspects[0] ?? null;
    setSelectedId(first?.id ?? null);
  }, [campaignProspects, withPhone, selectedId]);

  // Hot-potato checkout when SDR selects a lead
  useEffect(() => {
    if (!hasAcceptedCampaign || !selectedId) return;
    let cancelled = false;
    void fetch(`/api/prospects/${selectedId}/checkout`, { method: 'POST' })
      .then(async (r) => {
        if (cancelled || r.ok) return;
        const data = await r.json().catch(() => ({}));
        if (data.error) console.warn('[checkout]', data.error);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, hasAcceptedCampaign]);

  const primaryGig = activeGigs[0] ?? null;
  const canManualDial = hasAcceptedCampaign;
  const meetingsEnabled =
    Boolean(primaryGig?.bookingLink) &&
    (primaryGig?.goalType === 'BOOKED_MEETING' || primaryGig?.goalType === 'BOTH');

  function resetBookingState() {
    setBookingStarting(false);
    setBookingToken(null);
    setBookingEmbedUrl(null);
    setBookingProvider(undefined);
    setBookingBooked(false);
    setBookingError(null);
  }

  async function startMeetingBooking() {
    if (!primaryGig?.campaignId || !meetingsEnabled) {
      setBookingError('This campaign has no booking link configured.');
      return;
    }
    setBookingStarting(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/bookings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: primaryGig.campaignId,
          callLogId: lastEnded?.callLogId || undefined,
          prospectId: selected?.id || activeProspectId || undefined,
          prospectName: selected?.ownerName || selected?.companyName || undefined,
          notes: wrapNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBookingError(data.error || 'Could not start booking');
        return;
      }
      setBookingToken(data.token);
      setBookingEmbedUrl(data.embedUrl);
      setBookingProvider(data.provider);
    } catch (e: unknown) {
      setBookingError(e instanceof Error ? e.message : 'Could not start booking');
    } finally {
      setBookingStarting(false);
    }
  }

  const {
    isConnected,
    isCallActive,
    isMuted,
    callDuration,
    callerNumber,
    fromNumber,
    matchedLocal,
    brandName: dialBrandName,
    error,
    configured,
    makeCall,
    endCall,
    toggleMute,
    currentCallLogId,
    incomingFrom,
    incomingCall,
  } = useTwilioCall({
    onCallEnded: (duration, callLogId) => {
      setLastEnded({ duration, callLogId });
    },
  });

  useEffect(() => {
    if (!lastEnded) return;
    setWrapNotes('');
  }, [lastEnded?.callLogId, lastEnded?.duration]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCall(phone: string, prospectId?: string) {
    if (!hasAcceptedCampaign) return;
    setLastEnded(null);
    setWrapNotes('');
    setWrapDisposition(null);
    resetBookingState();
    setActiveProspectId(prospectId || null);
    if (prospectId) setSelectedId(prospectId);
    await makeCall(phone, prospectId, undefined, campaignId || undefined);
  }

  async function saveOutboundWrap() {
    if (!wrapDisposition) return;
    if (wrapDisposition === 'appointment_set' && meetingsEnabled && !bookingBooked) {
      setBookingError('Confirm the calendar booking before saving.');
      return;
    }
    if (!lastEnded?.callLogId && !currentCallLogId) {
      setLastEnded(null);
      setActiveProspectId(null);
      resetBookingState();
      return;
    }
    setWrapSaving(true);
    try {
      const id = lastEnded?.callLogId || currentCallLogId;
      await fetch('/api/calls/outbound', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: id,
          outcome: wrapDisposition,
          notes: wrapNotes,
          status: 'completed',
        }),
      });
      setLastEnded(null);
      setWrapNotes('');
      setWrapDisposition(null);
      setActiveProspectId(null);
      resetBookingState();
    } finally {
      setWrapSaving(false);
    }
  }

  function skipOutboundWrap() {
    setLastEnded(null);
    setWrapNotes('');
    setWrapDisposition(null);
    setActiveProspectId(null);
    resetBookingState();
  }

  function openLeadRecord() {
    if (!selected) return;
    router.push(`/leads/${selected.id}?from=cold_calls`);
  }

  const openCheatSheet = useCallback(async () => {
    setCheatOpen(true);
    setCheatLoading(true);
    try {
      const res = await fetch('/api/trainer/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: 'budget_500',
          difficulty: 'medium',
          prospectId: selected?.id || undefined,
          playbookId: primaryGig?.playbookId || undefined,
        }),
      });
      const data = await res.json();
      setCheatSections(data.sections || []);
      let productUrl = typeof data.productUrl === 'string' ? data.productUrl : undefined;
      let trainingImages = Array.isArray(data.trainingImages)
        ? data.trainingImages.map(String)
        : [];
      let trainingVideoUrl =
        typeof data.trainingVideoUrl === 'string' ? data.trainingVideoUrl : undefined;

      if (
        primaryGig?.playbookId &&
        (!productUrl || !trainingImages.length || !trainingVideoUrl)
      ) {
        try {
          const pbRes = await fetch(`/api/playbooks/${primaryGig.playbookId}`);
          if (pbRes.ok) {
            const pbData = await pbRes.json();
            const content = JSON.parse(pbData?.playbook?.contentJSON || '{}');
            if (!productUrl && typeof content.productUrl === 'string') {
              productUrl = content.productUrl;
            }
            if (!trainingImages.length && Array.isArray(content.trainingImages)) {
              trainingImages = content.trainingImages.map(String);
            }
            if (!trainingVideoUrl && typeof content.trainingVideoUrl === 'string') {
              trainingVideoUrl = content.trainingVideoUrl;
            }
          }
        } catch {
          /* ignore fallback errors */
        }
      }

      setCheatProductUrl(productUrl);
      setCheatTrainingImages(trainingImages);
      setCheatTrainingVideoUrl(trainingVideoUrl);
    } catch {
      setCheatSections([]);
      setCheatProductUrl(undefined);
      setCheatTrainingImages([]);
      setCheatTrainingVideoUrl(undefined);
    } finally {
      setCheatLoading(false);
    }
  }, [selected?.id, primaryGig?.playbookId]);

  const hooks = parseHooks(selected?.hooksJSON);

  return (
    <>
      <div className="cc-desk" data-mobile-pane={mobilePane}>
        <div className="cc-desk__mobile-tabs" role="tablist" aria-label="Cold call panels">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'queue'}
            className={`cc-desk__mobile-tab${mobilePane === 'queue' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('queue')}
          >
            Queue
            <span className="cc-desk__mobile-tab-count">
              {hasAcceptedCampaign ? withPhone.length : 0}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'dial'}
            className={`cc-desk__mobile-tab${mobilePane === 'dial' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('dial')}
          >
            Dial
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'intel'}
            className={`cc-desk__mobile-tab${mobilePane === 'intel' ? ' is-active' : ''}`}
            onClick={() => setMobilePane('intel')}
          >
            Intel
          </button>
        </div>

        {/* Left: campaign queue */}
        <section className="cc-desk__col cc-desk__queue" aria-label="Call queue">
          <div className="cc-desk__col-head">
            <strong>Dial queue</strong>
            <span
              className="cc-desk__tab-count"
              title={hasAcceptedCampaign ? undefined : 'Locked until a brand accepts you'}
              aria-label={hasAcceptedCampaign ? undefined : 'Locked'}
            >
              {hasAcceptedCampaign ? withPhone.length : <LockIcon size={12} />}
            </span>
          </div>

          <div className="cc-desk__col-body">
            {!hasAcceptedCampaign ? (
              <div className="cc-desk__gate">
                <span className="cc-desk__gate-icon" aria-hidden>
                  <LockIcon size={18} />
                </span>
                <p className="cc-desk__gate-title">Campaign dials locked</p>
                <p className="cc-desk__gate-desc">
                  Apply to a brand deal, then wait for the brand to accept you. Warm up on Practice anytime —
                  this desk is for paid outbound only.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link href="/gigs" className="btn">
                    Browse brand deals
                  </Link>
                  <Link href="/practice" className="btn-ghost">
                    Practice →
                  </Link>
                </div>
                {pendingApps.length > 0 && (
                  <ul className="cc-desk__pending">
                    {pendingApps.map((a) => (
                      <li key={a.id}>
                        <Link href={`/campaigns/${a.campaignId}`}>
                          {a.title}
                          <span className="muted"> · {a.brandName} · pending</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : withPhone.length === 0 ? (
              <div className="cc-desk__gate">
                <p className="cc-desk__gate-title">No campaign leads yet</p>
                <p className="cc-desk__gate-desc">
                  Your accepted brand deal has no dialable leads yet. Ask the brand to load contacts.
                </p>
                <Link href="/gigs" className="btn-ghost">
                  Browse brand deals →
                </Link>
              </div>
            ) : (
              <ul className="cc-desk__list">
                {withPhone.map((p) => {
                  const isSelected = selected?.id === p.id;
                  const isLive = activeProspectId === p.id && isCallActive;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`cc-desk__row${isSelected ? ' is-selected' : ''}${isLive ? ' is-live' : ''}`}
                        onClick={() => {
                          setSelectedId(p.id);
                          setMobilePane('dial');
                        }}
                      >
                        <span className="cc-desk__row-main">
                          <span className="cc-desk__row-name">{p.companyName}</span>
                          <span className="cc-desk__row-meta">
                            {p.ownerName || '—'}
                            {p.city ? ` · ${p.city}` : ''}
                            {typeof p.attemptCount === 'number'
                              ? ` · try ${p.attemptCount + 1}/${MAX_DIAL_ATTEMPTS}`
                              : ''}
                          </span>
                          <span className="cc-desk__row-phone">{p.phone}</span>
                        </span>
                        {isLive && <span className="cc-desk__live-dot" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="cc-desk__col-foot">
            <Link href="/gigs" className="cc-desk__foot-link">
              Browse brand deals →
            </Link>
          </div>
        </section>

        {/* Center: dialer */}
        <section className="cc-desk__col cc-desk__dialer" aria-label="Dialer">
          <div className="cc-desk__col-head">
            <strong>Campaign dial</strong>
            <span className="cc-desk__status muted">
              {configured === false
                ? 'Twilio not configured'
                : configured === true
                  ? isConnected
                    ? 'Ready'
                    : 'Connecting…'
                  : '…'}
            </span>
          </div>

          <div className="cc-desk__col-body cc-desk__dialer-body">
            {(incomingCall || (incomingFrom && isCallActive)) && !lastEnded && (
              <div className="cc-desk__live-bar" style={{ borderColor: 'var(--mint, var(--accent-2))' }}>
                <div className="cc-desk__live-info">
                  <span className="cc-desk__live-dot" />
                  <div>
                    <strong>Inbound callback</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {incomingFrom || callerNumber}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="cc-desk__error" role="alert">
                {error}
              </p>
            )}

            {lastEnded ? (
              <CallWrapUpPanel
                companyName={selected?.companyName || 'Outbound call'}
                durationSecs={lastEnded.duration}
                notes={wrapNotes}
                onNotesChange={setWrapNotes}
                disposition={wrapDisposition}
                onDisposition={(id) => {
                  setWrapDisposition(id);
                  if (id !== 'appointment_set') resetBookingState();
                }}
                onSave={() => void saveOutboundWrap()}
                onSkip={skipOutboundWrap}
                onEditLead={selected ? openLeadRecord : undefined}
                saving={wrapSaving}
                mode="outbound"
                meetingBooking={
                  meetingsEnabled
                    ? {
                        enabled: true,
                        token: bookingToken,
                        embedUrl: bookingEmbedUrl,
                        provider: bookingProvider,
                        meetingDurationMinutes: primaryGig?.meetingDurationMinutes,
                        starting: bookingStarting,
                        booked: bookingBooked,
                        error: bookingError,
                        onStart: () => void startMeetingBooking(),
                        onBooked: () => {
                          setBookingBooked(true);
                          setBookingError(null);
                        },
                      }
                    : null
                }
              />
            ) : (
              <>
                {hasAcceptedCampaign && (
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                    Caller ID uses the brand&apos;s local pool (never your personal number). Callbacks
                    route to you for 48 hours after you dial.
                  </p>
                )}

                {selected && hasAcceptedCampaign && !isCallActive ? (
                  <div className="cc-desk__start-strip">
                    <button
                      type="button"
                      className="btn cc-desk__call-btn"
                      disabled={!selected.phone}
                      onClick={() => selected.phone && void startCall(selected.phone, selected.id)}
                    >
                      <PhoneIcon />
                      Call
                    </button>
                  </div>
                ) : !hasAcceptedCampaign ? (
                  <div className="cc-desk__idle">
                    <span className="cc-desk__gate-icon" aria-hidden>
                      <LockIcon size={18} />
                    </span>
                    <p className="cc-desk__gate-title">Waiting on brand accept</p>
                    <p className="cc-desk__gate-desc">
                      Warm up with AI voice on Practice, or browse brand deals to apply for paid dials.
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                      }}
                    >
                      <Link href="/practice" className="btn-ghost">
                        Open Practice
                      </Link>
                      <Link href="/gigs" className="btn">
                        Browse brand deals
                      </Link>
                    </div>
                  </div>
                ) : !selected ? (
                  <div className="cc-desk__idle">
                    <p className="cc-desk__gate-title">Select a lead</p>
                    <p className="cc-desk__gate-desc">Pick someone from the queue to dial.</p>
                  </div>
                ) : null}

                {canManualDial && !isCallActive && (
                  <div className="cc-desk__manual">
                    <label className="cc-desk__manual-label" htmlFor="cc-manual-dial">
                      Manual dial (accepted campaigns)
                    </label>
                    <div className="cc-desk__manual-row">
                      <input
                        id="cc-manual-dial"
                        type="tel"
                        className="field"
                        placeholder="Campaign number"
                        value={manualNumber}
                        onChange={(e) => setManualNumber(e.target.value)}
                        disabled={isCallActive}
                      />
                      <button
                        type="button"
                        className="btn"
                        disabled={isCallActive || !manualNumber.trim()}
                        onClick={() => void startCall(manualNumber.trim())}
                      >
                        <PhoneIcon />
                        Call
                      </button>
                    </div>
                  </div>
                )}

                {configured === false && (
                  <p className="cc-desk__twilio-hint muted">
                    Voice needs Twilio env vars. Point the TwiML App Voice URL to{' '}
                    <code>/api/twilio/voice</code>.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Right: context */}
        <section className="cc-desk__col cc-desk__context" aria-label="Lead context">
          <div className="cc-desk__col-head">
            <strong>Context</strong>
            {selected && hasAcceptedCampaign ? (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                onClick={openLeadRecord}
              >
                Lead details
              </button>
            ) : null}
          </div>
          <div className="cc-desk__col-body">
            {selected && hasAcceptedCampaign ? (
              <>
                <div className="cc-desk__ctx-block">
                  <h3 className="cc-desk__ctx-title">{selected.companyName}</h3>
                  <dl className="cc-desk__ctx-dl">
                    <div>
                      <dt>Contact</dt>
                      <dd>
                        {selected.ownerName || '—'}
                        {selected.ownerTitle ? ` · ${selected.ownerTitle}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>{selected.city || '—'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.status}</dd>
                    </div>
                    {selected.website && (
                      <div>
                        <dt>Web</dt>
                        <dd>
                          <a
                            href={
                              selected.website.startsWith('http')
                                ? selected.website
                                : `https://${selected.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {selected.website.replace(/^https?:\/\//, '')}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {hooks.length > 0 && (
                  <div className="cc-desk__ctx-block">
                    <h4 className="cc-desk__ctx-label">Hooks</h4>
                    <ul className="cc-desk__hooks">
                      {hooks.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.notes && (
                  <div className="cc-desk__ctx-block">
                    <h4 className="cc-desk__ctx-label">Notes</h4>
                    <p className="cc-desk__notes">{selected.notes}</p>
                  </div>
                )}

                <div className="cc-desk__ctx-block">
                  <h4 className="cc-desk__ctx-label">Callbacks</h4>
                  <p className="cc-desk__gate-desc" style={{ marginBottom: '0.65rem' }}>
                    After you dial, inbound callbacks to the brand’s local number ring your browser
                    for 48 hours. If you’re offline, the brand fallback line answers.
                  </p>
                </div>

                <div className="cc-desk__ctx-block">
                  <h4 className="cc-desk__ctx-label">Playbook</h4>
                  {primaryGig?.playbookId || primaryGig?.packId ? (
                    <p className="cc-desk__gate-desc" style={{ marginBottom: '0.65rem' }}>
                      Talk track for {primaryGig.title}. Warm up in Practice before paid dials.
                    </p>
                  ) : (
                    <p className="cc-desk__gate-desc" style={{ marginBottom: '0.65rem' }}>
                      Open cues for this lead, or warm up with AI voice on Practice.
                    </p>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => void openCheatSheet()}>
                    Review playbook →
                  </button>
                </div>
              </>
            ) : (
              <div className="cc-desk__gate">
                {!hasAcceptedCampaign ? (
                  <span className="cc-desk__gate-icon" aria-hidden>
                    <LockIcon size={18} />
                  </span>
                ) : null}
                <p className="cc-desk__gate-title">
                  {!hasAcceptedCampaign ? 'Unlock campaign context' : 'No lead selected'}
                </p>
                <p className="cc-desk__gate-desc">
                  {!hasAcceptedCampaign
                    ? 'After a brand accepts your application, lead details and the playbook to review before dialing show here.'
                    : 'Select a queue row to see contact details, hooks, and playbook links.'}
                </p>
                {activeGigs.length > 0 && (
                  <ul className="cc-desk__pending">
                    {activeGigs.map((g) => (
                      <li key={g.id}>
                        <Link href={`/campaigns/${g.campaignId}`}>
                          {g.title}
                          <span className="muted">
                            {' '}
                            · {g.brandName} · {g.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!hasAcceptedCampaign && (
                  <Link href="/practice" className="btn-ghost" style={{ marginTop: '0.65rem' }}>
                    Warm up on Practice →
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <FloatingCallWidget
        open={isCallActive && !lastEnded}
        title={selected?.companyName || callerNumber || 'Outbound call'}
        subtitle={
          fromNumber
            ? `CID ${fromNumber}${matchedLocal ? ' · local' : ''}${dialBrandName ? ` · ${dialBrandName}` : ''}`
            : callerNumber || undefined
        }
        statusLabel={incomingCall || incomingFrom ? 'Inbound / on call' : 'On call'}
        durationSecs={callDuration}
        onEnd={endCall}
        endLabel="Hang up"
        muted={isMuted}
        onToggleMute={toggleMute}
        dispositions
        onQuickDisposition={(id) => {
          setWrapDisposition(id);
          endCall();
        }}
      />

      <CheatSheetPanel
        open={cheatOpen}
        onClose={() => setCheatOpen(false)}
        sections={cheatSections}
        loading={cheatLoading}
        productUrl={cheatProductUrl}
        trainingImages={cheatTrainingImages}
        trainingVideoUrl={cheatTrainingVideoUrl}
      />
    </>
  );
}
