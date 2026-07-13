'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountDeskFilters, {
  useAccountBrandFilter,
} from '@/components/AccountDeskFilters';
import BrandSdrApplicationsClient from '@/components/BrandSdrApplicationsClient';
import { brandPathKey } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { useShell } from '@/components/ShellProvider';
import { EmptyState, PageHeader, Panel } from '@/components/ui/PagePrimitives';
import { CANONICAL_DEMO_BRANDS } from '@/lib/demo/canonical-brands';
import { DEMO_MSG } from '@/lib/demo/brand-demo-data';

type Tab = 'inbox' | 'discover';

type BoardRep = {
  id: string;
  displayName: string;
  hiringHeadline: string | null;
  hiringBio: string | null;
  totalPoints: number;
  currentStreak: number;
  profileSlug: string | null;
  verified: boolean;
  avgCleanScore: number;
  cleanSessions: number;
  signalScore: number;
  openToWork: boolean;
  badges?: string[];
  topFocus?: string | null;
  skills?: string[];
};

type InterestRep = {
  id: string;
  status: string;
  brandId: string | null;
  rep: {
    id: string;
    displayName: string;
    headline: string | null;
    slug: string | null;
    verified: boolean;
    openToWork: boolean;
  };
};

const DEMO_OPEN_SDRS: BoardRep[] = [
  {
    id: 'demo-sdr-jordan',
    displayName: 'Jordan Hale',
    hiringHeadline: 'B2B appointment setter · SaaS & benefits',
    hiringBio:
      'Former agency SDR who rebuilt dial blocks around gatekeeper respect and calendar-first closes. Comfortable on multi-thread accounts and mid-market renewals. Looking for brands with clear ICPs and escrow that pays on show.',
    totalPoints: 4280,
    currentStreak: 12,
    profileSlug: null,
    verified: true,
    avgCleanScore: 86,
    cleanSessions: 34,
    signalScore: 910,
    openToWork: true,
    topFocus: 'Gatekeeper',
    skills: ['Gatekeeper', 'Multi-thread', 'Calendar close', 'Objections'],
    badges: ['Clean streak', 'Verified practice'],
  },
  {
    id: 'demo-sdr-mira',
    displayName: 'Mira Chen',
    hiringHeadline: 'Outbound specialist · local services & franchises',
    hiringBio:
      'High-volume Maps outbound with crisp openers and owner-direct targeting. Strong on “who owns this?” discovery and booking same-week demos. Prefers morning blocks and live coaching feedback.',
    totalPoints: 3610,
    currentStreak: 7,
    profileSlug: null,
    verified: true,
    avgCleanScore: 81,
    cleanSessions: 28,
    signalScore: 840,
    openToWork: true,
    topFocus: 'Discovery',
    skills: ['Local outbound', 'Owner-direct', 'Discovery', 'Follow-up'],
    badges: ['Volume dialer'],
  },
  {
    id: 'demo-sdr-devon',
    displayName: 'Devon Brooks',
    hiringHeadline: 'Enterprise cold caller · security & compliance',
    hiringBio:
      'Patient multi-touch sequences into security buyers. Good at navigating assistants without sounding scripted, then landing a 15-minute intro with the economic buyer. Wants playbooks with objection trees, not walls of copy.',
    totalPoints: 5120,
    currentStreak: 19,
    profileSlug: null,
    verified: true,
    avgCleanScore: 91,
    cleanSessions: 41,
    signalScore: 980,
    openToWork: true,
    topFocus: 'Pricing',
    skills: ['Enterprise', 'Security buyers', 'Assistants', 'Multi-touch'],
    badges: ['Top signal', 'Verified practice'],
  },
  {
    id: 'demo-sdr-avery',
    displayName: 'Avery Santos',
    hiringHeadline: 'Insurance & benefits appointment setter',
    hiringBio:
      'Specialty in group benefits renewals and Medicare Advantage education calls. Calm under pushback, strong note discipline, and clean handoffs to closers. Open to part-time campaign blocks.',
    totalPoints: 2940,
    currentStreak: 4,
    profileSlug: null,
    verified: false,
    avgCleanScore: 78,
    cleanSessions: 19,
    signalScore: 720,
    openToWork: true,
    topFocus: 'Objections',
    skills: ['Benefits', 'Renewals', 'MA education', 'Handoffs'],
    badges: ['Open to part-time'],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function focusLabel(focus: string | null | undefined) {
  if (!focus) return null;
  return focus.replace(/_/g, ' ');
}

export default function RecruitClient() {
  const shell = useShell();
  const router = useRouter();
  const { mode } = useBrandDeskMode();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(tabParam === 'discover' ? 'discover' : 'inbox');
  const { brandKey, brands } = useAccountBrandFilter({ requireBrand: false });
  const campaignParam = searchParams.get('campaign');

  useEffect(() => {
    setTab(tabParam === 'discover' ? 'discover' : 'inbox');
  }, [tabParam]);

  const brandName = useMemo(() => {
    if (!brandKey) return 'All brands';
    const hit =
      brands.find((b) => brandPathKey(b) === brandKey || b.id === brandKey) ||
      CANONICAL_DEMO_BRANDS.find((b) => b.slug === brandKey);
    return hit?.name || brandKey;
  }, [brandKey, brands]);

  const brandIdForSwipe = useMemo(() => {
    if (!brandKey) return shell?.selectedBrand?.id || brands[0]?.id || null;
    const hit = brands.find((b) => brandPathKey(b) === brandKey || b.id === brandKey);
    return hit?.id || brandKey;
  }, [brandKey, brands, shell?.selectedBrand?.id]);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'discover') params.set('tab', 'discover');
    else params.delete('tab');
    const qs = params.toString();
    router.replace(qs ? `/recruit?${qs}` : '/recruit', { scroll: false });
  }

  return (
    <main className="app-page recruit-page">
      <PageHeader
        compact
        title="Recruit"
        description="Review campaign applications, or discover SDRs open to work — shortlist with a thumbs up (desktop) or swipe right (phone)."
      />

      <AccountDeskFilters showCampaign allowAllBrands />

      <div className="recruit-tabs" role="tablist" aria-label="Recruit mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          className={`recruit-tabs__btn${tab === 'inbox' ? ' is-active' : ''}`}
          onClick={() => selectTab('inbox')}
        >
          Applications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'discover'}
          className={`recruit-tabs__btn${tab === 'discover' ? ' is-active' : ''}`}
          onClick={() => selectTab('discover')}
        >
          Discover
        </button>
      </div>

      {tab === 'inbox' ? (
        brandKey || mode === 'demo' ? (
          <Panel
            title="Applications"
            description={
              campaignParam
                ? `Filtered to one campaign · ${brandName}`
                : `Campaign applicants · ${brandName}`
            }
          >
            <BrandSdrApplicationsClient
              brandKey={brandKey || (mode === 'demo' ? 'demo-meridianops' : '')}
              brandName={brandName}
              initial={[]}
              campaignId={campaignParam || undefined}
            />
          </Panel>
        ) : brands.length === 0 ? (
          <EmptyState
            title="No brands yet"
            description="Create a brand, post an OPEN campaign, then review applicants here."
            action={
              <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                My brands
              </Link>
            }
          />
        ) : (
          <MultiBrandApplications brands={brands} campaignId={campaignParam} />
        )
      ) : (
        <RecruitDiscoverFullscreen
          brandId={brandIdForSwipe}
          brandLabel={brandName}
          brands={brands}
          isDemo={mode === 'demo'}
          onClose={() => selectTab('inbox')}
        />
      )}
    </main>
  );
}

function MultiBrandApplications({
  brands,
  campaignId,
}: {
  brands: { id: string; slug: string; name: string }[];
  campaignId?: string | null;
}) {
  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Showing applications across all brands. Pick a brand above to focus.
      </p>
      {brands.map((b) => (
        <Panel
          key={b.id}
          compact
          title={b.name}
          description="Campaign applicants"
        >
          <BrandSdrApplicationsClient
            brandKey={brandPathKey(b)}
            brandName={b.name}
            initial={[]}
            campaignId={campaignId || undefined}
          />
        </Panel>
      ))}
    </div>
  );
}

function RecruitDiscoverFullscreen({
  brandId,
  brandLabel,
  brands,
  isDemo,
  onClose,
}: {
  brandId: string | null;
  brandLabel: string;
  brands: { id: string; slug: string; name: string }[];
  isDemo: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<BoardRep[]>([]);
  const [shortlist, setShortlist] = useState<InterestRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [fundBrandId, setFundBrandId] = useState(brandId || brands[0]?.id || '');
  const startX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setFundBrandId((prev) => prev || brandId || brands[0]?.id || '');
  }, [brandId, brands]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      if (isDemo) {
        setShortlist([]);
        setQueue(DEMO_OPEN_SDRS);
        return;
      }
      const [boardRes, interestRes] = await Promise.all([
        fetch('/api/hiring/board?limit=40'),
        fetch('/api/talent/interest?status=interested'),
      ]);
      const boardData = await boardRes.json().catch(() => ({}));
      const interestData = await interestRes.json().catch(() => ({}));
      const interests: InterestRep[] = interestData.interests || [];
      setShortlist(interests);
      const seen = new Set(interests.map((i) => i.rep.id));
      const passedRes = await fetch('/api/talent/interest?status=passed');
      const passedData = await passedRes.json().catch(() => ({}));
      for (const p of passedData.interests || []) seen.add(p.rep?.id);
      const profiles: BoardRep[] = (boardData.profiles || [])
        .filter((p: BoardRep) => p.id && !seen.has(p.id))
        .map((p: BoardRep) => p);
      setQueue(profiles);
    } catch {
      setMsg('Could not load open-to-work SDRs');
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[0] || null;
  const remaining = queue.length;
  const activeBrandName =
    brands.find((b) => b.id === fundBrandId)?.name ||
    CANONICAL_DEMO_BRANDS.find((b) => b.id === fundBrandId || b.slug === fundBrandId)?.name ||
    brandLabel;

  const swipeHint = dragX > 40 ? 'like' : dragX < -40 ? 'pass' : null;

  const decide = useCallback(
    async (status: 'interested' | 'passed') => {
      if (!current || busy) return;
      setBusy(true);
      setMsg(null);
      try {
        if (isDemo) {
          setQueue((q) => q.slice(1));
          if (status === 'interested') {
            setShortlist((s) => [
              {
                id: `demo-interest-${current.id}`,
                status: 'interested',
                brandId: fundBrandId || null,
                rep: {
                  id: current.id,
                  displayName: current.displayName,
                  headline: current.hiringHeadline,
                  slug: current.profileSlug,
                  verified: current.verified,
                  openToWork: true,
                },
              },
              ...s,
            ]);
            setMsg(`${current.displayName} shortlisted · ${DEMO_MSG}`);
          }
          return;
        }
        const res = await fetch('/api/talent/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toUserId: current.id,
            status,
            brandId: fundBrandId || brandId || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Swipe failed');
        setQueue((q) => q.slice(1));
        if (status === 'interested') {
          setShortlist((s) => [
            {
              id: data.interest?.id || current.id,
              status: 'interested',
              brandId: fundBrandId || brandId,
              rep: {
                id: current.id,
                displayName: current.displayName,
                headline: current.hiringHeadline,
                slug: current.profileSlug,
                verified: current.verified,
                openToWork: true,
              },
            },
            ...s,
          ]);
          setMsg(
            `${current.displayName} shortlisted — they’ll see ${activeBrandName} on Brand deals.`
          );
        }
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'Swipe failed');
      } finally {
        setBusy(false);
        setDragX(0);
      }
    },
    [activeBrandName, brandId, busy, current, fundBrandId, isDemo]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (busy || !current) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        void decide('interested');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void decide('passed');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, current, decide, onClose]);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    setDragX(Math.max(-160, Math.min(160, e.clientX - startX.current)));
  }
  function onPointerUp() {
    if (startX.current == null) return;
    const dx = dragX;
    startX.current = null;
    if (dx > 90) void decide('interested');
    else if (dx < -90) void decide('passed');
    else setDragX(0);
  }

  if (!mounted) return null;

  const ui = (
    <div className="recruit-fs" role="dialog" aria-modal="true" aria-label="Discover open-to-work SDRs">
      <header className="recruit-fs__bar">
        <button type="button" className="recruit-fs__close" onClick={onClose}>
          ← Applications
        </button>
        <div className="recruit-fs__bar-mid">
          <strong>Discover</strong>
          <span className="muted">
            {loading ? 'Loading…' : remaining > 0 ? `${remaining} left` : 'Deck clear'}
          </span>
        </div>
        <label className="recruit-fs__brand">
          <span>Shortlist as</span>
          <select
            className="field"
            value={fundBrandId}
            onChange={(e) => setFundBrandId(e.target.value)}
            aria-label="Brand that shortlists this SDR"
          >
            {(brands.length > 0 ? brands : CANONICAL_DEMO_BRANDS).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="recruit-fs__stage">
        {loading ? (
          <p className="recruit-fs__status muted">Loading resumes…</p>
        ) : !current ? (
          <div className="recruit-fs__empty">
            <h2>Deck clear</h2>
            <p>
              No more open-to-work SDRs right now. Check Applications, or come back as new reps
              opt in on their resume.
            </p>
            <div className="recruit-fs__empty-actions">
              <button type="button" className="btn" onClick={onClose}>
                Back to Applications
              </button>
              {shortlist.length > 0 ? (
                <p className="muted">
                  Shortlisted {shortlist.length} this session
                  {shortlist[0] ? ` · latest ${shortlist[0].rep.displayName}` : ''}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <article
            className={`recruit-fs__resume${swipeHint === 'like' ? ' is-like' : ''}${
              swipeHint === 'pass' ? ' is-pass' : ''
            }`}
            style={{
              transform: `translateX(${dragX * 0.45}px) rotate(${dragX * 0.028}deg)`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              startX.current = null;
              setDragX(0);
            }}
          >
            <div className="recruit-fs__swipe-hint" aria-hidden>
              <span className="recruit-fs__swipe-hint__pass">Pass</span>
              <span className="recruit-fs__swipe-hint__like">Shortlist</span>
            </div>

            <div className="recruit-fs__identity">
              <div className="recruit-fs__avatar" aria-hidden>
                {initials(current.displayName)}
              </div>
              <div className="recruit-fs__identity-copy">
                <div className="recruit-fs__pills">
                  {current.openToWork ? (
                    <span className="recruit-fs__pill recruit-fs__pill--open">Open to work</span>
                  ) : null}
                  {current.verified ? (
                    <span className="recruit-fs__pill recruit-fs__pill--verified">Verified</span>
                  ) : null}
                  {focusLabel(current.topFocus) ? (
                    <span className="recruit-fs__pill">Focus · {focusLabel(current.topFocus)}</span>
                  ) : null}
                </div>
                <h1>{current.displayName}</h1>
                {current.hiringHeadline ? <p className="recruit-fs__headline">{current.hiringHeadline}</p> : null}
                {current.profileSlug ? (
                  <Link
                    href={`/${current.profileSlug}`}
                    className="soft-link"
                    onClick={(e) => e.stopPropagation()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    coldcallreps.com/{current.profileSlug} ↗
                  </Link>
                ) : (
                  <p className="muted recruit-fs__handle">Demo resume · no public slug yet</p>
                )}
              </div>
            </div>

            {current.hiringBio ? <p className="recruit-fs__bio">{current.hiringBio}</p> : null}

            <div className="recruit-fs__stats" aria-label="Practice signal">
              <div>
                <span className="recruit-fs__stat-label">Signal</span>
                <strong>{current.signalScore || '—'}</strong>
              </div>
              <div>
                <span className="recruit-fs__stat-label">Avg clean</span>
                <strong>{current.avgCleanScore || '—'}</strong>
              </div>
              <div>
                <span className="recruit-fs__stat-label">Clean sessions</span>
                <strong>{current.cleanSessions}</strong>
              </div>
              <div>
                <span className="recruit-fs__stat-label">Streak</span>
                <strong>{current.currentStreak}d</strong>
              </div>
              <div>
                <span className="recruit-fs__stat-label">Career XP</span>
                <strong>{current.totalPoints.toLocaleString()}</strong>
              </div>
            </div>

            {current.skills && current.skills.length > 0 ? (
              <div className="recruit-fs__skills">
                {current.skills.map((s) => (
                  <span key={s} className="recruit-fs__skill">
                    {s}
                  </span>
                ))}
              </div>
            ) : null}

            {current.badges && current.badges.length > 0 ? (
              <div className="recruit-fs__badges">
                {current.badges.map((b) => (
                  <span key={b} className="muted">
                    {b}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        )}
      </div>

      <footer className="recruit-fs__dock">
        {msg ? <p className="recruit-fs__msg">{msg}</p> : null}
        {current ? (
          <>
            <div className="recruit-fs__actions">
              <button
                type="button"
                className="recruit-fs__btn recruit-fs__btn--pass"
                disabled={busy}
                onClick={() => void decide('passed')}
              >
                Pass
              </button>
              <button
                type="button"
                className="recruit-fs__btn recruit-fs__btn--like"
                disabled={busy}
                onClick={() => void decide('interested')}
              >
                Shortlist
              </button>
            </div>
            <p className="recruit-fs__hint muted">
              Swipe or ← / → · shortlisting as <strong>{activeBrandName}</strong>
              {shortlist.length > 0 ? ` · ${shortlist.length} shortlisted` : ''}
            </p>
          </>
        ) : null}
      </footer>
    </div>
  );

  return createPortal(ui, document.body);
}
