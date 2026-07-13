'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';
import './PublicRepProfile.css';

type ScorePoint = { id: string; score: number; focus: string; at: string };
type FocusStat = { focus: string; count: number };
type FeaturedCall = {
  id: string;
  title: string | null;
  mediaSrc: string | null;
  durationSec: number | null;
  overallScore: number | null;
  focusArea: string | null;
  strengths: string[];
};

type ProfileData = {
  slug: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  experience: string | null;
  openToWork: boolean;
  verified: boolean;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  skills: string[];
  featuredCalls: FeaturedCall[];
  achievements: { label: string; detail: string }[];
  certifications: { label: string; score: number; brand: string }[];
  viewer: {
    canSwipe: boolean;
    myInterest: 'interested' | 'passed' | null;
    interestCount: number;
    isSelf: boolean;
  };
  stats: {
    cleanSessions: number;
    avgCleanScore: number;
    bestScore: number;
    topFocus: FocusStat[];
    scoreSeries: ScorePoint[];
  };
};

function initials(name: string | null | undefined, slug: string) {
  const parts = (name || slug || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function focusLabel(focus: string) {
  return (FOCUS_LABELS as Record<string, string>)[focus as FocusArea] || focus;
}

function clampStat(n: number, max = 100) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function ScoreTrendChart({ series }: { series: ScorePoint[] }) {
  if (series.length < 2) {
    return <p className="pub-empty muted">More scored practice unlocks the trend chart.</p>;
  }

  const w = 560;
  const h = 160;
  const padX = 12;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const min = Math.min(...series.map((p) => p.score), 0);
  const max = Math.max(...series.map((p) => p.score), 100);
  const span = Math.max(1, max - min);

  const points = series.map((p, i) => {
    const x = padX + (i / (series.length - 1)) * innerW;
    const y = padY + innerH - ((p.score - min) / span) * innerH;
    return { ...p, x, y };
  });

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;
  const last = points[points.length - 1];

  return (
    <svg className="pub-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Practice score trend">
      <defs>
        <linearGradient id="pubScoreFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pubScoreFill)" />
      <path d={line} className="pub-chart__line" fill="none" />
      {points.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r={3.2} className="pub-chart__dot" />
      ))}
      <circle cx={last.x} cy={last.y} r={5} className="pub-chart__dot pub-chart__dot--last" />
      <text x={last.x - 4} y={last.y - 10} className="pub-chart__label">
        {last.score}
      </text>
    </svg>
  );
}

function FocusBars({ items }: { items: FocusStat[] }) {
  if (!items.length) {
    return <p className="pub-empty muted">No clean scenario volume yet.</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="pub-focus-bars">
      {items.map((item) => (
        <li key={item.focus}>
          <div className="pub-focus-bars__meta">
            <span>{focusLabel(item.focus)}</span>
            <span className="muted">{item.count}</span>
          </div>
          <div className="pub-focus-bars__track">
            <div
              className="pub-focus-bars__fill"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RpgStatBar({
  label,
  code,
  bar,
  text,
}: {
  label: string;
  code: string;
  bar: number;
  text: string;
}) {
  const pct = Math.max(4, Math.min(100, bar));
  return (
    <div className="pub-rpg-stat">
      <div className="pub-rpg-stat__head">
        <span className="pub-rpg-stat__code">{code}</span>
        <span className="pub-rpg-stat__label">{label}</span>
        <strong className="pub-rpg-stat__val">{text}</strong>
      </div>
      <div className="pub-rpg-stat__track" aria-hidden>
        <div className="pub-rpg-stat__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PublicRepProfileClient({ slug }: { slug: string }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [imgBroken, setImgBroken] = useState(false);
  const [swipeBusy, setSwipeBusy] = useState(false);
  const [swipeMsg, setSwipeMsg] = useState('');
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    setImgBroken(false);
    fetch(`/api/profile/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Not found');
        setData(d);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Not found'));
  }, [slug]);

  const name = data?.displayName || data?.slug || 'Rep';
  const mark = useMemo(() => initials(data?.displayName, slug), [data?.displayName, slug]);

  const rpgStats = useMemo(() => {
    if (!data) return [];
    return [
      {
        code: 'PWR',
        label: 'Closing power',
        bar: clampStat(data.stats.avgCleanScore || data.stats.bestScore * 0.7),
        text: String(data.stats.avgCleanScore || 0),
      },
      {
        code: 'BST',
        label: 'Peak score',
        bar: clampStat(data.stats.bestScore),
        text: String(data.stats.bestScore || 0),
      },
      {
        code: 'GRIT',
        label: 'Streak',
        bar: clampStat(data.currentStreak * 12, 100),
        text: `${data.currentStreak}d`,
      },
      {
        code: 'REP',
        label: 'Clean reps',
        bar: clampStat(data.stats.cleanSessions * 8, 100),
        text: String(data.stats.cleanSessions),
      },
      {
        code: 'XP',
        label: 'Career XP',
        bar: clampStat(Math.log10(Math.max(1, data.totalPoints)) * 28, 100),
        text: String(data.totalPoints),
      },
    ];
  }, [data]);

  async function swipe(status: 'interested' | 'passed') {
    if (!data?.viewer.canSwipe || data.viewer.isSelf || swipeBusy) return;
    setSwipeBusy(true);
    setSwipeMsg('');
    try {
      const res = await fetch('/api/talent/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: data.slug, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save interest');
      setData((prev) =>
        prev
          ? {
              ...prev,
              viewer: {
                ...prev.viewer,
                myInterest: status,
                interestCount:
                  status === 'interested'
                    ? prev.viewer.myInterest === 'interested'
                      ? prev.viewer.interestCount
                      : prev.viewer.interestCount + 1
                    : prev.viewer.myInterest === 'interested'
                      ? Math.max(0, prev.viewer.interestCount - 1)
                      : prev.viewer.interestCount,
              },
            }
          : prev
      );
      setSwipeMsg(
        status === 'interested'
          ? 'Interested — saved to your talent shortlist.'
          : 'Passed — you can change this later.'
      );
    } catch (e: unknown) {
      setSwipeMsg(e instanceof Error ? e.message : 'Could not save interest');
    } finally {
      setSwipeBusy(false);
      setDragX(0);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!data?.viewer.canSwipe || data.viewer.isSelf) return;
    pointerStart.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointerStart.current == null || !dragging) return;
    setDragX(Math.max(-140, Math.min(140, e.clientX - pointerStart.current)));
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    pointerStart.current = null;
    if (dragX > 90) void swipe('interested');
    else if (dragX < -90) void swipe('passed');
    else setDragX(0);
  }

  if (error) {
    return (
      <main className="pub-page">
        <p className="muted">{error}</p>
        <Link href="/dashboard" className="btn-ghost">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="pub-page">
        <p className="muted">Loading profile…</p>
      </main>
    );
  }

  const showPhoto = Boolean(data.avatarUrl) && !imgBroken;
  const swipeHint =
    dragX > 40 ? 'interested' : dragX < -40 ? 'passed' : data.viewer.myInterest;

  return (
    <main className="pub-page">
      <section
        className={`pub-hero pub-hero--rpg${dragging ? ' is-dragging' : ''}${
          swipeHint === 'interested' ? ' is-like' : swipeHint === 'passed' ? ' is-pass' : ''
        }`}
        style={{ transform: dragX ? `translateX(${dragX * 0.35}px) rotate(${dragX * 0.03}deg)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pub-hero__glow" aria-hidden />
        {data.viewer.canSwipe && !data.viewer.isSelf ? (
          <div className="pub-swipe-hint" aria-hidden>
            <span className="pub-swipe-hint__pass">Pass</span>
            <span className="pub-swipe-hint__like">Interested</span>
          </div>
        ) : null}

        <div className="pub-select">
          <div className="pub-select__frame">
            <div className="pub-select__corners" aria-hidden />
            <div className="pub-avatar pub-avatar--rpg" aria-hidden={!showPhoto}>
              {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatarUrl!} alt="" onError={() => setImgBroken(true)} />
              ) : (
                <span>{mark}</span>
              )}
            </div>
            <p className="pub-select__class">
              {data.openToWork ? 'AVAILABLE UNIT' : 'OFF MARKET'}
              {data.verified ? ' · VERIFIED' : ''}
            </p>
          </div>

          <div className="pub-select__sheet">
            <div className="pub-hero__badges">
              {data.verified ? <span className="pub-pill pub-pill--verified">Verified</span> : null}
              {data.openToWork ? (
                <span className="pub-pill pub-pill--open">Open to work</span>
              ) : (
                <span className="pub-pill">Not open to work</span>
              )}
              {data.viewer.interestCount > 0 ? (
                <span className="pub-pill pub-pill--heat">
                  {data.viewer.interestCount} brand
                  {data.viewer.interestCount === 1 ? '' : 's'} interested
                </span>
              ) : null}
            </div>
            <h1 className="pub-hero__name">{name}</h1>
            {data.headline ? <p className="pub-hero__headline">{data.headline}</p> : null}
            <p className="pub-hero__handle">coldcallreps.com/{data.slug}</p>
            {data.bio ? <p className="pub-hero__bio">{data.bio}</p> : null}

            <div className="pub-rpg-stats" aria-label="Character attributes">
              {rpgStats.map((s) => (
                <RpgStatBar
                  key={s.code}
                  code={s.code}
                  label={s.label}
                  bar={s.bar}
                  text={s.text}
                />
              ))}
            </div>
            <div className="pub-rpg-readout" aria-hidden>
              {rpgStats.map((s) => (
                <span key={`r-${s.code}`}>
                  <em>{s.code}</em> {s.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {data.viewer.canSwipe && !data.viewer.isSelf ? (
          <div className="pub-swipe-actions">
            <button
              type="button"
              className="pub-swipe-btn pub-swipe-btn--pass"
              disabled={swipeBusy}
              onClick={() => void swipe('passed')}
            >
              Pass
            </button>
            <button
              type="button"
              className="pub-swipe-btn pub-swipe-btn--like"
              disabled={swipeBusy}
              onClick={() => void swipe('interested')}
            >
              {data.viewer.myInterest === 'interested' ? 'Interested ✓' : 'Interested'}
            </button>
          </div>
        ) : null}
        {swipeMsg ? <p className="pub-swipe-msg">{swipeMsg}</p> : null}
        {data.viewer.canSwipe && !data.viewer.isSelf ? (
          <p className="pub-swipe-help muted">
            Swipe the card right to shortlist · left to pass · or use the buttons
          </p>
        ) : null}
      </section>

      <div className="pub-grid">
        <section className="pub-panel pub-panel--chart">
          <header className="pub-panel__head">
            <h2>Score trend</h2>
            <p className="muted">
              Last {Math.max(data.stats.scoreSeries.length, 0)} clean practice calls
            </p>
          </header>
          <ScoreTrendChart series={data.stats.scoreSeries || []} />
        </section>

        <section className="pub-panel">
          <header className="pub-panel__head">
            <h2>Scenario mastery</h2>
            <p className="muted">Clean sessions by focus</p>
          </header>
          <FocusBars items={data.stats.topFocus || []} />
        </section>
      </div>

      {(data.skills?.length > 0 || data.experience) && (
        <div className="pub-grid pub-grid--resume">
          {data.experience ? (
            <section className="pub-panel">
              <header className="pub-panel__head">
                <h2>Experience</h2>
              </header>
              <p className="pub-prose">{data.experience}</p>
            </section>
          ) : null}
          {data.skills?.length > 0 ? (
            <section className="pub-panel">
              <header className="pub-panel__head">
                <h2>Skills</h2>
              </header>
              <div className="pub-chips">
                {data.skills.map((s) => (
                  <span key={s} className="pub-chip">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {data.featuredCalls?.length > 0 ? (
        <section className="pub-panel">
          <header className="pub-panel__head">
            <h2>Sample calls</h2>
            <p className="muted">AI-scored strengths + playback</p>
          </header>
          <ul className="pub-calls">
            {data.featuredCalls.map((call) => (
              <li key={call.id} className="pub-call">
                <div className="pub-call__top">
                  <strong>{call.title || 'Practice call'}</strong>
                  <span className="muted">
                    {call.overallScore != null ? `${call.overallScore}/100` : null}
                    {call.focusArea ? ` · ${focusLabel(call.focusArea)}` : ''}
                    {call.durationSec != null ? ` · ${call.durationSec}s` : ''}
                  </span>
                </div>
                {call.strengths?.length ? (
                  <ul className="pub-call__strengths">
                    {call.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                {call.mediaSrc ? (
                  <audio controls preload="metadata" src={call.mediaSrc}>
                    Your browser does not support audio.
                  </audio>
                ) : (
                  <p className="muted small">Audio processing — check back soon.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(data.achievements?.length > 0 || data.certifications?.length > 0) && (
        <section className="pub-panel">
          <header className="pub-panel__head">
            <h2>Proof</h2>
            <p className="muted">Badges, certs, and milestones</p>
          </header>
          <div className="pub-proof">
            {data.achievements.map((a) => (
              <div key={`${a.label}-${a.detail}`} className="pub-proof__item">
                <strong>{a.label}</strong>
                <span className="muted">{a.detail}</span>
              </div>
            ))}
            {data.certifications.map((c) => (
              <div key={`${c.brand}-${c.label}`} className="pub-proof__item">
                <strong>{c.label}</strong>
                <span className="muted">
                  {c.brand} · {c.score}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="pub-foot muted">
        {data.openToWork
          ? 'Open to work — brands can shortlist this resume with a swipe.'
          : 'Not currently marked open to work.'}
      </p>
    </main>
  );
}
