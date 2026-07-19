'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { brandHref } from '@/lib/brand-context';
import { matchProgressOf } from '@/lib/brand-lead-match';
import { scheduleStatusHint } from '@/lib/campaign-schedule';
import {
  DEMO_MSG,
  getDemoApplications,
  getDemoCampaigns,
  getDemoPipelineJobs,
  isDemoEntityId,
} from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import type { CampaignDetailBundle } from '@/lib/campaign-detail';
import {
  CALLING_TIMEZONE_OPTIONS,
  DEFAULT_CALLING_TIMEZONE,
  minutesToTime,
  parseTimeToMinutes,
} from '@/lib/calling-hours';

const FUND_PRESETS = [100, 250, 500, 1000, 2500];

type LedgerEntry = {
  id: string;
  type: string;
  amountCents: number;
  createdAt: string;
  description: string;
  direction: 'credit' | 'debit' | 'neutral';
};

function money(cents: number) {
  const abs = Math.abs(cents) / 100;
  const formatted = abs.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: abs % 1 === 0 ? 0 : 2,
  });
  if (cents < 0) return `−${formatted}`;
  if (cents > 0) return `+${formatted}`;
  return formatted;
}

function demoLedgerForCampaign(c: {
  id: string;
  escrowLabel?: string | null;
  remainingOverallCents?: number | null;
  budgetCents?: number | null;
}): LedgerEntry[] {
  const escrow =
    typeof c.escrowLabel === 'string'
      ? Math.round(Number(String(c.escrowLabel).replace(/[^0-9.]/g, '')) * 100) || 0
      : 0;
  const budget = c.budgetCents ?? 0;
  const remaining = c.remainingOverallCents ?? budget;
  const spent = Math.max(0, budget - remaining);
  const rows: LedgerEntry[] = [];
  if (escrow > 0 || budget > 0) {
    const funded = Math.max(escrow, budget);
    rows.push({
      id: `demo-fund-${c.id}`,
      type: 'FUND',
      amountCents: funded,
      createdAt: new Date(Date.now() - 12 * 86400_000).toISOString(),
      description: `Credited $${(funded / 100).toLocaleString()} on campaign to fund the campaign`,
      direction: 'credit',
    });
    rows.push({
      id: `demo-lock-${c.id}`,
      type: 'ESCROW_LOCK',
      amountCents: -funded,
      createdAt: new Date(Date.now() - 12 * 86400_000 + 60_000).toISOString(),
      description: `Debited $${(funded / 100).toLocaleString()} — locked to campaign`,
      direction: 'debit',
    });
  }
  if (spent > 0) {
    rows.push({
      id: `demo-release-${c.id}`,
      type: 'ESCROW_RELEASE',
      amountCents: -spent,
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
      description: `Goal met — $${(spent / 100).toLocaleString()} debit on campaign`,
      direction: 'debit',
    });
  }
  return rows;
}

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

function seedFromBundle(bundle: CampaignDetailBundle) {
  const c = bundle.campaign as any;
  return {
    campaign: c,
    canManage: bundle.canManage,
    applications: bundle.applications as any[],
    status: c?.status || 'OPEN',
    activateOn: Boolean(c?.activateOn ?? c?.status === 'OPEN'),
    bookTitle: c?.title ? `Intro · ${c.title}` : 'Intro meeting',
    myAppStatus: c?.myApplication?.status || null,
    bookingLinkDraft: c?.bookingLink || '',
    targetVertical: c?.targetVertical || '',
    targetLocation: c?.targetLocation || '',
    budgetMode: c?.budgetMode || 'OVERALL',
    budgetDollars: c?.budgetCents != null ? String(c.budgetCents / 100) : '',
    dailyBudgetDollars: c?.dailyBudgetCents != null ? String(c.dailyBudgetCents / 100) : '',
    startsAt: c?.startsAt ? String(c.startsAt).slice(0, 10) : '',
    endsAt: c?.endsAt ? String(c.endsAt).slice(0, 10) : '',
    ongoing: !c?.endsAt,
    callingHoursStart: minutesToTime(c?.callingHoursStartMin) || '09:00',
    callingHoursEnd: minutesToTime(c?.callingHoursEndMin) || '17:00',
    callingTimezone: c?.callingTimezone || DEFAULT_CALLING_TIMEZONE,
    limitCallingHours:
      c?.callingHoursStartMin != null && c?.callingHoursEndMin != null,
    progress: bundle.progress,
    campaignJobs: bundle.campaignJobs,
    calendarConnected: bundle.calendarConnected,
    bookings: bundle.bookings as any[],
  };
}

export default function BrandCampaignDetailClient({
  brandKey: brandKeyProp,
  campaignId: campaignIdProp,
  initialDeskMode,
  initialBundle,
}: {
  brandKey?: string;
  campaignId?: string;
  initialDeskMode?: 'live' | 'demo';
  initialBundle?: CampaignDetailBundle | null;
}) {
  const params = useParams();
  const brandKey = brandKeyProp || String(params.id || '');
  const id = campaignIdProp || String(params.campaignId || '');
  const { mode } = useBrandDeskMode(initialDeskMode);
  const isDemo = mode === 'demo';
  const seeded = initialBundle && mode !== 'demo' ? seedFromBundle(initialBundle) : null;

  const [campaign, setCampaign] = useState<any>(seeded?.campaign ?? null);
  const [canManage, setCanManage] = useState(seeded?.canManage ?? false);
  const [applications, setApplications] = useState<any[]>(seeded?.applications ?? []);
  const [loading, setLoading] = useState(() => !(seeded || mode === 'demo'));
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState(seeded?.status ?? 'OPEN');

  const [calendarConnected, setCalendarConnected] = useState(
    seeded?.calendarConnected ?? false
  );
  const [bookings, setBookings] = useState<any[]>(seeded?.bookings ?? []);
  const [bookTitle, setBookTitle] = useState(seeded?.bookTitle ?? '');
  const [bookEmails, setBookEmails] = useState('');
  const [bookStart, setBookStart] = useState(defaultStartLocal);
  const [bookEnd, setBookEnd] = useState(() => defaultEndLocal(defaultStartLocal()));
  const [bookAppId, setBookAppId] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [basePayBusy, setBasePayBusy] = useState(false);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimProspect, setClaimProspect] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [myAppStatus, setMyAppStatus] = useState<string | null>(seeded?.myAppStatus ?? null);

  const [bookingLinkDraft, setBookingLinkDraft] = useState(seeded?.bookingLinkDraft ?? '');
  const [targetVertical, setTargetVertical] = useState(seeded?.targetVertical ?? '');
  const [targetLocation, setTargetLocation] = useState(seeded?.targetLocation ?? '');
  const [budgetMode, setBudgetMode] = useState(seeded?.budgetMode ?? 'OVERALL');
  const [budgetDollars, setBudgetDollars] = useState(seeded?.budgetDollars ?? '');
  const [dailyBudgetDollars, setDailyBudgetDollars] = useState(seeded?.dailyBudgetDollars ?? '');
  const [startsAt, setStartsAt] = useState(seeded?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState(seeded?.endsAt ?? '');
  const [ongoing, setOngoing] = useState(seeded?.ongoing ?? true);
  const [callingHoursStart, setCallingHoursStart] = useState(
    seeded?.callingHoursStart ?? '09:00'
  );
  const [callingHoursEnd, setCallingHoursEnd] = useState(seeded?.callingHoursEnd ?? '17:00');
  const [callingTimezone, setCallingTimezone] = useState(
    seeded?.callingTimezone ?? DEFAULT_CALLING_TIMEZONE
  );
  const [limitCallingHours, setLimitCallingHours] = useState(
    seeded?.limitCallingHours ?? true
  );
  const [activateOn, setActivateOn] = useState(seeded?.activateOn ?? false);
  const [configBusy, setConfigBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [walletBalanceCents, setWalletBalanceCents] = useState(0);
  const [fundBusy, setFundBusy] = useState(false);
  const [customFund, setCustomFund] = useState('250');
  const [allocateDollars, setAllocateDollars] = useState('100');
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(
    seeded?.progress ?? {
      targeting: 0,
      conditioning: 0,
      dialingReady: 0,
      dialingActive: 0,
      booked: 0,
      failed: 0,
      total: 0,
      dials: 0,
    }
  );
  const [campaignJobs, setCampaignJobs] = useState(seeded?.campaignJobs ?? []);

  function applyDemoCampaign() {
    const demo = getDemoCampaigns(brandKey).find((c) => c.id === id);
    if (!demo) {
      setNotFound(true);
      setCampaign(null);
      return false;
    }
    setCampaign({
      ...demo,
      brand: { slug: brandKey, name: brandKey },
      icpText: demo.description || 'High-ticket ICP · decision-makers · qualified meetings',
      pack: { name: 'Outbound opener pack' },
      playbook: { title: 'Discovery / appointment call' },
      minScore: 80,
      requireCertification: false,
      platformFeeBps: 2000,
      maxAwards: demo.progress?.maxAwards ?? 20,
      escrowLockedCents: demo.escrowLabel?.includes('$0') ? 0 : 120000,
      budgetCents: demo.budgetCents ?? 200000,
      budgetMode: demo.budgetMode || 'OVERALL',
      dailyBudgetCents: demo.dailyBudgetCents ?? null,
      startsAt: demo.startsAt ?? null,
      endsAt: demo.endsAt ?? null,
      dateRangeLabel: demo.dateRangeLabel,
      budgetLabel: demo.budgetLabel,
      activateOn: demo.activateOn ?? demo.status === 'OPEN',
      myApplication: null,
    });
    setCanManage(true);
    setStatus(demo.status);
    setActivateOn(demo.activateOn ?? demo.status === 'OPEN');
    setBookTitle(`Intro · ${demo.title}`);
    setBookingLinkDraft(demo.bookingLink || '');
    setTargetVertical(demo.targetVertical || '');
    setTargetLocation(demo.targetLocation || '');
    setBudgetMode(demo.budgetMode || 'OVERALL');
    setBudgetDollars(demo.budgetCents != null ? String(demo.budgetCents / 100) : '');
    setDailyBudgetDollars(
      demo.dailyBudgetCents != null ? String(demo.dailyBudgetCents / 100) : ''
    );
    setStartsAt(demo.startsAt ? demo.startsAt.slice(0, 10) : '');
    setEndsAt(demo.endsAt ? demo.endsAt.slice(0, 10) : '');
    setOngoing(!demo.endsAt);
    setCallingHoursStart('09:00');
    setCallingHoursEnd('17:00');
    setCallingTimezone(DEFAULT_CALLING_TIMEZONE);
    setLimitCallingHours(true);
    setLedger(demoLedgerForCampaign(demo));
    setWalletBalanceCents(245000);
    const p = demo.progress;
    setProgress({
      targeting: p?.targeting ?? 0,
      conditioning: p?.conditioning ?? 0,
      dialingReady: p?.dialingReady ?? 0,
      dialingActive: p?.dialingActive ?? 0,
      booked: p?.booked ?? 0,
      failed: 0,
      total:
        (p?.targeting ?? 0) +
        (p?.conditioning ?? 0) +
        (p?.dialingReady ?? 0) +
        (p?.booked ?? 0),
      dials: p?.dials ?? 0,
    });
    setCampaignJobs(
      getDemoPipelineJobs(brandKey)
        .filter((j) => j.campaignId === id)
        .map((j) => ({
          id: j.id,
          query: j.query,
          location: j.location,
          status: j.status,
          savedCount: j.savedCount,
          readyCount: j.readyCount,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
          errorMessage: j.errorMessage,
        }))
    );
    setApplications(
      getDemoApplications(brandKey)
        .filter((a) => a.campaignId === id)
        .map((a) => ({
          id: a.id,
          status: a.status,
          applicant: { displayName: a.displayName, repProfile: { slug: a.profileSlug } },
          createdAt: a.createdAt,
        }))
    );
    setNotFound(false);
    setCalendarConnected(false);
    setBookings([]);
    return true;
  }

  async function loadBookings() {
    if (!id || isDemoEntityId(id)) return;
    const res = await fetch(`/api/campaigns/${id}/book`);
    if (!res.ok) return;
    const d = await res.json();
    setCalendarConnected(Boolean(d.calendarConnected));
    setBookings(d.bookings || []);
  }

  const loadLedger = useCallback(async (brandId: string, campaignId: string) => {
    if (!brandId || !campaignId || isDemoEntityId(campaignId)) return;
    const [ledgerRes, walletRes] = await Promise.all([
      fetch(
        `/api/billing/ledger?brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(campaignId)}`
      ),
      fetch(`/api/brands/${encodeURIComponent(brandId)}/wallet`),
    ]);
    if (ledgerRes.ok) {
      const data = await ledgerRes.json();
      setLedger(data.entries || []);
    }
    if (walletRes.ok) {
      const data = await walletRes.json();
      if (typeof data.balanceCents === 'number') setWalletBalanceCents(data.balanceCents);
    }
  }, []);

  useEffect(() => {
    const funded = searchParams.get('wallet');
    if (funded === 'funded') setMsg('Wallet funded — escrow updated for this campaign.');
    if (funded === 'cancel') setErr('Checkout canceled.');
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      if (mode === 'demo' || isDemoEntityId(id)) {
        if (!cancelled) {
          applyDemoCampaign();
          setLoading(false);
        }
        return;
      }
      // Already SSR-seeded for live
      if (initialBundle && campaign) {
        setLoading(false);
        if (initialBundle.canManage && initialBundle.campaign) {
          const brandId =
            (initialBundle.campaign as { brandId?: string; brand?: { id?: string } }).brandId ||
            (initialBundle.campaign as { brand?: { id?: string } }).brand?.id;
          if (brandId) void loadLedger(brandId, id);
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          setCampaign(null);
          return;
        }
        const d = await res.json();
        if (cancelled) return;
        setCampaign(d.campaign);
        setCanManage(Boolean(d.canManage));
        setStatus(d.campaign?.status || 'OPEN');
        setActivateOn(Boolean(d.campaign?.activateOn ?? d.campaign?.status === 'OPEN'));
        setBookTitle(d.campaign?.title ? `Intro · ${d.campaign.title}` : 'Intro meeting');
        setMyAppStatus(d.campaign?.myApplication?.status || null);
        setBookingLinkDraft(d.campaign?.bookingLink || '');
        setTargetVertical(d.campaign?.targetVertical || '');
        setTargetLocation(d.campaign?.targetLocation || '');
        setBudgetMode(d.campaign?.budgetMode || 'OVERALL');
        setBudgetDollars(
          d.campaign?.budgetCents != null ? String(d.campaign.budgetCents / 100) : ''
        );
        setDailyBudgetDollars(
          d.campaign?.dailyBudgetCents != null ? String(d.campaign.dailyBudgetCents / 100) : ''
        );
        setStartsAt(
          d.campaign?.startsAt ? String(d.campaign.startsAt).slice(0, 10) : ''
        );
        setEndsAt(d.campaign?.endsAt ? String(d.campaign.endsAt).slice(0, 10) : '');
        setOngoing(!d.campaign?.endsAt);
        setCallingHoursStart(minutesToTime(d.campaign?.callingHoursStartMin) || '09:00');
        setCallingHoursEnd(minutesToTime(d.campaign?.callingHoursEndMin) || '17:00');
        setCallingTimezone(d.campaign?.callingTimezone || DEFAULT_CALLING_TIMEZONE);
        setLimitCallingHours(
          d.campaign?.callingHoursStartMin != null && d.campaign?.callingHoursEndMin != null
        );
        if (d.canManage) {
          const appsRes = await fetch(`/api/campaigns/${id}/applications`);
          if (cancelled) return;
          if (appsRes.ok) {
            const apps = await appsRes.json();
            if (!cancelled) setApplications(apps.applications || []);
          }
          const brandIdForLedger = d.campaign?.brandId || d.campaign?.brand?.id;
          if (brandIdForLedger && !cancelled) await loadLedger(brandIdForLedger, id);
        }
        // Progress from campaign leads + pipeline jobs
        const brandId = d.campaign?.brandId || d.campaign?.brand?.id;
        if (brandId) {
          const [leadsRes, jobsRes] = await Promise.all([
            fetch(`/api/prospects?brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(id)}&limit=200`),
            fetch(`/api/brands/${encodeURIComponent(brandId)}/pipeline/jobs?limit=40`),
          ]);
          if (!cancelled && leadsRes.ok) {
            const leadsData = await leadsRes.json();
            const leads = leadsData.prospects || [];
            const kpis = matchProgressOf(leads);
            setProgress({
              targeting: kpis.targeting,
              conditioning: kpis.conditioning,
              dialingReady: kpis.dialingReady,
              dialingActive: kpis.dialingActive,
              booked: kpis.booked,
              failed: kpis.failed,
              total: kpis.total,
              dials: leads.filter((l: { status?: string }) =>
                ['warming', 'dialing', 'done'].includes(l.status || '')
              ).length,
            });
          }
          if (!cancelled && jobsRes.ok) {
            const jobsData = await jobsRes.json();
            const jobs = (jobsData.jobs || []).filter(
              (j: { campaignId?: string | null }) => j.campaignId === id
            );
            setCampaignJobs(jobs);
          }
        }
        if (!cancelled) await loadBookings();
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per id/mode
  }, [id, mode, loadLedger]);

  useEffect(() => {
    setBookEnd(defaultEndLocal(bookStart));
  }, [bookStart]);

  useEffect(() => {
    if (typeof window === 'undefined' || mode === 'demo') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payout') === 'success') {
      setMsg('Payout submitted — Stripe will confirm shortly. Refresh if status is still pending.');
    } else if (params.get('payout') === 'cancel') {
      setErr('Payout checkout canceled.');
    }
  }, [id, mode]);

  async function payApplicant(applicationId: string) {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
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

  async function payBaseNow() {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    setBasePayBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/campaigns/${id}/base-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Could not pay base');
        return;
      }
      const paid = (data.results || []).filter((r: { status?: string }) => r.status === 'PAID').length;
      const pending = (data.results || []).filter(
        (r: { status?: string }) => r.status === 'PENDING'
      ).length;
      setMsg(
        `Base pay for ${data.periodKey}: ${paid} paid` +
          (pending ? `, ${pending} pending Connect` : '') +
          '.'
      );
    } catch (e: any) {
      setErr(e.message || 'Could not pay base');
    } finally {
      setBasePayBusy(false);
    }
  }

  async function saveConfig() {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    if (campaign?.status === 'OPEN') {
      setErr('Deactivate the campaign before editing.');
      return;
    }
    setConfigBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingLink: bookingLinkDraft.trim() || null,
          targetVertical: targetVertical.trim() || null,
          targetLocation: targetLocation.trim() || null,
          budgetMode,
          budgetCents: budgetDollars ? Math.round(Number(budgetDollars) * 100) : null,
          dailyBudgetCents:
            budgetMode === 'DAILY' && dailyBudgetDollars
              ? Math.round(Number(dailyBudgetDollars) * 100)
              : null,
          startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
          endsAt: ongoing || !endsAt ? null : new Date(`${endsAt}T23:59:59`).toISOString(),
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save config');
      setCampaign(data.campaign);
      setStatus(data.campaign?.status || status);
      setActivateOn(Boolean(data.campaign?.activateOn));
      setEditOpen(false);
      setMsg('Config saved. Activate when ready — dials follow the start/end dates.');
    } catch (e: any) {
      setErr(e.message || 'Could not save config');
    } finally {
      setConfigBusy(false);
    }
  }

  async function setActive(next: boolean) {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    if (campaign?.status === 'CLOSED') return;
    setConfigBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activateOn: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update status');
      setCampaign(data.campaign);
      setStatus(data.campaign?.status || status);
      setActivateOn(Boolean(data.campaign?.activateOn));
      setMsg(
        next
          ? 'Campaign armed. Dials unlock on the start date and stop on the end date.'
          : 'Deactivated. Live calls finish; you can edit config now.'
      );
    } catch (e: any) {
      setErr(e.message || 'Could not update status');
    } finally {
      setConfigBusy(false);
    }
  }

  async function fundCampaign(dollars: number) {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    const brandId = campaign?.brandId || campaign?.brand?.id || brandKey;
    const amountCents = Math.round(dollars * 100);
    if (amountCents < 5000) {
      setErr('Minimum fund is $50');
      return;
    }
    setFundBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${brandId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          returnTo: 'campaign',
          campaignId: id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setFundBusy(false);
    }
  }

  async function allocateFromWallet() {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    const amountCents = Math.round(Number(allocateDollars) * 100);
    if (amountCents < 1000) {
      setErr('Minimum allocate is $10');
      return;
    }
    setFundBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/campaigns/${id}/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Allocate failed');
      setCampaign(data.campaign);
      setMsg(data.notice || 'Escrow updated.');
      const brandId = campaign?.brandId || campaign?.brand?.id;
      if (brandId) await loadLedger(brandId, id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Allocate failed');
    } finally {
      setFundBusy(false);
    }
  }

  async function setAppStatus(applicationId: string, next: string) {
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
    const res = await fetch(`/api/campaigns/${id}/applications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, status: next }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? data.notice || `Marked ${next}.` : '');
    setErr(res.ok ? '' : data.error || 'Update failed');
    if (res.ok) {
      // Reload applications after status change (live only).
      const appsRes = await fetch(`/api/campaigns/${id}/applications`);
      if (appsRes.ok) {
        const apps = await appsRes.json();
        setApplications(apps.applications || []);
      }
    }
  }

  async function bookMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (isDemo || isDemoEntityId(id)) {
      setMsg(DEMO_MSG);
      return;
    }
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
        <Link href={brandKey ? `/brands/${brandKey}/campaigns` : '/brands'} className="soft-link">
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
        <Link
          href={
            canManage
              ? brandHref(campaign.brand || brandKey, 'campaigns')
              : '/gigs'
          }
          className="muted"
          style={{ fontWeight: 600 }}
        >
          ← {canManage ? 'Campaigns' : 'Brand deals'}
        </Link>
      </p>

      <PageHeader
        eyebrow={campaign.brand?.name || 'Campaign'}
        title={campaign.title}
        description={`${campaign.payoutLabel} · ${campaign.earningsModelLabel || campaign.goalLabel?.toLowerCase() || 'result'} · ${campaign.dateRangeLabel || campaign.status}`}
        actions={
          campaign.practiceHref ? (
            <Link href={campaign.practiceHref} className="btn">
              Practice pack →
            </Link>
          ) : undefined
        }
      />

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}

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

      {canManage && (
        <>
          <Panel
            title="Campaign"
            description="Deactivate to edit schedule or targeting. Start/end dates control when dials unlock; end date auto-deactivates."
            actions={
              <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={campaign.status === 'OPEN' || campaign.status === 'CLOSED'}
                  title={
                    campaign.status === 'OPEN'
                      ? 'Deactivate first to edit'
                      : undefined
                  }
                  onClick={() => {
                    if (campaign.status === 'OPEN') {
                      setErr('Deactivate the campaign before editing.');
                      return;
                    }
                    setEditOpen(true);
                  }}
                >
                  Edit
                </button>
                <Link href={brandHref(campaign.brand || brandKey, 'pipeline')} className="btn-ghost">
                  Pipeline
                </Link>
              </div>
            }
          >
            {campaign.status !== 'CLOSED' ? (
              <Toggle
                checked={activateOn}
                disabled={configBusy || isDemo}
                onChange={(next) => void setActive(next)}
                label={activateOn ? 'Active' : 'Deactivated'}
                description={
                  scheduleStatusHint(
                    { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
                    campaign.status
                  ) ||
                  (activateOn
                    ? 'SDRs can dial when the schedule and calling hours are open. Live calls always finish.'
                    : 'New dials blocked. Edit schedule, calling hours, targeting, or spend cap while deactivated.')
                }
              />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                This campaign is closed.
              </p>
            )}

            <dl className="brand-campaign__meta" style={{ marginTop: '1rem' }}>
              <div>
                <dt>SDR earnings</dt>
                <dd>
                  {campaign.payoutLabel}
                  {campaign.earningsModelLabel ? ` · ${campaign.earningsModelLabel}` : ''}
                </dd>
              </div>
              <div>
                <dt>Schedule</dt>
                <dd>{campaign.dateRangeLabel || '—'}</dd>
              </div>
              <div>
                <dt>Calling hours</dt>
                <dd>
                  {campaign.callingHoursLabel || 'Anytime'}
                  {campaign.callingHoursLabel && !campaign.withinCallingHours
                    ? ' · outside window now'
                    : ''}
                </dd>
              </div>
              <div>
                <dt>Escrow locked</dt>
                <dd>
                  {isDemo
                    ? campaign.escrowLabel || '—'
                    : campaign.escrowLockedCents != null
                      ? `$${((campaign.escrowLockedCents || 0) / 100).toLocaleString()}`
                      : '—'}
                </dd>
              </div>
              <div>
                <dt>Spend remaining</dt>
                <dd>
                  {campaign.remainingOverallCents != null
                    ? `$${(campaign.remainingOverallCents / 100).toLocaleString()}`
                    : campaign.budgetLabel || '—'}
                </dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>
                  {[campaign.targetVertical, campaign.targetLocation]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt>Dial eligible</dt>
                <dd>
                  {campaign.dialNowEligible
                    ? 'Yes — dials open now'
                    : campaign.dialNowEligibleReason ||
                      campaign.dialEligibleReason ||
                      'No'}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Campaign funding"
            description="Credits fund this campaign escrow. Debits are locks and verified goal payouts."
          >
            <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
              Brand wallet available:{' '}
              <strong>${(walletBalanceCents / 100).toLocaleString()}</strong>
              {isDemo ? ' (demo)' : ''}
            </p>
            <div className="billing-fund-presets">
              {FUND_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn"
                  disabled={fundBusy || isDemo}
                  onClick={() => void fundCampaign(d)}
                >
                  ${d.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="billing-fund-custom" style={{ marginTop: '0.65rem' }}>
              <input
                className="field"
                type="number"
                min={50}
                max={5000}
                step={50}
                value={customFund}
                onChange={(e) => setCustomFund(e.target.value)}
                aria-label="Custom fund amount USD"
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={fundBusy || isDemo}
                onClick={() => void fundCampaign(Number(customFund) || 0)}
              >
                {fundBusy ? 'Opening Stripe…' : 'Fund via Stripe'}
              </button>
            </div>
            <div className="billing-fund-custom" style={{ marginTop: '0.65rem' }}>
              <input
                className="field"
                type="number"
                min={10}
                step={10}
                value={allocateDollars}
                onChange={(e) => setAllocateDollars(e.target.value)}
                aria-label="Allocate from wallet USD"
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={fundBusy || isDemo || walletBalanceCents < 1000}
                onClick={() => void allocateFromWallet()}
              >
                Lock from wallet
              </button>
            </div>

            {ledger.length === 0 ? (
              <EmptyState
                title="No ledger activity"
                description="Fund this campaign to see credits and debits here."
              />
            ) : (
              <div className="billing-ledger-wrap" style={{ marginTop: '1rem' }}>
                <table className="billing-ledger">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Entry</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id}>
                        <td className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {new Date(row.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>{row.description}</td>
                        <td
                          style={{
                            color:
                              row.direction === 'debit'
                                ? 'var(--bad)'
                                : row.direction === 'credit'
                                  ? 'var(--good)'
                                  : undefined,
                            fontWeight: 650,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {money(row.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Modal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            title="Edit campaign"
            description="Schedule and targeting. Start/end dates and calling hours control when dials unlock."
            wide
          >
            <div className="stack" style={{ gap: '0.85rem' }}>
              <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 140 }}>
                  Start date
                  <input
                    className="field"
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 140 }}>
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
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>
              <Toggle
                checked={ongoing}
                onChange={(on) => {
                  setOngoing(on);
                  if (on) setEndsAt('');
                }}
                label="Ongoing"
                description="No end date — stays active until you deactivate."
                compact
              />
              <Toggle
                checked={limitCallingHours}
                onChange={setLimitCallingHours}
                label="Limit dialing to calling hours"
                description="Leads only appear in the SDR queue during these hours."
                compact
              />
              {limitCallingHours ? (
                <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                  <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 120 }}>
                    Calls from
                    <input
                      className="field"
                      type="time"
                      value={callingHoursStart}
                      onChange={(e) => setCallingHoursStart(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 120 }}>
                    Calls until
                    <input
                      className="field"
                      type="time"
                      value={callingHoursEnd}
                      onChange={(e) => setCallingHoursEnd(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <label className="muted" style={{ fontSize: '0.85rem', flex: 1.4, minWidth: 160 }}>
                    Timezone
                    <select
                      className="field"
                      value={callingTimezone}
                      onChange={(e) => setCallingTimezone(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
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
              <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 140 }}>
                  Spend cap mode
                  <select
                    className="field"
                    value={budgetMode}
                    onChange={(e) => setBudgetMode(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  >
                    <option value="OVERALL">Overall spend cap</option>
                    <option value="DAILY">Daily spend cap</option>
                  </select>
                </label>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 100 }}>
                  Overall $
                  <input
                    className="field"
                    value={budgetDollars}
                    onChange={(e) => setBudgetDollars(e.target.value)}
                    inputMode="decimal"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
                {budgetMode === 'DAILY' ? (
                  <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 100 }}>
                    Daily $
                    <input
                      className="field"
                      value={dailyBudgetDollars}
                      onChange={(e) => setDailyBudgetDollars(e.target.value)}
                      inputMode="decimal"
                      style={{ display: 'block', width: '100%', marginTop: 4 }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="search-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 160 }}>
                  Target vertical
                  <input
                    className="field"
                    value={targetVertical}
                    onChange={(e) => setTargetVertical(e.target.value)}
                    placeholder="e.g. athletic retailers"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted" style={{ fontSize: '0.85rem', flex: 1, minWidth: 160 }}>
                  Target location
                  <input
                    className="field"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder="e.g. Portland, OR"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
              </div>
              <label className="muted" style={{ fontSize: '0.85rem' }}>
                Booking link
                <input
                  className="field"
                  value={bookingLinkDraft}
                  onChange={(e) => setBookingLinkDraft(e.target.value)}
                  placeholder="https://cal.com/you/intro"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={configBusy}
                  onClick={() => void saveConfig()}
                >
                  {configBusy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </Modal>

          <Panel
            title="Progress snapshot"
            description="Match state for leads on this campaign vs goal cap."
          >
            <div className="brand-campaign__progress">
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Targeting</span>
                <span className="brand-campaign__progress-value">{progress.targeting}</span>
              </div>
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Conditioning</span>
                <span className="brand-campaign__progress-value">{progress.conditioning}</span>
              </div>
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Dial-ready</span>
                <span className="brand-campaign__progress-value">{progress.dialingReady}</span>
              </div>
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Dialing</span>
                <span className="brand-campaign__progress-value">{progress.dialingActive}</span>
              </div>
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Appointments</span>
                <span className="brand-campaign__progress-value brand-campaign__progress-value--ok">
                  {progress.booked}
                  {campaign.maxAwards != null ? ` / ${campaign.maxAwards}` : ''}
                </span>
              </div>
              <div className="brand-campaign__progress-cell">
                <span className="brand-campaign__progress-label">Applicants</span>
                <span className="brand-campaign__progress-value">{applications.length}</span>
              </div>
            </div>
            <p className="muted small" style={{ margin: '0.75rem 0 0' }}>
              {progress.total} leads · {progress.dials} dialed
              {progress.failed > 0 ? ` · ${progress.failed} need attention` : ''}
            </p>
          </Panel>

          <Panel title="History" description="Scout jobs and recent activity for this campaign.">
            {campaignJobs.length === 0 && applications.length === 0 && bookings.length === 0 ? (
              <EmptyState
                title="No history yet"
                description="Find leads on Pipeline or wait for SDR applications and bookings."
              />
            ) : (
              <ul className="brand-campaign__history">
                {campaignJobs.map((j) => (
                  <li key={j.id}>
                    <strong>Scout · {j.query}</strong> in {j.location}
                    <span className="muted">
                      {' '}
                      · {j.status} · {j.savedCount} saved · {j.readyCount} dial-ready ·{' '}
                      {new Date(j.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {j.errorMessage ? (
                      <div className="muted small" style={{ color: 'crimson' }}>
                        {j.errorMessage}
                      </div>
                    ) : null}
                  </li>
                ))}
                {applications.slice(0, 8).map((a) => (
                  <li key={`app-${a.id}`}>
                    <strong>Application · {a.applicant?.displayName || 'Rep'}</strong>
                    <span className="muted">
                      {' '}
                      · {a.status}
                      {a.createdAt
                        ? ` · ${new Date(a.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                    </span>
                  </li>
                ))}
                {bookings.slice(0, 5).map((b) => (
                  <li key={`book-${b.id}`}>
                    <strong>Booking · {b.title}</strong>
                    <span className="muted">
                      {' '}
                      · {new Date(b.startsAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {myApp && !canManage && (
        <Panel title="Your payout" description="Connect Stripe under Billing so brands can pay you when they approve a result.">
          <p className="muted" style={{ margin: 0 }}>
            Campaign pays {campaign.payoutLabel}
            {campaign.earningsModelLabel
              ? ` (${campaign.earningsModelLabel})`
              : ` per ${campaign.goalLabel?.toLowerCase() || 'result'}`}{' '}
            (20% platform fee, capped — see Pricing). Manage Connect on{' '}
            <Link href="/billing" className="soft-link">
              Billing
            </Link>
            .
          </p>
        </Panel>
      )}

      {canManage && (
        <>
          <Panel
            title="Applicants"
            description="Accept → Active to start work. Outcome payouts take 20% (capped at $30). SDRs must finish payout setup under Billing."
            actions={
              campaign.basePayCents ? (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={basePayBusy || campaign.status !== 'OPEN'}
                  onClick={() => void payBaseNow()}
                >
                  {basePayBusy
                    ? 'Paying base…'
                    : `Pay base now${campaign.basePayLabel ? ` (${campaign.basePayLabel})` : ''}`}
                </button>
              ) : undefined
            }
          >
            {applications.length === 0 ? (
              <EmptyState title="No applicants yet" description="Share the brand deals board with SDRs." />
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

      {!canManage && myAppStatus && ['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(myAppStatus) && (
        <Panel
          title="Claim booked meeting"
          description="Submit notes from the live call. AI audits BANT + meeting set, then escrow auto-releases to your Connect account. Brands can dispute afterward."
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
                if (isDemo || isDemoEntityId(id)) {
                  setMsg(DEMO_MSG);
                  return;
                }
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
