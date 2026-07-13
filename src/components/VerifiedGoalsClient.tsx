'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { brandHref } from '@/lib/brand-context';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import {
  DeskToolbar,
  DeskToolbarSearch,
  DeskToolbarSelect,
} from '@/components/ui/DeskChrome';
import { goalDisposition, type VerifiedGoalRow } from '@/lib/verified-goals-shared';

export type { VerifiedGoalRow };

function formatWhen(iso: string) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '—';
  const upcoming = when.getTime() > Date.now();
  if (upcoming) {
    return when.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return when.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPayout(cents: number | null | undefined) {
  if (cents == null || cents <= 0) return null;
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function VerifiedGoalsClient({
  initial,
  mode = 'brand',
  brandKey,
  title,
  description,
}: {
  initial: VerifiedGoalRow[];
  mode?: 'brand' | 'sdr';
  brandKey?: string;
  /** Optional panel title — omit when PageHeader already names the page. */
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | VerifiedGoalRow['kind']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'payable' | 'pending' | 'paid'>('all');
  const [repFilter, setRepFilter] = useState(() => searchParams.get('rep') || '');
  const [campaignFilter, setCampaignFilter] = useState(() => searchParams.get('campaign') || '');

  useEffect(() => {
    setRepFilter(searchParams.get('rep') || '');
    setCampaignFilter(searchParams.get('campaign') || '');
  }, [searchParams]);

  const reps = useMemo(() => {
    if (mode !== 'brand') return [];
    const map = new Map<string, string>();
    for (const g of initial) {
      if (g.repUserId) map.set(g.repUserId, g.repName);
    }
    if (repFilter && !map.has(repFilter)) {
      map.set(repFilter, 'Selected SDR');
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [initial, mode, repFilter]);

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of initial) {
      if (g.campaignId && g.campaignTitle) map.set(g.campaignId, g.campaignTitle);
    }
    if (campaignFilter && !map.has(campaignFilter)) {
      map.set(campaignFilter, 'Selected campaign');
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [initial, campaignFilter]);

  function patchFilters(next: { rep?: string; campaign?: string }) {
    if (next.rep !== undefined) setRepFilter(next.rep);
    if (next.campaign !== undefined) setCampaignFilter(next.campaign);
    const params = new URLSearchParams(searchParams.toString());
    if (next.rep !== undefined) {
      if (next.rep) params.set('rep', next.rep);
      else params.delete('rep');
    }
    if (next.campaign !== undefined) {
      if (next.campaign) params.set('campaign', next.campaign);
      else params.delete('campaign');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setRepFilterAndUrl(next: string) {
    patchFilters({ rep: next });
  }

  function setCampaignFilterAndUrl(next: string) {
    patchFilters({ campaign: next });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.filter((g) => {
      if (repFilter && g.repUserId !== repFilter) return false;
      if (campaignFilter && g.campaignId !== campaignFilter) return false;
      if (kindFilter !== 'all' && g.kind !== kindFilter) return false;
      const s = (g.status || '').toUpperCase();
      const ps = (g.payoutStatus || '').toUpperCase();
      if (statusFilter === 'payable' && !(s === 'PASSED' || s === 'BOOKED' || ps === 'PENDING')) {
        return false;
      }
      if (statusFilter === 'pending' && s !== 'PENDING_AUDIT' && ps !== 'PENDING') return false;
      if (statusFilter === 'paid' && s !== 'PAID' && ps !== 'PAID') return false;
      if (!q) return true;
      const hay = [
        g.companyName,
        g.repName,
        g.campaignTitle || '',
        g.brandName || '',
        g.title,
        g.status,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [initial, query, kindFilter, statusFilter, repFilter, campaignFilter]);

  const payableCount = initial.filter((g) => {
    const s = (g.status || '').toUpperCase();
    const ps = (g.payoutStatus || '').toUpperCase();
    return s === 'PASSED' || s === 'BOOKED' || ps === 'PENDING' || s === 'PAID' || ps === 'PAID';
  }).length;

  return (
    <Panel
      compact
      title={title}
      description={
        description ||
        `${filtered.length}${filtered.length !== initial.length ? ` of ${initial.length}` : ''} · ${payableCount} payout-eligible`
      }
    >
      {initial.length > 0 ? (
        <DeskToolbar>
          <DeskToolbarSearch
            value={query}
            onChange={setQuery}
            placeholder={
              mode === 'sdr'
                ? 'Filter by company, brand, campaign…'
                : 'Filter by company, SDR, campaign…'
            }
            label="Filter goals"
          />
          {mode === 'brand' && reps.length > 0 ? (
            <DeskToolbarSelect
              value={repFilter}
              onChange={setRepFilterAndUrl}
              label="SDR"
            >
              <option value="">All SDRs</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </DeskToolbarSelect>
          ) : null}
          {campaigns.length > 0 ? (
            <DeskToolbarSelect
              value={campaignFilter}
              onChange={setCampaignFilterAndUrl}
              label="Campaign"
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </DeskToolbarSelect>
          ) : null}
          <DeskToolbarSelect
            value={kindFilter}
            onChange={(next) => setKindFilter(next as typeof kindFilter)}
            label="Type"
          >
            <option value="all">All types</option>
            <option value="booking">Meetings booked</option>
            <option value="claim">Appointment claims</option>
            <option value="call">Qualified dials</option>
          </DeskToolbarSelect>
          <DeskToolbarSelect
            value={statusFilter}
            onChange={(next) => setStatusFilter(next as typeof statusFilter)}
            label="Payout status"
          >
            <option value="all">All statuses</option>
            <option value="payable">Payout-eligible</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </DeskToolbarSelect>
        </DeskToolbar>
      ) : null}

      {initial.length === 0 ? (
        <EmptyState
          title="No verified goals yet"
          description={
            mode === 'sdr'
              ? 'When you book a meeting or get a claim audited, it shows up here — and flows to Earnings when paid.'
              : 'Booked meetings and audited appointment claims land here once SDRs hit campaign goals.'
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" description="Try a different filter." />
      ) : (
        <div className="verified-goals-table-wrap">
          <table className="verified-goals-table">
            <thead>
              <tr>
                <th scope="col">Lead / company</th>
                {mode === 'brand' ? <th scope="col">SDR</th> : <th scope="col">Brand</th>}
                <th scope="col">Campaign</th>
                <th scope="col">Outcome</th>
                <th scope="col">Payout</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const disp = goalDisposition(
                  g.status,
                  g.kind,
                  g.kind === 'booking' ? 'meeting_booked' : g.status
                );
                const payout = formatPayout(g.payoutCents);
                const href =
                  g.brandKey && g.campaignId
                    ? brandHref(g.brandKey, 'campaigns', g.campaignId)
                    : g.brandKey
                      ? brandHref(g.brandKey, 'calls')
                      : brandKey && g.campaignId
                        ? brandHref(brandKey, 'campaigns', g.campaignId)
                        : brandKey
                          ? brandHref(brandKey, 'calls')
                          : mode === 'sdr'
                            ? '/earnings'
                            : '#';
                const upcoming = new Date(g.at).getTime() > Date.now();
                return (
                  <tr key={g.id}>
                    <td>
                      <Link href={href} className="verified-goals-table__name">
                        {g.companyName}
                      </Link>
                      <div className="muted small">{g.title}</div>
                    </td>
                    <td className="muted">
                      {mode === 'brand' ? g.repName : g.brandName || '—'}
                    </td>
                    <td className="muted">{g.campaignTitle || '—'}</td>
                    <td>
                      <span className={`brand-home__disp brand-home__disp--${disp.tone}`}>
                        {disp.label}
                      </span>
                      {upcoming ? (
                        <span className="muted small" style={{ marginLeft: '0.35rem' }}>
                          upcoming
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {payout ? (
                        <span>
                          {payout}
                          {g.payoutStatus ? (
                            <span className="muted small" style={{ marginLeft: '0.35rem' }}>
                              ({g.payoutStatus.toLowerCase()})
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{formatWhen(g.at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
