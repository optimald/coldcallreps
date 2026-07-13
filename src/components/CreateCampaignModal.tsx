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
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  brandName?: string;
  packs?: PackOpt[];
  playbooks?: PlaybookOpt[];
  onCreated?: (campaignId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icpText, setIcpText] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [targetVertical, setTargetVertical] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [payoutDollars, setPayoutDollars] = useState('30');
  const [goalType, setGoalType] = useState('QUALIFIED_LEAD');
  const [status, setStatus] = useState('OPEN');
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
    setBusy(true);
    setMsg('');
    try {
      const payoutCents = Math.round(Number(payoutDollars) * 100);
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          title: title.trim(),
          description: description.trim(),
          icpText: icpText || undefined,
          bookingLink: bookingLink.trim() || undefined,
          targetVertical: targetVertical.trim() || undefined,
          targetLocation: targetLocation.trim() || undefined,
          payoutCents,
          goalType,
          status,
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
          Booking link (Cal.com / Calendly)
          <input
            className="field"
            value={bookingLink}
            onChange={(e) => setBookingLink(e.target.value)}
            placeholder="https://cal.com/you/intro"
          />
        </label>
        <div className="search-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          <label className="field-label" style={{ flex: '0 1 120px', maxWidth: 140 }}>
            Payout ($)
            <input
              className="field"
              value={payoutDollars}
              onChange={(e) => setPayoutDollars(e.target.value)}
              placeholder="30"
              inputMode="decimal"
            />
          </label>
          <label className="field-label" style={{ flex: '1 1 140px' }}>
            Outcome
            <select className="field" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
              <option value="QUALIFIED_LEAD">Qualified lead</option>
              <option value="BOOKED_MEETING">Booked meeting</option>
            </select>
          </label>
          <label className="field-label" style={{ flex: '1 1 120px' }}>
            Status
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="PAUSED">Paused</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
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
            Playbook
            <select
              className="field"
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
            >
              <option value="">None (optional)</option>
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
            disabled={busy || !title.trim() || !description.trim()}
            onClick={() => void create()}
          >
            {busy ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
