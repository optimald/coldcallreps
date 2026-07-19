'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SetupProposal } from '@/lib/setup/proposal-schema';
import type { PreflightItem } from '@/lib/setup/launch-preflight';
import { brandHref } from '@/lib/brand-context';
import { minutesToTime } from '@/lib/calling-hours';

type Step = 'input' | 'generating' | 'review' | 'applying' | 'launch';

type Props = {
  /** When set, setup attaches pack/playbook/campaign to this brand. */
  brandId?: string | null;
  brandSlug?: string | null;
  brandName?: string | null;
  websiteUrlPrefill?: string | null;
  /** Onboarding: unlock brand role on apply. */
  mode?: 'desk' | 'onboarding';
  /** Jump straight to launch checklist. */
  initialCampaignId?: string | null;
  onDone?: (result: { brandSlug: string; campaignId: string }) => void;
};

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(0);
}

function Card({
  title,
  children,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ai-setup-card">
      <header className="ai-setup-card__head">
        {eyebrow ? <p className="muted ai-setup-card__eyebrow">{eyebrow}</p> : null}
        <h2 className="ai-setup-card__title">{title}</h2>
      </header>
      <div className="ai-setup-card__body">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="ai-setup-field">
      <span className="muted ai-setup-field__label">{label}</span>
      {children}
    </label>
  );
}

export default function AiSetupWizard({
  brandId = null,
  brandSlug = null,
  brandName = null,
  websiteUrlPrefill = null,
  mode = 'desk',
  initialCampaignId = null,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>(initialCampaignId ? 'launch' : 'input');
  const [websiteUrl, setWebsiteUrl] = useState(websiteUrlPrefill || '');
  const [brief, setBrief] = useState('');
  const [proposal, setProposal] = useState<SetupProposal | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [campaignId, setCampaignId] = useState<string | null>(initialCampaignId);
  const [appliedBrand, setAppliedBrand] = useState<{
    id: string;
    slug: string;
    name: string;
  } | null>(
    brandId && brandSlug
      ? { id: brandId, slug: brandSlug, name: brandName || brandSlug }
      : null
  );
  const [preflightItems, setPreflightItems] = useState<PreflightItem[]>([]);
  const [preflightReady, setPreflightReady] = useState(false);
  const [bookingLinkDraft, setBookingLinkDraft] = useState('');
  const [scoutLeads, setScoutLeads] = useState(false);
  const [hasScoutTarget, setHasScoutTarget] = useState(false);

  const shellClass =
    mode === 'onboarding' ? 'ai-setup ai-setup--embedded' : 'app-page app-page--desk ai-setup';

  const loadPreflight = useCallback(async (bId: string, cId: string) => {
    const res = await fetch(
      `/api/setup/preflight?brandId=${encodeURIComponent(bId)}&campaignId=${encodeURIComponent(cId)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || 'Could not load launch checklist');
      return;
    }
    setPreflightItems(data.items || []);
    setPreflightReady(Boolean(data.ready));
    setHasScoutTarget(
      Boolean(data.campaign?.targetVertical && data.campaign?.targetLocation)
    );
  }, []);

  useEffect(() => {
    if (step !== 'launch' || !campaignId) return;
    const bId = appliedBrand?.id || brandId;
    if (!bId) return;
    void loadPreflight(bId, campaignId);
  }, [step, campaignId, appliedBrand?.id, brandId, loadPreflight]);

  async function generate() {
    setMsg('');
    if (!websiteUrl.trim()) {
      setMsg('Paste your company website URL.');
      return;
    }
    setBusy(true);
    setStep('generating');
    try {
      const res = await fetch('/api/setup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          brief: brief.trim(),
          brandId: brandId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not generate setup');
        setStep('input');
        return;
      }
      setProposal(data.proposal);
      setProposalId(data.proposalId || null);
      setStep('review');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not generate setup');
      setStep('input');
    } finally {
      setBusy(false);
    }
  }

  async function refine() {
    if (!proposal || !refineText.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/setup/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal,
          proposalId,
          instruction: refineText.trim(),
          brandId: brandId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not refine');
        return;
      }
      setProposal(data.proposal);
      setProposalId(data.proposalId || proposalId);
      setRefineText('');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not refine');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!proposal) return;
    setBusy(true);
    setMsg('');
    setStep('applying');
    try {
      const idempotencyKey =
        proposalId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `setup-${Date.now()}`);
      const res = await fetch('/api/setup/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal,
          brandId: brandId || undefined,
          idempotencyKey,
          unlockBrandRole: mode === 'onboarding' && !brandId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not save draft');
        setStep('review');
        return;
      }
      setAppliedBrand(data.brand);
      setCampaignId(data.campaignId);
      setBookingLinkDraft(proposal.campaign.bookingLink || '');
      setStep('launch');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not save draft');
      setStep('review');
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    const bId = appliedBrand?.id || brandId;
    if (!bId || !campaignId) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/setup/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: bId,
          campaignId,
          bookingLink: bookingLinkDraft.trim() || undefined,
          scoutLeads,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.preflight?.items) {
          setPreflightItems(data.preflight.items);
          setPreflightReady(Boolean(data.preflight.ready));
        }
        setMsg(data.error || 'Could not launch');
        await loadPreflight(bId, campaignId);
        return;
      }
      const slug = appliedBrand?.slug || brandSlug || data.campaign?.brand?.slug;
      if (slug && onDone) {
        onDone({ brandSlug: slug, campaignId });
      } else if (slug) {
        window.location.href = brandHref(slug, 'campaigns', campaignId);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Could not launch');
    } finally {
      setBusy(false);
    }
  }

  const updateProposal = useCallback(
    (path: string, value: unknown) => {
      setProposal((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        const [root, key] = path.split('.') as [keyof SetupProposal, string];
        if (root === 'brand' || root === 'pack' || root === 'playbook' || root === 'campaign') {
          (next[root] as Record<string, unknown>)[key] = value;
        }
        return next;
      });
    },
    []
  );

  const payoutDollars = useMemo(() => {
    if (!proposal) return '40';
    return dollarsFromCents(proposal.campaign.payoutCents);
  }, [proposal]);

  const manualHref =
    mode === 'onboarding'
      ? '/onboarding/brand?manual=1'
      : brandSlug
        ? brandHref(brandSlug, 'campaigns')
        : '/brands';

  const Root = mode === 'onboarding' ? 'div' : 'main';

  return (
    <Root className={shellClass}>
      <div className={`ai-setup__inner${mode === 'onboarding' ? ' ai-setup__inner--onboarding' : ''}`}>
        <header className="ai-setup__head">
          <p className="page-eyebrow">AI setup</p>
          <h1 className="page-title">
            {step === 'launch' ? 'Launch checklist' : 'Configure with AI'}
          </h1>
          <p className="page-desc">
            {step === 'launch'
              ? 'Draft saved. Finish phone, wallet, and booking — then open the campaign.'
              : 'Paste your website. We draft brand positioning, playbook, and a campaign — you review before anything goes live.'}
          </p>
        </header>

        {msg ? (
          <p className="msg-err" role="status">
            {msg}
          </p>
        ) : null}

        {(step === 'input' || step === 'generating') && (
          <div className="ai-setup-card">
            <div className="ai-setup-card__body stack" style={{ gap: '0.85rem' }}>
              <Field label="Company website">
                <input
                  className="field"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  inputMode="url"
                  disabled={busy}
                />
              </Field>
              <Field label="Brief (optional)">
                <textarea
                  className="field"
                  rows={4}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. Book $40 discovery meetings with HVAC founders in Texas. 20-min founder calls."
                  disabled={busy}
                />
              </Field>
              <div className="ai-setup__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !websiteUrl.trim()}
                  onClick={() => void generate()}
                >
                  {busy ? 'Researching…' : 'Generate setup'}
                </button>
                <Link href={manualHref} className="btn-ghost">
                  {mode === 'onboarding' ? 'Manual form instead' : 'Advanced / manual'}
                </Link>
              </div>
            </div>
          </div>
        )}

        {step === 'review' && proposal ? (
          <div className="ai-setup-review">
            <div className="ai-setup-review__grid">
              <Card title={proposal.brand.name} eyebrow="Brand">
                <Field label="Name">
                  <input
                    className="field"
                    value={proposal.brand.name}
                    onChange={(e) => updateProposal('brand.name', e.target.value)}
                    disabled={Boolean(brandId)}
                  />
                </Field>
                <Field label="Website">
                  <input
                    className="field"
                    value={proposal.brand.websiteUrl}
                    onChange={(e) => updateProposal('brand.websiteUrl', e.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className="field"
                    rows={3}
                    value={proposal.brand.description}
                    onChange={(e) => updateProposal('brand.description', e.target.value)}
                  />
                </Field>
              </Card>

              <Card title={proposal.pack.name} eyebrow="Pack / ICP">
                <Field label="Vertical">
                  <input
                    className="field"
                    value={proposal.pack.icp.vertical || ''}
                    onChange={(e) =>
                      setProposal((p) =>
                        p
                          ? {
                              ...p,
                              pack: {
                                ...p.pack,
                                icp: { ...p.pack.icp, vertical: e.target.value },
                              },
                            }
                          : p
                      )
                    }
                  />
                </Field>
                <Field label="Buyer titles (comma-separated)">
                  <input
                    className="field"
                    value={(proposal.pack.icp.titles || []).join(', ')}
                    onChange={(e) =>
                      setProposal((p) =>
                        p
                          ? {
                              ...p,
                              pack: {
                                ...p.pack,
                                icp: {
                                  ...p.pack.icp,
                                  titles: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                },
                              },
                            }
                          : p
                      )
                    }
                  />
                </Field>
                <Field label="Pain">
                  <textarea
                    className="field"
                    rows={2}
                    value={proposal.pack.icp.pain || ''}
                    onChange={(e) =>
                      setProposal((p) =>
                        p
                          ? {
                              ...p,
                              pack: {
                                ...p.pack,
                                icp: { ...p.pack.icp, pain: e.target.value },
                              },
                            }
                          : p
                      )
                    }
                  />
                </Field>
              </Card>

              <Card title={proposal.playbook.title} eyebrow="Playbook">
                <Field label="Title">
                  <input
                    className="field"
                    value={proposal.playbook.title}
                    onChange={(e) => updateProposal('playbook.title', e.target.value)}
                  />
                </Field>
                <div className="ai-setup-steps">
                  {proposal.playbook.steps.map((s, idx) => (
                    <div key={idx} className="ai-setup-step">
                      <strong>
                        {idx + 1}. {s.title}
                      </strong>
                      <textarea
                        className="field"
                        rows={3}
                        value={s.script}
                        onChange={(e) => {
                          const script = e.target.value;
                          setProposal((p) => {
                            if (!p) return p;
                            const steps = p.playbook.steps.map((st, i) =>
                              i === idx ? { ...st, script } : st
                            );
                            return { ...p, playbook: { ...p.playbook, steps } };
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title={proposal.campaign.title} eyebrow="Campaign (draft)">
                <Field label="Title">
                  <input
                    className="field"
                    value={proposal.campaign.title}
                    onChange={(e) => updateProposal('campaign.title', e.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className="field"
                    rows={3}
                    value={proposal.campaign.description}
                    onChange={(e) => updateProposal('campaign.description', e.target.value)}
                  />
                </Field>
                <div className="ai-setup-inline">
                  <Field label="Payout ($)">
                    <input
                      className="field"
                      type="number"
                      min={5}
                      max={500}
                      value={payoutDollars}
                      onChange={(e) =>
                        updateProposal(
                          'campaign.payoutCents',
                          Math.round(Number(e.target.value || 0) * 100)
                        )
                      }
                    />
                  </Field>
                  <Field label="Meeting (min)">
                    <input
                      className="field"
                      type="number"
                      min={5}
                      max={180}
                      value={proposal.campaign.meetingDurationMinutes ?? 20}
                      onChange={(e) =>
                        updateProposal(
                          'campaign.meetingDurationMinutes',
                          Math.round(Number(e.target.value || 20))
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="ai-setup-inline">
                  <Field label="Target vertical">
                    <input
                      className="field"
                      value={proposal.campaign.targetVertical || ''}
                      onChange={(e) =>
                        updateProposal('campaign.targetVertical', e.target.value || null)
                      }
                      placeholder="optional — for Maps scout"
                    />
                  </Field>
                  <Field label="Target location">
                    <input
                      className="field"
                      value={proposal.campaign.targetLocation || ''}
                      onChange={(e) =>
                        updateProposal('campaign.targetLocation', e.target.value || null)
                      }
                      placeholder="optional"
                    />
                  </Field>
                </div>
                {(proposal.campaign.callingHoursStartMin != null ||
                  proposal.campaign.callingHoursEndMin != null) && (
                  <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                    Calling hours:{' '}
                    {minutesToTime(proposal.campaign.callingHoursStartMin)}–
                    {minutesToTime(proposal.campaign.callingHoursEndMin)}{' '}
                    {proposal.campaign.callingTimezone || ''}
                  </p>
                )}
              </Card>
            </div>

            {(proposal.assumptions.length > 0 || proposal.missing.length > 0) && (
              <Card title="Assumptions & gaps" eyebrow={`Confidence: ${proposal.confidence}`}>
                {proposal.assumptions.length ? (
                  <ul className="ai-setup-list">
                    {proposal.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : null}
                {proposal.missing.length ? (
                  <>
                    <p className="muted" style={{ marginBottom: '0.35rem' }}>
                      Still needed before launch:
                    </p>
                    <ul className="ai-setup-list ai-setup-list--warn">
                      {proposal.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </Card>
            )}

            <Card title="Ask AI to change…" eyebrow="Refine">
              <div className="ai-setup__actions" style={{ alignItems: 'stretch' }}>
                <input
                  className="field"
                  style={{ flex: 1 }}
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  placeholder='e.g. "make the open sharper" or "payout $50"'
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void refine();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy || !refineText.trim()}
                  onClick={() => void refine()}
                >
                  {busy ? 'Updating…' : 'Refine'}
                </button>
              </div>
            </Card>

            <div className="ai-setup__actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void apply()}
              >
                Save as draft
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  setStep('input');
                  setProposal(null);
                }}
              >
                Start over
              </button>
            </div>
          </div>
        ) : null}

        {step === 'applying' ? (
          <p className="muted">Saving draft brand, playbook, and campaign…</p>
        ) : null}

        {step === 'launch' && (appliedBrand || brandId) && campaignId ? (
          <div className="stack" style={{ gap: '1rem' }}>
            <Card title="Before you open" eyebrow="Preflight">
              <ul className="ai-setup-checklist">
                {preflightItems.map((item) => (
                  <li
                    key={item.code}
                    className={
                      item.ok
                        ? 'ai-setup-checklist__item is-ok'
                        : 'ai-setup-checklist__item is-bad'
                    }
                  >
                    <span aria-hidden>{item.ok ? '✓' : '!'}</span>
                    <span>
                      {item.message}
                      {!item.ok && item.href ? (
                        <>
                          {' '}
                          <Link href={item.href} className="soft-link">
                            Fix
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {!preflightItems.length ? (
                <p className="muted">Loading checklist…</p>
              ) : null}
            </Card>

            <Card title="Booking link" eyebrow="Required for meeting campaigns">
              <Field label="Cal.com / Calendly / Google Appointment URL">
                <input
                  className="field"
                  value={bookingLinkDraft}
                  onChange={(e) => setBookingLinkDraft(e.target.value)}
                  placeholder="https://cal.com/you/discovery"
                />
              </Field>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
                Saved on launch if the checklist still needs it.
              </p>
            </Card>

            {hasScoutTarget ? (
              <label className="ai-setup-check">
                <input
                  type="checkbox"
                  checked={scoutLeads}
                  onChange={(e) => setScoutLeads(e.target.checked)}
                />
                <span>
                  Optional: source leads for this campaign after opening (uses lead credits)
                </span>
              </label>
            ) : null}

            <div className="ai-setup__actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void launch()}
              >
                {busy ? 'Opening…' : preflightReady ? 'Open campaign' : 'Retry launch'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  const bId = appliedBrand?.id || brandId;
                  if (bId && campaignId) void loadPreflight(bId, campaignId);
                }}
              >
                Refresh checklist
              </button>
              {(appliedBrand?.slug || brandSlug) && (
                <Link
                  href={brandHref(appliedBrand?.slug || brandSlug!, 'campaigns', campaignId)}
                  className="btn-ghost"
                >
                  Keep as draft
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Root>
  );
}
