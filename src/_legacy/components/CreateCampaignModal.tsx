'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import {
  EARNINGS_MODEL_BLURBS,
  EARNINGS_MODEL_RANGES,
  type BudgetMode,
} from '@/lib/campaigns';
import {
  CALLING_TIMEZONE_OPTIONS,
  DEFAULT_CALLING_TIMEZONE,
  parseTimeToMinutes,
} from '@/lib/calling-hours';

type PackOpt = { id: string; name: string };
type PlaybookOpt = { id: string; title: string };
type EarningsModel = 'PER_BOOKED_MEETING' | 'PER_QUALIFIED_LEAD' | 'TIERED_ACCELERATOR';
type BaseCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

const BASE_PLACEHOLDERS: Record<BaseCadence, string> = {
  WEEKLY: '500',
  BIWEEKLY: '1000',
  MONTHLY: '1500',
};

const BASE_RANGE_HINT: Record<BaseCadence, string> = {
  WEEKLY: 'Recommended $250 – $750 / week.',
  BIWEEKLY: 'Recommended $500 – $1,500 / bi-week.',
  MONTHLY: 'Recommended $1,000 – $3,000 / month.',
};

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
  const [payoutDollars, setPayoutDollars] = useState('75');
  const [earningsModel, setEarningsModel] = useState<EarningsModel>('PER_BOOKED_MEETING');
  const [acceleratorStepSize, setAcceleratorStepSize] = useState('5');
  const [tier1Dollars, setTier1Dollars] = useState('50');
  const [tier2Dollars, setTier2Dollars] = useState('75');
  const [tier3Dollars, setTier3Dollars] = useState('100');
  const [baseEnabled, setBaseEnabled] = useState(false);
  const [baseCadence, setBaseCadence] = useState<BaseCadence>('MONTHLY');
  const [baseDollars, setBaseDollars] = useState('1500');
  const [status, setStatus] = useState('OPEN');
  const [budgetMode, setBudgetMode] = useState<BudgetMode | string>('OVERALL');
  const [budgetDollars, setBudgetDollars] = useState('400');
  const [dailyBudgetDollars, setDailyBudgetDollars] = useState('100');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState('');
  const [ongoing, setOngoing] = useState(true);
  const [callingHoursStart, setCallingHoursStart] = useState('09:00');
  const [callingHoursEnd, setCallingHoursEnd] = useState('17:00');
  const [callingTimezone, setCallingTimezone] = useState(DEFAULT_CALLING_TIMEZONE);
  const [limitCallingHours, setLimitCallingHours] = useState(true);
  const [packId, setPackId] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [packs, setPacks] = useState<PackOpt[]>(packsProp || []);
  const [playbooks, setPlaybooks] = useState<PlaybookOpt[]>(playbooksProp || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const wantsMeeting =
    earningsModel === 'PER_BOOKED_MEETING' || earningsModel === 'TIERED_ACCELERATOR';

  const earningsHint = useMemo(() => EARNINGS_MODEL_BLURBS[earningsModel], [earningsModel]);

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

  useEffect(() => {
    if (earningsModel === 'PER_BOOKED_MEETING') {
      setPayoutDollars(String(EARNINGS_MODEL_RANGES.PER_BOOKED_MEETING.suggestedCents / 100));
    } else if (earningsModel === 'PER_QUALIFIED_LEAD') {
      setPayoutDollars(String(EARNINGS_MODEL_RANGES.PER_QUALIFIED_LEAD.suggestedCents / 100));
    }
  }, [earningsModel]);

  useEffect(() => {
    if (!baseEnabled) return;
    setBaseDollars(BASE_PLACEHOLDERS[baseCadence]);
  }, [baseCadence, baseEnabled]);

  async function create() {
    if (!brandId || !title.trim() || !description.trim()) {
      setMsg('Title and description are required.');
      return;
    }
    if (!playbookId) {
      setMsg('Pick a playbook — every campaign needs a talk track for practice and live coach.');
      return;
    }
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
    if (earningsModel === 'TIERED_ACCELERATOR') {
      if (!acceleratorStepSize || Number(acceleratorStepSize) < 1) {
        setMsg('Set an accelerator step size (wins per rate tier).');
        return;
      }
      if (
        !tier1Dollars ||
        !tier2Dollars ||
        !tier3Dollars ||
        Number(tier1Dollars) <= 0 ||
        Number(tier2Dollars) <= 0 ||
        Number(tier3Dollars) <= 0
      ) {
        setMsg('Set all three accelerator tier rates.');
        return;
      }
    } else if (!payoutDollars || Number(payoutDollars) <= 0) {
      setMsg('Set a payout amount.');
      return;
    }
    if (baseEnabled && (!baseDollars || Number(baseDollars) <= 0)) {
      setMsg('Set a base pay amount, or turn base pay off.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const payoutCents =
        earningsModel === 'TIERED_ACCELERATOR'
          ? Math.round(Number(tier1Dollars) * 100)
          : Math.round(Number(payoutDollars) * 100);
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
          earningsModel,
          payoutCents,
          ...(earningsModel === 'TIERED_ACCELERATOR'
            ? {
                acceleratorStepSize: Math.round(Number(acceleratorStepSize)),
                acceleratorTier1Cents: Math.round(Number(tier1Dollars) * 100),
                acceleratorTier2Cents: Math.round(Number(tier2Dollars) * 100),
                acceleratorTier3Cents: Math.round(Number(tier3Dollars) * 100),
              }
            : {}),
          ...(baseEnabled
            ? {
                basePayCents: Math.round(Number(baseDollars) * 100),
                basePayCadence: baseCadence,
              }
            : {}),
          status,
          budgetMode,
          budgetCents,
          dailyBudgetCents,
          startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : undefined,
          endsAt:
            ongoing || !endsAt ? null : new Date(`${endsAt}T23:59:59`).toISOString(),
          ...(limitCallingHours
            ? {
                callingHoursStartMin: parseTimeToMinutes(callingHoursStart),
                callingHoursEndMin: parseTimeToMinutes(callingHoursEnd),
                callingTimezone,
              }
            : {
                callingHoursStartMin: null,
                callingHoursEndMin: null,
                callingTimezone: null,
              }),
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
      setEarningsModel('PER_BOOKED_MEETING');
      setPayoutDollars('75');
      setAcceleratorStepSize('5');
      setTier1Dollars('50');
      setTier2Dollars('75');
      setTier3Dollars('100');
      setBaseEnabled(false);
      setBaseCadence('MONTHLY');
      setBaseDollars('1500');
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
            placeholder="e.g. $75 booked meetings"
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
          SDR earnings
          <select
            className="field"
            value={earningsModel}
            onChange={(e) => setEarningsModel(e.target.value as EarningsModel)}
          >
            <option value="PER_BOOKED_MEETING">Per booked meeting (default)</option>
            <option value="PER_QUALIFIED_LEAD">Per qualified lead</option>
            <option value="TIERED_ACCELERATOR">Tiered / accelerator</option>
          </select>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {earningsHint}
        </p>

        {wantsMeeting ? (
          <label className="field-label">
            Booking link (Cal.com / Calendly / Google Appointment)
            <input
              className="field"
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
              placeholder="https://cal.com/you/intro"
              required
            />
          </label>
        ) : null}

        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          {wantsMeeting ? (
            <label className="field-label" style={{ flex: '0 1 140px', maxWidth: 160 }}>
              Meeting min
              <input
                className="field"
                value={meetingDuration}
                onChange={(e) => setMeetingDuration(e.target.value)}
                placeholder="15"
                inputMode="numeric"
              />
            </label>
          ) : null}

          {earningsModel === 'TIERED_ACCELERATOR' ? (
            <>
              <label className="field-label" style={{ flex: '0 1 100px', maxWidth: 120 }}>
                Step size
                <input
                  className="field"
                  value={acceleratorStepSize}
                  onChange={(e) => setAcceleratorStepSize(e.target.value)}
                  placeholder="5"
                  inputMode="numeric"
                />
              </label>
              <label className="field-label" style={{ flex: '0 1 100px', maxWidth: 120 }}>
                Tier 1 $
                <input
                  className="field"
                  value={tier1Dollars}
                  onChange={(e) => setTier1Dollars(e.target.value)}
                  placeholder="50"
                  inputMode="decimal"
                />
              </label>
              <label className="field-label" style={{ flex: '0 1 100px', maxWidth: 120 }}>
                Tier 2 $
                <input
                  className="field"
                  value={tier2Dollars}
                  onChange={(e) => setTier2Dollars(e.target.value)}
                  placeholder="75"
                  inputMode="decimal"
                />
              </label>
              <label className="field-label" style={{ flex: '0 1 100px', maxWidth: 120 }}>
                Tier 3 $
                <input
                  className="field"
                  value={tier3Dollars}
                  onChange={(e) => setTier3Dollars(e.target.value)}
                  placeholder="100"
                  inputMode="decimal"
                />
              </label>
            </>
          ) : (
            <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
              Payout ($)
              <input
                className="field"
                value={payoutDollars}
                onChange={(e) => setPayoutDollars(e.target.value)}
                placeholder={
                  earningsModel === 'PER_QUALIFIED_LEAD' ? '40' : '75'
                }
                inputMode="decimal"
              />
            </label>
          )}

          <label className="field-label" style={{ flex: '1 1 120px' }}>
            Activate
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OPEN">On (open now)</option>
              <option value="DRAFT">Off (save as draft)</option>
            </select>
          </label>
        </div>

        {earningsModel === 'TIERED_ACCELERATOR' ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
            First {acceleratorStepSize || '5'} wins pay Tier 1, next {acceleratorStepSize || '5'} pay
            Tier 2, then Tier 3+.
          </p>
        ) : null}

        <label
          className="field-label"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: 'row' }}
        >
          <input
            type="checkbox"
            checked={baseEnabled}
            onChange={(e) => setBaseEnabled(e.target.checked)}
          />
          Add base pay (on top of outcome pay)
        </label>
        {baseEnabled ? (
          <>
            <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
              <label className="field-label" style={{ flex: '1 1 140px' }}>
                Base cadence
                <select
                  className="field"
                  value={baseCadence}
                  onChange={(e) => setBaseCadence(e.target.value as BaseCadence)}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Bi-weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </label>
              <label className="field-label" style={{ flex: '0 1 140px', maxWidth: 160 }}>
                Base $ / period
                <input
                  className="field"
                  value={baseDollars}
                  onChange={(e) => setBaseDollars(e.target.value)}
                  placeholder={BASE_PLACEHOLDERS[baseCadence]}
                  inputMode="decimal"
                />
              </label>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
              Paid to each active SDR each period. {BASE_RANGE_HINT[baseCadence]}
            </p>
          </>
        ) : null}

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
        <label
          className="field-label"
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}
        >
          <input
            type="checkbox"
            checked={limitCallingHours}
            onChange={(e) => setLimitCallingHours(e.target.checked)}
          />
          Limit dialing to calling hours
        </label>
        {limitCallingHours ? (
          <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0, gap: '0.65rem' }}>
            <label className="field-label" style={{ flex: '0 1 120px' }}>
              Calls from
              <input
                className="field"
                type="time"
                value={callingHoursStart}
                onChange={(e) => setCallingHoursStart(e.target.value)}
              />
            </label>
            <label className="field-label" style={{ flex: '0 1 120px' }}>
              Calls until
              <input
                className="field"
                type="time"
                value={callingHoursEnd}
                onChange={(e) => setCallingHoursEnd(e.target.value)}
              />
            </label>
            <label className="field-label" style={{ flex: '1 1 160px' }}>
              Timezone
              <select
                className="field"
                value={callingTimezone}
                onChange={(e) => setCallingTimezone(e.target.value)}
              >
                {CALLING_TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/^America\//, '').replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {limitCallingHours
            ? 'Leads only appear in the SDR dial queue during these hours.'
            : 'SDRs can dial anytime within the campaign start/end dates.'}
        </p>
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
