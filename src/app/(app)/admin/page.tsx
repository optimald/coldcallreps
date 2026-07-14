'use client';

import Link from 'next/link';
import { AdminFraudScatter, AdminLiquidityChart } from '@/components/AdminCharts';
import {
  AdminGate,
  AdminPageChrome,
  useAdminFetch,
} from '@/components/AdminPageKit';
import {
  EmptyState,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';
import type { AdminPlatformOverview } from '@/lib/admin-platform-types';

export default function AdminCommandPage() {
  const { data, forbidden, error } = useAdminFetch<AdminPlatformOverview>(
    '/api/admin/overview'
  );
  const k = data?.kpis;

  return (
    <AdminGate title="Admin" forbidden={forbidden}>
      <AdminPageChrome
        title="Command center"
        description="Marketplace liquidity, float, take-rate, and trust — network health at a glance."
      >
        {error ? <p className="msg-err">{error}</p> : null}

        {!data || !k ? (
          <Panel>
            <p className="muted" style={{ margin: 0 }}>
              Loading platform pulse…
            </p>
          </Panel>
        ) : (
          <>
            {data.alerts.length > 0 ? (
              <div className="admin-alerts">
                {data.alerts.map((a) => (
                  <div
                    key={a.id}
                    className={`admin-alert admin-alert--${a.severity}`}
                  >
                    <div>
                      <strong>{a.title}</strong>
                      <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                        {a.detail}
                      </p>
                    </div>
                    {a.href ? (
                      <Link href={a.href} className="btn-ghost">
                        Open
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <StatGrid>
              <Stat label="TVL (wallets + escrow)" value={k.tvlLabel} tone="accent" />
              <Stat label="GMV (30d)" value={k.gmv30dLabel} />
              <Stat label="Take-rate (30d)" value={k.takeRate30dLabel} tone="good" />
              <Stat label="Est. SaaS MRR" value={k.estimatedMrrLabel} />
              <Stat
                label="Lead → SDR ratio"
                value={k.leadToRepRatio != null ? k.leadToRepRatio : '—'}
                tone={
                  k.leadToRepRatio != null && k.leadToRepRatio < 5 ? 'warn' : undefined
                }
              />
              <Stat
                label="Connect rate (30d)"
                value={k.connectRatePct != null ? `${k.connectRatePct}%` : '—'}
              />
              <Stat
                label="AI audit fail (30d)"
                value={k.auditFailRatePct != null ? `${k.auditFailRatePct}%` : '—'}
                tone={
                  k.auditFailRatePct != null && k.auditFailRatePct >= 25
                    ? 'bad'
                    : undefined
                }
              />
              <Stat
                label="Pending payouts"
                value={`${k.pendingPayoutCount} · ${k.pendingPayoutLabel}`}
                tone={k.pendingPayoutCount > 0 ? 'warn' : 'good'}
              />
            </StatGrid>

            <div className="admin-kpi-row muted">
              <span>
                {k.openCampaigns} open campaigns · {k.activeSdrs} active SDRs ·{' '}
                {k.outreachReady} dial-ready leads · {k.dialers24h} dialers (24h)
              </span>
              <span>
                Lead plans {k.leadPlanMrrLabel}/mo · SDR subs {k.sdrSubMrrLabel}/mo ·{' '}
                {k.brandsAtRisk} brands at risk
              </span>
            </div>

            <div className="admin-charts">
              <Panel
                compact
                className="admin-charts__main"
                title="Marketplace liquidity"
                description="New leads saved vs dials placed · last 30 days"
              >
                <AdminLiquidityChart days={data.liquiditySeries} height={210} />
              </Panel>
              <Panel
                compact
                className="admin-charts__side"
                title="Fraud grid"
                description="Bookings vs AI audit fail rate by SDR"
              >
                <AdminFraudScatter points={data.fraudScatter} height={210} />
              </Panel>
            </div>

            <div className="admin-split">
              <Panel
                title="Exceptions"
                description="Highest-priority brand desk signals"
                actions={<SoftLink href="/admin/brands">All brands →</SoftLink>}
              >
                {data.exceptions.length === 0 ? (
                  <EmptyState
                    title="No hot exceptions"
                    description="Brand desks look healthy on the sampled set."
                  />
                ) : (
                  <ul className="list-quiet admin-exception-list">
                    {data.exceptions.map((ex, i) => (
                      <li key={`${ex.brandId}-${i}`}>
                        <Link href={`/brands/${ex.brandKey}`}>{ex.brandName}</Link>
                        {' · '}
                        <strong>{ex.label}</strong>
                        <span className="muted"> — {ex.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Recent audit">
                {data.audits.length === 0 ? (
                  <EmptyState
                    title="No audit events"
                    description="Admin overrides and role changes appear here."
                  />
                ) : (
                  <ul className="list-quiet">
                    {data.audits.map((a) => (
                      <li key={a.id}>
                        {new Date(a.createdAt).toLocaleString()} · {a.actorEmail} ·{' '}
                        {a.action}{' '}
                        {a.targetId ? (
                          <span className="muted">{a.targetId.slice(0, 8)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {data.pipelineFailed.length > 0 ? (
              <Panel title="Failed pipeline jobs" description="Recent scrape / enrich failures">
                <ul className="list-quiet">
                  {data.pipelineFailed.map((j) => (
                    <li key={j.id}>
                      <Link href={`/brands/${j.brandKey}/pipeline`}>{j.brandName}</Link>
                      {' · '}
                      {j.query} @ {j.location}
                      {j.error ? (
                        <span className="muted"> — {j.error.slice(0, 120)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </>
        )}
      </AdminPageChrome>
    </AdminGate>
  );
}
