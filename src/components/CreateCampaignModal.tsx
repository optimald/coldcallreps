'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';

type PackOpt = { id: string; name: string };
type PlaybookOpt = { id: string; title: string };

export default function CreateCampaignModal({
  open,
  onClose,
  brandId,
  brandName,
  packs: packsProp,
  playbooks: playbooksProp,
  initialPlaybookId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  brandName?: string;
  packs?: PackOpt[];
  playbooks?: PlaybookOpt[];
  initialPlaybookId?: string;
  onCreated?: (campaignId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icpText, setIcpText] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('15');
  const [targetVertical, setTargetVertical] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [payoutDollars, setPayoutDollars] = useState('40');
  const [qualifiedPayoutDollars, setQualifiedPayoutDollars] = useState('25');
  const [goalType, setGoalType] = useState('BOOKED_MEETING');
  const [status, setStatus] = useState('OPEN');
  const [budgetMode, setBudgetMode] = useState('OVERALL');
  const [budgetDollars, setBudgetDollars] = useState('400');
  const [dailyBudgetDollars, setDailyBudgetDollars] = useState('100');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState('');
  const [ongoing, setOngoing] = useState(true);
  const [packId, setPackId] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [packs, setPacks] = useState<PackOpt[]>(packsProp || []);
  const [playbooks, setPlaybooks] = useState<PlaybookOpt[]>(playbooksProp || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (packsProp) setPacks(packsProp);
    if (playbooksProp) setPlaybooks(playbooksProp);
  }, [packsProp, playbooksProp]);

  useEffect(() => {
    if (!open) return;
    if (initialPlaybookId && playbooks.some((p) => p.id === initialPlaybookId)) {
      setPlaybookId(initialPlaybookId);
      return;
    }
    if (!playbookId && playbooks[0]?.id) setPlaybookId(playbooks[0].id);
  }, [open, playbooks, playbookId, initialPlaybookId]);

  useEffect(() => {
    if (!open || !brandId) return;
    if (packsProp && playbooksProp) return;
    let cancelled = false;
    fetch(`/api/brands/${brandId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.brand) return;
        setPacks(d.brand.packs || []);
        setPlaybooks(d.brand.playbooks || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, brandId, packsProp, playbooksProp]);

  useEffect(() => {
    if (!open) {
      setMsg('');
      return;
    }
  }, [open]);

  async function create() {
    if (!brandId || !title.trim() || !description.trim()) {
      setMsg('Title and description are required.');
      return;
    }
    if (!playbookId) {
      setMsg('Pick a playbook — every campaign needs a talk track for practice and live coach.');
      return;
    }
    const wantsMeeting = goalType === 'BOOKED_MEETING' || goalType === 'BOTH';
    if (wantsMeeting && !bookingLink.trim()) {
      setMsg('Meeting campaigns need a Cal.com / Calendly / Google Appointment link.');
      return;
    }
    if (wantsMeeting && (!meetingDuration || Number(meetingDuration) < 5)) {
      setMsg('Set meeting duration (minutes).');
      return;
    }
    if (budgetMode === 'DAILY' && (!dailyBudgetDollars || Number(dailyBudgetDollars) <= 0)) {
      setMsg('Set a daily budget when using daily mode.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const payoutCents = Math.round(Number(payoutDollars) * 100);
      const qualifiedPayoutCents =
        goalType === 'BOTH' || goalType === 'QUALIFIED_LEAD'
          ? Math.round(Number(qualifiedPayoutDollars || payoutDollars) * 100)
          : undefined;
      const budgetCents = budgetDollars
        ? Math.round(Number(budgetDollars) * 100)
        : undefined;
      const dailyBudgetCents =
        budgetMode === 'DAILY' && dailyBudgetDollars
          ? Math.round(Number(dailyBudgetDollars) * 100)
          : undefined;
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          title: title.trim(),
          description: description.trim(),
          icpText: icpText || undefined,
          bookingLink: bookingLink.trim() || undefined,
          meetingDurationMinutes: wantsMeeting ? Math.round(Number(meetingDuration)) : undefined,
          targetVertical: targetVertical.trim() || undefined,
          targetLocation: targetLocation.trim() || undefined,
          payoutCents,
          qualifiedPayoutCents:
            goalType === 'BOTH' ? qualifiedPayoutCents : goalType === 'QUALIFIED_LEAD' ? payoutCents : undefined,
          goalType,
          status,
          budgetMode,
          budgetCents,
          dailyBudgetCents,
          startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : undefined,
          endsAt:
            ongoing || !endsAt ? null : new Date(`${endsAt}T23:59:59`).toISOString(),
          packId: packId || undefined,
          playbookId: playbookId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not create campaign');
        return;
      }
      const campaignId = data.campaign?.id || '';
      // Hands-off: if vertical+geo set, kick off P1→P2→P3 in background
      if (campaignId && targetVertical.trim() && targetLocation.trim()) {
        void fetch('/api/scrape/campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId,
            campaignId,
            query: targetVertical.trim(),
            location: targetLocation.trim(),
            maxResults: 10,
            async: true,
          }),
        }).catch(() => {});
      }
      setTitle('');
      setDescription('');
      setIcpText('');
      setBookingLink('');
      setTargetVertical('');
      setTargetLocation('');
      setPackId('');
      setPlaybookId('');
      onClose();
      onCreated?.(campaignId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New campaign"
      description={
        brandName
          ? `Post a paid outcome campaign for ${brandName}. OPEN campaigns appear on Brand deals.`
          : 'Post a paid outcome campaign. OPEN campaigns appear on Brand deals.'
      }
    >
      <div className="stack" style={{ gap: '0.65rem' }}>
        <label className="field-label">
          Title
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. $30 qualified leads"
            autoFocus
          />
        </label>
        <label className="field-label">
          Description
          <textarea
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What reps deliver, how you define a result, volume expectations…"
          />
        </label>
        <label className="field-label">
          ICP
          <textarea
            className="field"
            value={icpText}
            onChange={(e) => setIcpText(e.target.value)}
            rows={3}
            placeholder="Titles, company size, geography, triggers (optional)"
          />
        </label>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0, gap: '0.65rem' }}>
          <label className="field-label" style={{ flex: '1 1 140px' }}>
            Target vertical
            <input
              className="field"
              value={targetVertical}
              onChange={(e) => setTargetVertical(e.target.value)}
              placeholder="e.g. plumbers"
            />
          </label>
          <label className="field-label" style={{ flex: '1 1 140px' }}>
            Target location
            <input
              className="field"
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
              placeholder="e.g. Austin, TX"
            />
          </label>
        </div>
        <label className="field-label">
          Booking link (Cal.com / Calendly / Google Appointment)
          <input
            className="field"
            value={bookingLink}
            onChange={(e) => setBookingLink(e.target.value)}
            placeholder="https://cal.com/you/intro"
            required={goalType === 'BOOKED_MEETING' || goalType === 'BOTH'}
          />
        </label>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          <label className="field-label" style={{ flex: '0 1 140px', maxWidth: 160 }}>
            Meeting min
            <input
              className="field"
              value={meetingDuration}
              onChange={(e) => setMeetingDuration(e.target.value)}
              placeholder="15"
              inputMode="numeric"
              disabled={goalType === 'QUALIFIED_LEAD'}
            />
          </label>
          <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
            {goalType === 'BOTH' ? 'Meeting $' : 'Payout ($)'}
            <input
              className="field"
              value={payoutDollars}
              onChange={(e) => setPayoutDollars(e.target.value)}
              placeholder="40"
              inputMode="decimal"
            />
          </label>
          {goalType === 'BOTH' ? (
            <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
              Qualified $
              <input
                className="field"
                value={qualifiedPayoutDollars}
                onChange={(e) => setQualifiedPayoutDollars(e.target.value)}
                placeholder="25"
                inputMode="decimal"
              />
            </label>
          ) : null}
          <label className="field-label" style={{ flex: '1 1 160px' }}>
            Outcome
            <select className="field" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
              <option value="QUALIFIED_LEAD">Qualified lead</option>
              <option value="BOOKED_MEETING">Booked meeting</option>
              <option value="BOTH">Both (meeting pays more)</option>
            </select>
          </label>
          <label className="field-label" style={{ flex: '1 1 120px' }}>
            Activate
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OPEN">On (open now)</option>
              <option value="DRAFT">Off (save as draft)</option>
            </select>
          </label>
        </div>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0, gap: '0.65rem' }}>
          <label className="field-label" style={{ flex: '0 1 140px' }}>
            Start date
            <input
              className="field"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="field-label" style={{ flex: '0 1 140px' }}>
            End date
            <input
              className="field"
              type="date"
              value={endsAt}
              onChange={(e) => {
                setEndsAt(e.target.value);
                if (e.target.value) setOngoing(false);
              }}
              disabled={ongoing}
            />
          </label>
          <label
            className="field-label"
            style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: '0.4rem', paddingBottom: '0.35rem' }}
          >
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => {
                setOngoing(e.target.checked);
                if (e.target.checked) setEndsAt('');
              }}
            />
            Ongoing
          </label>
        </div>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0, gap: '0.65rem' }}>
          <label className="field-label" style={{ flex: '1 1 140px' }}>
            Budget mode
            <select
              className="field"
              value={budgetMode}
              onChange={(e) => setBudgetMode(e.target.value)}
            >
              <option value="OVERALL">Overall spend cap</option>
              <option value="DAILY">Daily spend cap</option>
            </select>
          </label>
          <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
            Overall $
            <input
              className="field"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              placeholder="400"
              inputMode="decimal"
            />
          </label>
          {budgetMode === 'DAILY' ? (
            <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
              Daily $
              <input
                className="field"
                value={dailyBudgetDollars}
                onChange={(e) => setDailyBudgetDollars(e.target.value)}
                placeholder="100"
                inputMode="decimal"
              />
            </label>
          ) : null}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          Budgets cap verified payouts. Pausing later only blocks new dials — live calls keep going.
        </p>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          <label className="field-label" style={{ flex: '1 1 160px' }}>
            Pack
            <select className="field" value={packId} onChange={(e) => setPackId(e.target.value)}>
              <option value="">None (optional)</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label" style={{ flex: '1 1 160px' }}>
            Playbook (required)
            <select
              className="field"
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
              required
            >
              <option value="">Select a playbook…</option>
              {playbooks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {msg ? <p className="msg-err" style={{ margin: 0 }}>{msg}</p> : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !title.trim() || !description.trim() || !playbookId}
            onClick={() => void create()}
          >
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
