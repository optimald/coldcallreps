'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import {
  activeMatchStage,
  matchProgressOf,
  matchStageCopy,
} from '@/lib/brand-lead-match';
import {
  DEMO_MSG,
  getDemoCampaigns,
  getDemoLeads,
  getDemoPipelineJobs,
  type DemoPipelineJob,
} from '@/lib/demo/brand-demo-data';

type BrandOpt = { id: string; name: string; slug: string | null };
type CampaignOpt = { id: string; title: string; brandId: string };
type JobRow = {
  id: string;
  query: string;
  location: string;
  status: string;
  savedCount: number;
  readyCount: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  campaignId?: string | null;
  campaign?: { id: string; title: string } | null;
};

function formatTs(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function jobStatusClass(status: string) {
  if (status === 'completed') return 'brand-pipeline__job-status--ok';
  if (status === 'failed') return 'brand-pipeline__job-status--fail';
  if (status === 'running' || status === 'queued') return 'brand-pipeline__job-status--run';
  return '';
}

function demoJobsToRows(jobs: DemoPipelineJob[]): JobRow[] {
  return jobs.map((j) => ({
    id: j.id,
    query: j.query,
    location: j.location,
    status: j.status,
    savedCount: j.savedCount,
    readyCount: j.readyCount,
    errorMessage: j.errorMessage,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
    campaignId: j.campaignId,
    campaign: j.campaignTitle
      ? { id: j.campaignId || '', title: j.campaignTitle }
      : null,
  }));
}

export default function BrandPipelineClient({
  brands,
  campaigns,
}: {
  brands: BrandOpt[];
  campaigns: CampaignOpt[];
}) {
  const { mode, hydrated } = useBrandDeskMode();
  const isLive = mode === 'live';
  const isDemo = mode === 'demo';
  const brandId = brands[0]?.id || '';
  const brandKey = brands[0]?.slug || brands[0]?.id || '';
  const searchParams = useSearchParams();

  const brandCampaigns = useMemo(() => {
    if (isLive) return campaigns.filter((c) => c.brandId === brandId);
    return getDemoCampaigns(brandKey).map((c) => ({
      id: c.id,
      title: c.title,
      brandId: brandId || 'demo',
    }));
  }, [isLive, campaigns, brandId, brandKey]);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [leadsPool, setLeadsPool] = useState(() => getDemoLeads(brandKey || 'demo-meridianops'));
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [mapsQuery, setMapsQuery] = useState('independent life insurance agencies');
  const [mapsLocation, setMapsLocation] = useState('Austin, TX');
  const [mapsCampaignId, setMapsCampaignId] = useState('');
  const [geoMode, setGeoMode] = useState<'city' | 'state' | 'nationwide'>('city');
  const [maxResults, setMaxResults] = useState(10);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(true);
  const [mapsBusy, setMapsBusy] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (searchParams.get('find') === '1') setFindOpen(true);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!hydrated) return;
    setLoading(true);
    try {
      if (mode === 'demo') {
        setJobs(demoJobsToRows(getDemoPipelineJobs(brandKey)));
        setLeadsPool(getDemoLeads(brandKey));
        return;
      }
      if (!brandId) return;
      const [jobsRes, leadsRes] = await Promise.all([
        fetch(`/api/brands/${brandId}/pipeline/jobs?limit=40`),
        fetch(`/api/prospects?brandId=${encodeURIComponent(brandId)}&limit=200`),
      ]);
      const jobsData = await jobsRes.json().catch(() => ({}));
      const leadsData = await leadsRes.json().catch(() => ({}));
      if (jobsRes.ok) setJobs(jobsData.jobs || []);
      if (leadsRes.ok) setLeadsPool(leadsData.prospects || []);
    } finally {
      setLoading(false);
    }
  }, [hydrated, mode, brandId, brandKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!findOpen || !brandId || isDemo) {
      setCreditsLeft(isDemo ? 100 : null);
      return;
    }
    void fetch(`/api/brands/${encodeURIComponent(brandId)}/billing`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.credits?.totalRemaining != null) setCreditsLeft(d.credits.totalRemaining);
      })
      .catch(() => setCreditsLeft(null));
  }, [findOpen, brandId, isDemo]);

  const matchKpis = useMemo(() => matchProgressOf(leadsPool), [leadsPool]);
  const matchStage = useMemo(() => activeMatchStage(matchKpis), [matchKpis]);
  const stageCopy = matchStageCopy(matchStage);

  async function findLeads(e?: FormEvent) {
    e?.preventDefault();
    if (!mapsQuery.trim() || !mapsLocation.trim()) {
      setMsg('Keyword and geo area are required');
      return;
    }
    const location =
      geoMode === 'nationwide'
        ? mapsLocation.trim() || 'United States'
        : mapsLocation.trim();
    if (isDemo) {
      setMsg(
        `Demo: scrape plan “${mapsQuery.trim()}” · ${geoMode} · ${location} (credits not deducted).`
      );
      setFindOpen(false);
      return;
    }
    if (!brandId) return;
    setMapsBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/scrape/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          campaignId: mapsCampaignId || null,
          query: mapsQuery.trim(),
          keyword: mapsQuery.trim(),
          location,
          geo: location,
          maxResults,
          noWebsiteOnly,
          async: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed');
      if (data.creditBlocked) {
        setMsg(
          `Credits exhausted mid-run · ${data.saved || 0} saved. Upgrade on Billing to continue.`
        );
      } else {
        setMsg(
          `Job finished · ${data.saved || 0} saved · ${data.outreachReady || 0} dial-ready` +
            (data.creditsRemaining != null ? ` · ${data.creditsRemaining} credits left` : '')
        );
      }
      setFindOpen(false);
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Scrape failed');
    } finally {
      setMapsBusy(false);
    }
  }

  return (
    <div className="stack brand-pipeline">
      <div className="brand-pipeline__toolbar">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            Scrape jobs are the main queue. New scrape plan opens as a popup — Maps keyword + geo →
            enrich (1 credit / saved lead).
          </p>
        </div>
        <div className="brand-leads__actions" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFindOpen(true)}>
            New scrape plan
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
          {brandKey ? (
            <Link href={`/brands/${brandKey}/leads`} className="btn btn-ghost btn-sm">
              View leads
            </Link>
          ) : null}
          <Link href="/billing" className="btn btn-ghost btn-sm">
            Lead credits
          </Link>
        </div>
      </div>

      {msg ? <p className="form-msg">{msg}</p> : null}

      <section className="brand-leads__match" aria-label="Match progress">
        <div className="brand-leads__match-stages">
          <div
            className={`brand-leads__match-stage${matchStage === 'targeting' ? ' is-active' : ''}${
              matchKpis.targeting === 0 && matchKpis.total > 0 ? ' is-done' : ''
            }`}
          >
            <span className="brand-leads__match-stage-label">Targeting Matches</span>
            <span className="brand-leads__match-stage-count">{matchKpis.targeting}</span>
          </div>
          <div className="brand-leads__match-arrow" aria-hidden>
            →
          </div>
          <div
            className={`brand-leads__match-stage${matchStage === 'conditioning' ? ' is-active' : ''}${
              matchKpis.conditioning === 0 && matchKpis.dialingReady + matchKpis.booked > 0
                ? ' is-done'
                : ''
            }`}
          >
            <span className="brand-leads__match-stage-label">Conditioning Leads</span>
            <span className="brand-leads__match-stage-count">{matchKpis.conditioning}</span>
          </div>
          <div className="brand-leads__match-arrow" aria-hidden>
            →
          </div>
          <div className={`brand-leads__match-stage${matchStage === 'ring' ? ' is-active' : ''}`}>
            <span className="brand-leads__match-stage-label">In the Ring</span>
            <span className="brand-leads__match-stage-count">{matchKpis.dialingReady}</span>
          </div>
        </div>
        <p className="brand-leads__match-copy muted small">{stageCopy}</p>
        <div className="brand-leads__match-metrics">
          <div className="brand-leads__match-metric">
            <span className="brand-leads__match-metric-label">Leads dialing</span>
            <span className="brand-leads__match-metric-value">{matchKpis.dialingActive}</span>
          </div>
          <div className="brand-leads__match-metric-sep" />
          <div className="brand-leads__match-metric">
            <span className="brand-leads__match-metric-label">Appointments locked</span>
            <span className="brand-leads__match-metric-value brand-leads__match-metric-value--ok">
              {matchKpis.booked}
            </span>
          </div>
          <div className="brand-leads__match-metric-sep" />
          <div className="brand-leads__match-metric">
            <span className="brand-leads__match-metric-label">Total</span>
            <span className="brand-leads__match-metric-value">{matchKpis.total}</span>
          </div>
          {matchKpis.failed > 0 ? (
            <>
              <div className="brand-leads__match-metric-sep" />
              <div className="brand-leads__match-metric">
                <span className="brand-leads__match-metric-label">Needs attention</span>
                <span className="brand-leads__match-metric-value brand-leads__match-metric-value--warn">
                  {matchKpis.failed}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <div className="brand-leads__panel">
        <div className="brand-pipeline__jobs-head">
          <h2 className="brand-pipeline__jobs-title">Scrape jobs</h2>
        </div>
        {loading && jobs.length === 0 ? (
          <div className="brand-leads__empty">
            <p className="muted">Loading jobs…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="brand-leads__empty">
            <p className="muted">No scrape jobs yet. Create a scrape plan to start.</p>
            <button type="button" className="btn btn-primary" onClick={() => setFindOpen(true)}>
              New scrape plan
            </button>
          </div>
        ) : (
          <div className="brand-leads__table-wrap">
            <table className="brand-leads__table brand-pipeline__jobs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Vertical</th>
                  <th>Location</th>
                  <th>Campaign</th>
                  <th>Saved</th>
                  <th>Dial-ready</th>
                  <th>Started</th>
                  <th>Finished</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <span className={`brand-pipeline__job-status ${jobStatusClass(j.status)}`}>
                        {j.status}
                      </span>
                      {j.errorMessage ? (
                        <div className="muted small" title={j.errorMessage}>
                          {j.errorMessage.slice(0, 40)}
                        </div>
                      ) : null}
                    </td>
                    <td>{j.query}</td>
                    <td className="muted small">{j.location}</td>
                    <td className="muted small">{j.campaign?.title || '—'}</td>
                    <td>{j.savedCount}</td>
                    <td>{j.readyCount}</td>
                    <td className="muted small">{formatTs(j.createdAt)}</td>
                    <td className="muted small">{formatTs(j.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={findOpen}
        onClose={() => !mapsBusy && setFindOpen(false)}
        title="New scrape plan"
        wide
      >
        <form className="stack gap-sm" onSubmit={findLeads}>
          <p className="muted small">
            Free-form Maps keyword + geo. Local brands use city; nationwide brands can set state or
            United States. Each newly saved lead costs 1 credit (imports stay free).
          </p>
          <label className="field-label">
            Keyword (Google Maps query)
            <input
              className="field"
              value={mapsQuery}
              onChange={(e) => setMapsQuery(e.target.value)}
              placeholder="e.g. independent life insurance agencies"
              required
              autoFocus
            />
          </label>
          <div className="grid-2">
            <label className="field-label">
              Geo scope
              <select
                className="field"
                value={geoMode}
                onChange={(e) => {
                  const v = e.target.value as 'city' | 'state' | 'nationwide';
                  setGeoMode(v);
                  if (v === 'nationwide') setMapsLocation('United States');
                }}
              >
                <option value="city">City / metro</option>
                <option value="state">State / region</option>
                <option value="nationwide">Nationwide</option>
              </select>
            </label>
            <label className="field-label">
              Geo area
              <input
                className="field"
                value={mapsLocation}
                onChange={(e) => setMapsLocation(e.target.value)}
                placeholder={
                  geoMode === 'city'
                    ? 'e.g. Austin, TX'
                    : geoMode === 'state'
                      ? 'e.g. Texas'
                      : 'United States'
                }
                required
              />
            </label>
          </div>
          <div className="grid-2">
            <label className="field-label">
              Batch count
              <input
                className="field"
                type="number"
                min={1}
                max={25}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.min(25, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
            <label className="field-label">
              Assign campaign (optional)
              <select
                className="field"
                value={mapsCampaignId}
                onChange={(e) => setMapsCampaignId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {brandCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Preview query:{' '}
            <strong>
              {mapsQuery.trim() || '…'}
              {mapsLocation.trim() && !mapsQuery.toLowerCase().includes(mapsLocation.toLowerCase())
                ? ` in ${mapsLocation.trim()}`
                : ''}
            </strong>
          </p>
          <Toggle
            compact
            checked={noWebsiteOnly}
            onChange={setNoWebsiteOnly}
            label="Prefer no-website leads"
            description="Often stronger phone-first outreach"
          />
          {creditsLeft != null && creditsLeft <= 0 ? (
            <p className="msg-err">
              No lead credits left.{' '}
              <Link href="/billing" className="soft-link">
                Upgrade or buy a pack →
              </Link>
            </p>
          ) : null}
          <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={mapsBusy}
              onClick={() => setFindOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mapsBusy || (creditsLeft != null && creditsLeft <= 0 && isLive)}
            >
              {mapsBusy ? 'Executing…' : isDemo ? 'Execute (demo)' : 'Execute scrape'}
            </button>
          </div>
          {isDemo ? <p className="muted small">{DEMO_MSG}</p> : null}
        </form>
      </Modal>
    </div>
  );
}
