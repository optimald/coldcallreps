'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import Modal from '@/components/ui/Modal';
import { brandHref } from '@/lib/brand-context';
import {
  DEMO_MSG,
  enrichDemoTeamMetrics,
  getDemoApplications,
  getDemoCampaigns,
} from '@/lib/demo/brand-demo-data';
import { syntheticCanonicalBrand } from '@/lib/demo/canonical-brands';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';
import { statsFromDemoProgress } from '@/lib/campaign-list-stats-shared';

type CampaignRepStat = {
  userId: string;
  name: string;
  slug: string | null;
  avatarUrl?: string | null;
  status: string;
  dials: number;
  verifiedGoals: number;
  lastCallAt: string | Date | null;
};

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  payoutLabel: string;
  payoutCents?: number;
  qualifiedPayoutCents?: number | null;
  qualifiedPayoutLabel?: string | null;
  goalLabel: string;
  goalType?: string;
  earningsModel?: string;
  earningsModelLabel?: string;
  applicationCount?: number;
  bookingLink?: string | null;
  escrowLabel?: string | null;
  escrowLockedCents?: number | null;
  dateRangeLabel?: string | null;
  budgetLabel?: string | null;
  budgetCents?: number | null;
  remainingOverallCents?: number | null;
  spentCents?: number | null;
  activateOn?: boolean;
  dialEligible?: boolean;
  playbookId?: string | null;
  playbookTitle?: string | null;
  activeSdrCount?: number;
  teamApproved?: number;
  teamApplicants?: number;
  leadCount?: number;
  calledCount?: number;
  calledPct?: number;
  goalsMet?: number;
  goalsPerLead?: number;
};

type BrandMeta = {
  id: string;
  name: string;
  slug: string;
  packs?: { id: string; name: string }[];
  playbooks?: { id: string; title: string }[];
};

function statusChipClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'camp-row__chip camp-row__chip--open';
    case 'PAUSED':
      return 'camp-row__chip camp-row__chip--paused';
    case 'DRAFT':
      return 'camp-row__chip camp-row__chip--draft';
    case 'CLOSED':
      return 'camp-row__chip camp-row__chip--closed';
    default:
      return 'camp-row__chip';
  }
}

function highestGoalCents(c: CampaignRow): number {
  const meeting = c.payoutCents ?? 0;
  const qualified = c.qualifiedPayoutCents ?? 0;
  return Math.max(meeting, qualified, 0);
}

function formatLastCall(at: string | Date | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  return d.toLocaleDateString();
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function invertTeamToCampaignReps(
  team: {
    userId: string;
    name: string;
    slug: string | null;
    avatarUrl?: string | null;
    campaigns: {
      id: string;
      status: string;
      dials?: number;
      verifiedGoals?: number;
      lastCallAt?: string | Date | null;
    }[];
  }[]
): Record<string, CampaignRepStat[]> {
  const byCamp: Record<string, CampaignRepStat[]> = {};
  for (const m of team) {
    for (const c of m.campaigns) {
      const list = byCamp[c.id] || (byCamp[c.id] = []);
      list.push({
        userId: m.userId,
        name: m.name,
        slug: m.slug,
        avatarUrl: m.avatarUrl,
        status: c.status,
        dials: c.dials ?? 0,
        verifiedGoals: c.verifiedGoals ?? 0,
        lastCallAt: c.lastCallAt ?? null,
      });
    }
  }
  for (const id of Object.keys(byCamp)) {
    byCamp[id].sort((a, b) => b.dials - a.dials || a.name.localeCompare(b.name));
  }
  return byCamp;
}

export default function BrandCampaignsPage() {
  const params = useParams();
  const brandKey = String(params.id || '');
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [brand, setBrand] = useState<BrandMeta | null>(() => {
    const syn = syntheticCanonicalBrand(brandKey);
    return syn
      ? { id: syn.id, name: syn.name, slug: syn.slug, packs: [], playbooks: [] }
      : null;
  });
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(() =>
    mode === 'demo' ? getDemoCampaigns(brandKey) : []
  );
  const [repsByCampaign, setRepsByCampaign] = useState<Record<string, CampaignRepStat[]>>(
    () =>
      mode === 'demo'
        ? invertTeamToCampaignReps(enrichDemoTeamMetrics(brandKey))
        : {}
  );
  const [walletCents, setWalletCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(() => mode !== 'demo');
  const [createOpen, setCreateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    campaign: CampaignRow;
    next: boolean;
  } | null>(null);

  useEffect(() => {
    if (!brandKey) return;
    let cancelled = false;

    async function load() {
      if (mode === 'demo') {
        const syn = syntheticCanonicalBrand(brandKey);
        if (syn) {
          setBrand({
            id: syn.id,
            name: syn.name,
            slug: syn.slug,
            packs: [],
            playbooks: [],
          });
        }
        setCampaigns(getDemoCampaigns(brandKey));
        setRepsByCampaign(invertTeamToCampaignReps(enrichDemoTeamMetrics(brandKey, syn?.name)));
        setWalletCents(370000);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [brandRes, walletRes, teamRes] = await Promise.all([
          fetch(`/api/brands/${brandKey}`),
          fetch(`/api/brands/${brandKey}/wallet`),
          fetch(`/api/brands/${encodeURIComponent(brandKey)}/sdrs/team`),
        ]);
        const brandData = await brandRes.json().catch(() => ({}));
        const walletData = await walletRes.json().catch(() => ({}));
        const teamData = await teamRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!brandRes.ok || !brandData.brand) {
          setBrand(null);
          setCampaigns([]);
          setRepsByCampaign({});
          return;
        }
        const b = brandData.brand as BrandMeta;
        setBrand(b);
        if (typeof walletData?.balanceCents === 'number') {
          setWalletCents(walletData.balanceCents);
        } else if (typeof walletData?.wallet?.balanceCents === 'number') {
          setWalletCents(walletData.wallet.balanceCents);
        }
        if (teamRes.ok) {
          setRepsByCampaign(invertTeamToCampaignReps(teamData.team || []));
        }

        const campRes = await fetch(`/api/campaigns?brandId=${encodeURIComponent(b.id)}`);
        const campData = await campRes.json().catch(() => ({}));
        if (cancelled) return;
        if (campRes.ok) setCampaigns(campData.campaigns || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [brandKey, mode]);

  async function reloadLive() {
    if (!brand?.id || mode === 'demo') return;
    const [campRes, walletRes] = await Promise.all([
      fetch(`/api/campaigns?brandId=${encodeURIComponent(brand.id)}`),
      fetch(`/api/brands/${brandKey}/wallet`),
    ]);
    const campData = await campRes.json().catch(() => ({}));
    const walletData = await walletRes.json().catch(() => ({}));
    if (campRes.ok) setCampaigns(campData.campaigns || []);
    if (typeof walletData?.balanceCents === 'number') {
      setWalletCents(walletData.balanceCents);
    } else if (typeof walletData?.wallet?.balanceCents === 'number') {
      setWalletCents(walletData.wallet.balanceCents);
    }
  }

  function requestToggle(c: CampaignRow, next: boolean) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    if (c.status === 'CLOSED') return;
    if (next) {
      if (!c.playbookId) {
        setMsg('Attach a playbook before activating — every campaign needs a talk track.');
        return;
      }
      const need = highestGoalCents(c);
      const available =
        (walletCents ?? 0) +
        (typeof c.escrowLockedCents === 'number' ? c.escrowLockedCents : 0);
      if (need > 0 && available < need) {
        setMsg(
          `Wallet needs at least $${(need / 100).toFixed(0)} (one highest goal payout) before you can activate.`
        );
        return;
      }
    }
    setConfirm({ campaign: c, next });
  }

  async function confirmToggle() {
    if (!confirm) return;
    const { campaign: c, next } = confirm;
    setConfirm(null);
    setTogglingId(c.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activateOn: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not update campaign');
        return;
      }
      setCampaigns((prev) =>
        prev.map((row) => (row.id === c.id ? { ...row, ...data.campaign } : row))
      );
      await reloadLive();
    } finally {
      setTogglingId(null);
    }
  }

  const display = useMemo((): CampaignRow[] => {
    if (!isDemo) return campaigns;
    const apps = getDemoApplications(brandKey);
    return getDemoCampaigns(brandKey).map((c) => {
      const budgetCents = c.budgetCents ?? null;
      const remainingOverallCents =
        c.remainingOverallCents ?? (budgetCents != null ? budgetCents : null);
      const escrowFromLabel = (() => {
        if (!c.escrowLabel) return 0;
        const n = Number(String(c.escrowLabel).replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
      })();
      const payoutCents = (() => {
        const n = Number(String(c.payoutLabel || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
      })();
      const stats = statsFromDemoProgress({
        applications: apps.filter((a) => a.campaignId === c.id),
        progress: c.progress,
      });
      const funded = Math.max(escrowFromLabel, budgetCents || 0);
      const spent =
        remainingOverallCents != null && budgetCents != null
          ? Math.max(0, budgetCents - remainingOverallCents)
          : 0;
      return {
        ...c,
        payoutCents,
        qualifiedPayoutCents: null,
        budgetCents: funded || budgetCents,
        remainingOverallCents:
          funded > 0 ? Math.max(0, funded - spent) : remainingOverallCents,
        spentCents: spent,
        escrowLockedCents: escrowFromLabel || funded,
        playbookId: 'demo-playbook',
        playbookTitle: 'Demo talk track',
        budgetLabel: null,
        ...stats,
      };
    });
  }, [isDemo, brandKey, campaigns]);

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!brand) {
    return (
      <main className="app-page">
        <PageHeader title="Brand not found" description="This brand may have been removed." />
        <Link href="/brands" className="soft-link">
          ← Back to brands
        </Link>
      </main>
    );
  }

  const campBase = brandHref(brand, 'campaigns');
  const playbookBase = brandHref(brand, 'playbooks');

  return (
    <main className="app-page app-page--desk camp-page">
      <PageHeader
        compact
        title="Campaigns"
        description="Activate unlocks dials for approved SDRs. Live calls always finish."
        actions={
          <div className="camp-page__actions">
            <Link href={playbookBase} className="btn-ghost">
              Playbooks
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (isDemo) {
                  setMsg(DEMO_MSG);
                  return;
                }
                if (!brand.playbooks?.length) {
                  setMsg('Create a playbook first — every campaign needs one.');
                  return;
                }
                setCreateOpen(true);
              }}
            >
              New campaign
            </button>
          </div>
        }
      />

      {msg ? (
        <p className="msg-err" role="status" style={{ marginTop: 0 }}>
          {msg}
        </p>
      ) : null}

      {display.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign with a playbook so reps can find it on Brand deals."
          action={
            <button
              type="button"
              className="btn"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                if (isDemo) {
                  setMsg(DEMO_MSG);
                  return;
                }
                setCreateOpen(true);
              }}
            >
              New campaign
            </button>
          }
        />
      ) : (
        <Panel
          compact
          className="desk-panel--deck camp-panel"
          description={`${display.length} campaign${display.length === 1 ? '' : 's'}`}
        >
          <div className="camp-list">
            {display.map((c) => {
            const activateOn = c.activateOn ?? c.status === 'OPEN';
            const canToggle = c.status !== 'CLOSED';
            const need = highestGoalCents(c);
            const funded = Math.max(
              typeof c.escrowLockedCents === 'number' ? c.escrowLockedCents : 0,
              c.budgetCents ?? 0
            );
            const left =
              c.remainingOverallCents ??
              (funded > 0
                ? Math.max(0, funded - (c.spentCents ?? 0))
                : null);
            const spent =
              funded > 0 && left != null ? Math.max(0, funded - left) : null;
            const fundPct =
              funded > 0 && spent != null
                ? Math.min(100, Math.round((spent / funded) * 100))
                : null;
            const goalNoun =
              c.earningsModel === 'PER_QUALIFIED_LEAD' || c.goalType === 'QUALIFIED_LEAD'
                ? 'Qualified'
                : c.earningsModel === 'TIERED_ACCELERATOR'
                  ? 'Accelerator'
                  : 'Booked';

            return (
              <article
                key={c.id}
                className={
                  activateOn ? 'camp-row camp-row--active' : 'camp-row'
                }
              >
                <div className="camp-row__main">
                  <div className="camp-row__identity">
                    <div className="camp-row__title-line">
                      <Link href={`${campBase}/${c.id}`} className="camp-row__title">
                        {c.title}
                      </Link>
                      <span className={statusChipClass(c.status)}>
                        {activateOn ? 'Active' : c.status}
                      </span>
                    </div>
                    <p className="camp-row__meta">
                      {c.earningsModelLabel || c.goalLabel}
                      {c.dateRangeLabel ? ` · ${c.dateRangeLabel}` : ''}
                      {c.playbookTitle || c.playbookId ? (
                        <>
                          {' · '}
                          <Link
                            href={
                              c.playbookId
                                ? brandHref(brand, 'playbooks', c.playbookId)
                                : playbookBase
                            }
                            className="soft-link"
                          >
                            {c.playbookTitle || 'Playbook'}
                          </Link>
                        </>
                      ) : (
                        <>
                          {' · '}
                          <Link
                            href={playbookBase}
                            className="soft-link"
                            style={{ color: 'var(--warn, #d4a017)' }}
                          >
                            Needs playbook
                          </Link>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="camp-row__metrics">
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">Payout</span>
                      <strong>{c.payoutLabel}</strong>
                    </div>
                    <div className="camp-row__metric camp-row__metric--fund">
                      <span className="camp-row__metric-label">Escrow</span>
                      {funded > 0 ? (
                        <>
                          <strong>
                            {left != null
                              ? `$${Math.round(left / 100).toLocaleString()} left`
                              : `$${Math.round(funded / 100).toLocaleString()}`}
                          </strong>
                          <p className="camp-row__metric-sub">
                            of ${Math.round(funded / 100).toLocaleString()} funded
                          </p>
                          <div
                            className="camp-row__bar"
                            role="progressbar"
                            aria-valuenow={fundPct ?? 0}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Escrow used"
                          >
                            <span style={{ width: `${fundPct ?? 0}%` }} />
                          </div>
                        </>
                      ) : (
                        <strong>$0</strong>
                      )}
                    </div>
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">Team approved</span>
                      <strong>{c.teamApproved ?? 0}</strong>
                    </div>
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">Applicants</span>
                      <strong>{c.teamApplicants ?? 0}</strong>
                    </div>
                  </div>

                  <div className="camp-row__results">
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">Leads</span>
                      <strong>{c.leadCount ?? 0}</strong>
                    </div>
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">Called</span>
                      <strong>{c.calledPct ?? 0}%</strong>
                      <p className="camp-row__metric-sub">
                        {c.calledCount ?? 0} of {c.leadCount ?? 0}
                      </p>
                    </div>
                    <div className="camp-row__metric">
                      <span className="camp-row__metric-label">{goalNoun}</span>
                      <strong>{c.goalsMet ?? 0}</strong>
                      <p className="camp-row__metric-sub">
                        {c.leadCount
                          ? `${Math.round((c.goalsPerLead || 0) * 100)}% of leads`
                          : 'per lead —'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="camp-row__actions">
                  <button
                    type="button"
                    className={
                      activateOn
                        ? 'btn-ghost camp-row__toggle'
                        : 'btn camp-row__toggle'
                    }
                    disabled={!canToggle || togglingId === c.id || isDemo}
                    onClick={() => requestToggle(c, !activateOn)}
                    title={
                      activateOn
                        ? 'Pause new dials (live calls finish)'
                        : need > 0
                          ? `Requires ≥ $${(need / 100).toFixed(0)} wallet for one payout`
                          : 'Open for dials'
                    }
                  >
                    {togglingId === c.id
                      ? '…'
                      : activateOn
                        ? 'Deactivate'
                        : 'Activate'}
                  </button>
                  <Link href={`${campBase}/${c.id}`} className="btn-ghost camp-row__open">
                    Open →
                  </Link>
                </div>

                <div className="camp-row__reps">
                  <div className="camp-row__reps-head">
                    <span className="camp-row__metric-label">SDRs on this campaign</span>
                    <span className="muted small">
                      {(repsByCampaign[c.id] || []).length} active
                    </span>
                  </div>
                  {(repsByCampaign[c.id] || []).length === 0 ? (
                    <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                      No accepted or active SDRs yet — recruit and activate them from Team.
                    </p>
                  ) : (
                    <div className="sdr-team-table-wrap camp-row__reps-table">
                      <table className="sdr-team-table sdr-team-table--nested">
                        <thead>
                          <tr>
                            <th scope="col">SDR</th>
                            <th scope="col">Status</th>
                            <th scope="col">Dials</th>
                            <th scope="col">Verified goals</th>
                            <th scope="col">Last call</th>
                            <th scope="col">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(repsByCampaign[c.id] || []).map((r) => (
                            <tr key={`${c.id}:${r.userId}`} className="sdr-team-table__nest-row">
                              <td>
                                <div className="sdr-team-table__nest camp-row__rep-cell">
                                  <span className="sdr-team-table__nest-mark" aria-hidden />
                                  <div>
                                    {r.slug ? (
                                      <Link href={`/r/${r.slug}`} className="sdr-team-table__name">
                                        {r.name}
                                      </Link>
                                    ) : (
                                      <span className="sdr-team-table__name">{r.name}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="sdr-team-card__status">{r.status}</span>
                              </td>
                              <td>{r.dials}</td>
                              <td>{r.verifiedGoals}</td>
                              <td className="muted">{formatLastCall(r.lastCallAt)}</td>
                              <td className="sdr-team-table__actions">
                                <nav
                                  className="sdr-team-card__links"
                                  aria-label={`${r.name} on ${c.title}`}
                                >
                                  <Link
                                    href={withQuery(brandHref(brand, 'calls'), {
                                      rep: r.userId,
                                      campaign: c.id,
                                    })}
                                  >
                                    Calls
                                  </Link>
                                  <Link
                                    href={withQuery('/sdrs/payouts', { rep: r.userId })}
                                  >
                                    Payouts
                                  </Link>
                                  <Link
                                    href={withQuery(brandHref(brand, 'goals'), {
                                      rep: r.userId,
                                      campaign: c.id,
                                    })}
                                  >
                                    Goals
                                  </Link>
                                </nav>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        </Panel>
      )}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.next ? 'Activate campaign?' : 'Deactivate campaign?'}
        description={
          confirm?.next
            ? 'Approved SDRs can dial immediately. Each verified goal draws from escrow/wallet — make sure balance covers at least one highest-value payout.'
            : 'New dials stop. SDRs already on a live call can finish that call.'
        }
      >
        {confirm ? (
          <div className="stack" style={{ gap: '0.85rem' }}>
            <p style={{ margin: 0 }}>
              <strong>{confirm.campaign.title}</strong>
            </p>
            {confirm.next ? (
              <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
                <li>
                  Highest goal payout:{' '}
                  <strong>${(highestGoalCents(confirm.campaign) / 100).toFixed(0)}</strong>
                </li>
                <li>
                  Wallet + locked escrow:{' '}
                  <strong>
                    $
                    {(
                      ((walletCents ?? 0) +
                        (confirm.campaign.escrowLockedCents || 0)) /
                      100
                    ).toFixed(0)}
                  </strong>
                </li>
                {!confirm.campaign.playbookId ? (
                  <li style={{ color: 'var(--danger, #e25555)' }}>No playbook attached</li>
                ) : null}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                In-flight calls keep going. New dials are blocked until you activate again.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={() => void confirmToggle()}>
                {confirm.next ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {!isDemo ? (
        <CreateCampaignModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          brandId={brand.id}
          brandName={brand.name}
          packs={brand.packs}
          playbooks={brand.playbooks}
          onCreated={() => void reloadLive()}
        />
      ) : null}
    </main>
  );
}
