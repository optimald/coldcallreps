'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';

type Campaign = {
  id: string;
  title: string;
  description: string;
  payoutLabel: string;
  goalLabel: string;
  minScore?: number | null;
  requireCertification?: boolean;
  brand?: { name: string; slug: string; logoUrl?: string | null };
  practiceHref?: string | null;
  myApplication?: { id: string; status: string } | null;
};

type MyApp = {
  id: string;
  status: string;
  campaign: Campaign;
  payout?: { id: string; status: string; netCents?: number; paidAt?: string | null } | null;
};

function displayBrandName(name?: string | null) {
  if (!name) return 'Brand';
  return name.replace(/^Demo\s*[·•]\s*/i, '').trim() || name;
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export default function GigsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mine, setMine] = useState<MyApp[]>([]);
  const [brandInterest, setBrandInterest] = useState<
    {
      id: string;
      brand: { id: string; name: string; slug: string; logoUrl?: string | null } | null;
      fromName: string | null;
      updatedAt: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    text: string;
    practiceHref?: string | null;
    tone: 'ok' | 'warn';
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [openRes, mineRes, interestRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/campaigns?mine=1'),
        fetch('/api/talent/interest?mine=1'),
      ]);
      const openData = await openRes.json().catch(() => ({}));
      const mineData = await mineRes.json().catch(() => ({}));
      const interestData = await interestRes.json().catch(() => ({}));
      if (openRes.ok) setCampaigns(openData.campaigns || []);
      if (mineRes.ok) setMine(mineData.applications || []);
      if (interestRes.ok) setBrandInterest(interestData.interests || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function apply(campaignId: string) {
    setBusyId(campaignId);
    setNotice(null);
    const res = await fetch(`/api/campaigns/${campaignId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok && res.status !== 409) {
      setNotice({
        text: data.error || 'Could not apply',
        practiceHref: data.practiceHref || null,
        tone: 'warn',
      });
      return;
    }
    setNotice({
      text: data.notice || data.error || 'Applied.',
      practiceHref: data.practiceHref || null,
      tone: 'ok',
    });
    await load();
  }

  return (
    <main className="app-page app-page--desk gigs-page">
      <PageHeader
        compact
        eyebrow="Earn"
        title="Brand deals"
        description="Open campaigns — practice, apply, deliver, get paid from escrow."
        actions={
          <>
            <Link href="/earnings" className="btn-ghost">
              Earnings
            </Link>
            <Link href="/practice" className="btn-ghost">
              Practice
            </Link>
          </>
        }
      />

      {notice ? (
        <div
          className={`gigs-page__notice ${notice.tone === 'warn' ? 'gigs-page__notice--warn' : 'gigs-page__notice--ok'}`}
          role="status"
        >
          <p className="gigs-page__notice-text">{notice.text}</p>
          {notice.practiceHref ? (
            <Link href={notice.practiceHref} className="btn btn--sm">
              Practice this pack
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Loading brand deals…</p>
      ) : (
        <div className="gigs-desk">
          {brandInterest.length > 0 ? (
            <Panel
              compact
              className="gigs-desk__interest"
              title="Brands interested in you"
              description="Shortlisted from Recruit — review their open campaigns below and apply."
            >
              <ul className="brand-list">
                {brandInterest.map((row) => {
                  const name = displayBrandName(row.brand?.name || row.fromName);
                  const openForBrand = campaigns.filter(
                    (c) =>
                      c.brand?.slug === row.brand?.slug ||
                      c.brand?.name === row.brand?.name
                  );
                  return (
                    <li key={row.id}>
                      <span className="gigs-interest__row">
                        <BrandLogo
                          name={name || 'Brand'}
                          slug={row.brand?.slug}
                          logoUrl={row.brand?.logoUrl}
                          size="sm"
                        />
                        <span>
                          <strong>{name || 'Brand'}</strong>
                          <span className="muted" style={{ marginLeft: '0.45rem', fontSize: '0.85rem' }}>
                            {openForBrand.length
                              ? `${openForBrand.length} open deal${openForBrand.length === 1 ? '' : 's'}`
                              : 'No open campaigns yet'}
                          </span>
                        </span>
                      </span>
                      {row.brand?.slug ? (
                        <Link
                          href={`/gigs#brand-${row.brand.slug}`}
                          className="soft-link"
                          onClick={() => {
                            const hit = openForBrand[0];
                            if (hit) {
                              document
                                .getElementById(`gig-${hit.id}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                        >
                          View deals
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          <Panel
            compact
            className="gigs-desk__campaigns"
            title="Open campaigns"
            description="Pay per result. Apply, practice the pack, deliver."
          >
            {campaigns.length === 0 ? (
              <EmptyState
                title="No open brand deals yet"
                description="Come back when founders go live, or warm up in Practice while you wait."
                action={
                  <Link href="/practice" className="btn" style={{ marginTop: '0.75rem' }}>
                    Open Practice
                  </Link>
                }
              />
            ) : (
              <div className="gigs-desk__scroll">
                <div className="page-grid page-grid--gigs">
                  {campaigns.map((c) => {
                    const brandName = displayBrandName(c.brand?.name);
                    const applied = Boolean(c.myApplication);
                    const active =
                      c.myApplication?.status === 'ACTIVE' ||
                      c.myApplication?.status === 'ACCEPTED';
                    const metaBits: string[] = [];
                    if (c.requireCertification) metaBits.push('Cert required');
                    if (c.minScore != null) metaBits.push(`Min score ${c.minScore}`);

                    return (
                      <article key={c.id} id={`gig-${c.id}`} className="gig-card gig-card--compact">
                        <div className="gig-card__top">
                          <BrandLogo
                            name={brandName}
                            slug={c.brand?.slug}
                            logoUrl={c.brand?.logoUrl}
                            size="sm"
                          />
                          <div className="gig-card__hero">
                            <p className="gig-card__payout">{c.payoutLabel}</p>
                            <p className="gig-card__brand">{brandName}</p>
                            {c.goalLabel && (
                              <span className="gig-card__outcome">{c.goalLabel}</span>
                            )}
                          </div>
                        </div>

                        {c.description ? (
                          <p className="gig-card__desc">
                            {c.description.slice(0, 90)}
                            {c.description.length > 90 ? '…' : ''}
                          </p>
                        ) : null}

                        {metaBits.length > 0 && (
                          <p className="gig-card__reqs">{metaBits.join(' · ')}</p>
                        )}

                        <div className="gig-card__actions">
                          {!applied ? (
                            <button
                              type="button"
                              className="btn gig-card__apply"
                              disabled={busyId === c.id}
                              onClick={() => apply(c.id)}
                            >
                              {busyId === c.id ? 'Applying…' : 'Apply'}
                            </button>
                          ) : (
                            <span className="gig-card__status">
                              {statusLabel(c.myApplication?.status || '')}
                            </span>
                          )}
                          <div className="gig-card__links">
                            {c.practiceHref && (applied || active) && (
                              <Link href={c.practiceHref} className="soft-link">
                                Practice →
                              </Link>
                            )}
                            {c.practiceHref && !applied && (
                              <Link href={c.practiceHref} className="soft-link">
                                Preview
                              </Link>
                            )}
                            <Link href={`/campaigns/${c.id}`} className="soft-link">
                              Details
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            compact
            className="gigs-desk__apps"
            title="My applications"
            description={
              <>
                Status & payouts ·{' '}
                <Link href="/earnings" className="soft-link">
                  Earnings
                </Link>
              </>
            }
          >
            {mine.length === 0 ? (
              <EmptyState
                title="Nothing in flight"
                description="Apply to an open campaign — practice unlocks when you’re activated."
              />
            ) : (
              <div className="gigs-desk__scroll">
                <div className="stack gigs-apps">
                  {mine.map((a) => {
                    const brandName = displayBrandName(a.campaign.brand?.name);
                    return (
                      <div key={a.id} className="session-row gig-app-row">
                        <div className="gig-app-row__main">
                          <BrandLogo
                            name={brandName}
                            slug={a.campaign.brand?.slug}
                            logoUrl={a.campaign.brand?.logoUrl}
                            size="sm"
                          />
                          <div className="gig-app-row__copy">
                            <strong>
                              {a.campaign.payoutLabel}
                              <span className="muted" style={{ fontWeight: 500 }}>
                                {' '}
                                · {brandName}
                              </span>
                            </strong>
                            <div className="session-row__meta">
                              {a.campaign.goalLabel} · {statusLabel(a.status)}
                              {a.payout?.status === 'PAID'
                                ? ' · Paid'
                                : a.payout?.status === 'PENDING'
                                  ? ' · Payout pending'
                                  : ''}
                            </div>
                          </div>
                        </div>
                        <div className="gig-app-row__actions">
                          {(a.status === 'ACTIVE' || a.status === 'ACCEPTED') &&
                            a.campaign.practiceHref && (
                              <Link href={a.campaign.practiceHref} className="btn btn--sm">
                                Practice
                              </Link>
                            )}
                          {(a.status === 'ACTIVE' || a.status === 'ACCEPTED') && (
                            <Link href={`/campaigns/${a.campaign.id}`} className="btn btn--sm">
                              Book
                            </Link>
                          )}
                          <Link href={`/campaigns/${a.campaign.id}`} className="btn-ghost btn-ghost--sm">
                            View
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
