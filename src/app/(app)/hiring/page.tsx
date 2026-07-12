'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Toggle from '@/components/ui/Toggle';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';
import { repPublicPath } from '@/lib/public-urls';

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface BoardProfile {
  displayName: string | null;
  hiringHeadline: string | null;
  hiringBio: string | null;
  totalPoints: number;
  currentStreak: number;
  badges: string[];
  profileSlug?: string | null;
  verified?: boolean;
  signalScore?: number;
}

type ResumeForm = {
  openToWork: boolean;
  slug: string;
  headline: string;
  summary: string;
  experience: string;
  skills: string;
  highlights: string;
  featuredClipIds: string[];
};

const MAX_FEATURED_CALLS = 3;

const EMPTY_RESUME: ResumeForm = {
  openToWork: false,
  slug: '',
  headline: '',
  summary: '',
  experience: '',
  skills: '',
  highlights: '',
  featuredClipIds: [],
};

export default function HiringPage() {
  const [role, setRole] = useState<string>('REP');
  const [displayName, setDisplayName] = useState('');
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);

  const { values, update, dirty, hydrate, markSaved, reset } =
    useUnsavedForm<ResumeForm>(EMPTY_RESUME);
  const { openToWork, slug, headline, summary, experience, skills, highlights, featuredClipIds } =
    values;

  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [clips, setClips] = useState<any[]>([]);

  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');
  const [handleError, setHandleError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [board, setBoard] = useState<BoardProfile[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isTalentViewer =
    role === 'RECRUITER' || role === 'BRAND' || role === 'SUPERADMIN';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meRes, profileRes, boardRes, clipsRes, inboxRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/profile'),
          fetch('/api/hiring/board?limit=50'),
          fetch('/api/clips'),
          fetch('/api/recruiter/messages?box=inbox'),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) {
            setRole(me.platformRole || 'REP');
            setDisplayName(me.displayName || '');
            setPoints(me.totalPoints || 0);
            setStreak(me.currentStreak || 0);
            if (Array.isArray(me.badges)) {
              setBadges(me.badges);
            } else {
              try {
                setBadges(JSON.parse(me.badges || '[]'));
              } catch {
                setBadges([]);
              }
            }
          }
        }

        if (profileRes.ok) {
          const d = await profileRes.json();
          if (!cancelled && d.profile) {
            let nextSkills = '';
            let nextHighlights = '';
            let nextFeatured: string[] = [];
            try {
              nextSkills = JSON.parse(d.profile.skillsJSON || '[]').join(', ');
            } catch {
              nextSkills = '';
            }
            try {
              nextHighlights = JSON.parse(d.profile.clipUrlsJSON || '[]').join('\n');
            } catch {
              nextHighlights = '';
            }
            try {
              nextFeatured = JSON.parse(d.profile.featuredClipIdsJSON || '[]');
              if (!Array.isArray(nextFeatured)) nextFeatured = [];
              nextFeatured = nextFeatured.map(String).filter(Boolean).slice(0, MAX_FEATURED_CALLS);
            } catch {
              nextFeatured = [];
            }
            const next: ResumeForm = {
              openToWork: Boolean(d.openToWork),
              slug: d.profile.slug || '',
              headline: d.hiringHeadline || '',
              summary: d.profile.bio || '',
              experience: d.hiringBio || '',
              skills: nextSkills,
              highlights: nextHighlights,
              featuredClipIds: nextFeatured,
            };
            hydrate(next);
            setSavedSlug(d.profile.slug || null);
            setDisplayName((prev) => d.displayName || prev);
            setHandleStatus('available');
          }
        }

        if (boardRes.ok) {
          const d = await boardRes.json();
          if (!cancelled) setBoard(d.profiles || []);
        } else if (!cancelled) {
          const d = await boardRes.json().catch(() => ({}));
          setLoadError(d.error || 'Could not load talent board.');
        }

        if (clipsRes.ok) {
          const d = await clipsRes.json();
          if (!cancelled) setClips(d.clips || []);
        }

        if (inboxRes.ok) {
          const d = await inboxRes.json();
          if (!cancelled) setInbox(d.messages || []);
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Could not load resume.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  function onSlugChange(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    update({ slug: next });
    setMsg('');
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!next.trim()) {
      setHandleStatus('idle');
      setHandleError('');
      setSuggestions([]);
      return;
    }
    if (savedSlug && next === savedSlug) {
      setHandleStatus('available');
      setHandleError('');
      setSuggestions([]);
      return;
    }

    setHandleStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/handle?q=${encodeURIComponent(next)}`);
        const data = await res.json();
        if (data.available) {
          setHandleStatus('available');
          setHandleError('');
          setSuggestions([]);
          if (data.handle && data.handle !== next) update({ slug: data.handle });
        } else {
          setHandleStatus(data.handle ? 'taken' : 'invalid');
          setHandleError(data.error || 'Unavailable');
          setSuggestions(data.suggestions || []);
          if (data.handle) update({ slug: data.handle });
        }
      } catch {
        setHandleStatus('idle');
      }
    }, 350);
  }

  function handleReset() {
    reset();
    setMsg('');
    setHandleError('');
    setSuggestions([]);
    setHandleStatus('available');
  }

  async function saveResume() {
    if (handleStatus === 'taken' || handleStatus === 'invalid') {
      setMsg(handleError || 'Choose an available handle first.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          bio: summary,
          headline,
          hiringBio: experience,
          openToWork,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          clipUrls: highlights
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          featuredClipIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        let savedFeatured = featuredClipIds;
        try {
          const parsed = JSON.parse(data.profile.featuredClipIdsJSON || '[]');
          if (Array.isArray(parsed)) {
            savedFeatured = parsed.map(String).filter(Boolean).slice(0, MAX_FEATURED_CALLS);
          }
        } catch {
          /* keep local */
        }
        const next: ResumeForm = {
          ...values,
          slug: data.profile.slug,
          openToWork: Boolean(data.openToWork),
          featuredClipIds: savedFeatured,
        };
        markSaved(next);
        setSavedSlug(data.profile.slug);
        setHandleStatus('available');
        setHandleError('');
        setSuggestions([]);
        setMsg(
          next.openToWork
            ? 'Resume saved — you’re visible on the talent board.'
            : 'Resume saved.'
        );
        fetch('/api/hiring/board?limit=50')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setBoard(d.profiles || []))
          .catch(() => {});
      } else {
        setMsg(data.error || 'Failed to save');
        if (data.suggestions?.length) setSuggestions(data.suggestions);
        if (res.status === 409) setHandleStatus('taken');
      }
    } finally {
      setSaving(false);
    }
  }

  const readyClips = clips.filter((c) => c.status === 'ready');

  function toggleFeaturedClip(clipId: string) {
    const selected = featuredClipIds.includes(clipId);
    if (selected) {
      update({ featuredClipIds: featuredClipIds.filter((id) => id !== clipId) });
      setMsg('');
      return;
    }
    if (featuredClipIds.length >= MAX_FEATURED_CALLS) {
      setMsg(`You can feature up to ${MAX_FEATURED_CALLS} recorded calls.`);
      return;
    }
    update({ featuredClipIds: [...featuredClipIds, clipId] });
    setMsg('');
  }

  function moveFeaturedClip(clipId: string, dir: -1 | 1) {
    const idx = featuredClipIds.indexOf(clipId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= featuredClipIds.length) return;
    const ordered = [...featuredClipIds];
    const [item] = ordered.splice(idx, 1);
    ordered.splice(next, 0, item);
    update({ featuredClipIds: ordered });
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  // Recruiters / brands: talent board browser
  if (isTalentViewer) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Career"
          title="Talent board"
          description="Reps who opted open-to-work, ranked by clean practice signal."
          actions={
            <Link href="/campaigns" className="btn">
              Post a campaign
            </Link>
          }
        />
        {loadError && <p className="msg-err">{loadError}</p>}
        {board.length === 0 ? (
          <Panel>
            <EmptyState
              title="No open profiles yet"
              description="When reps mark open to work, they’ll show up here."
            />
          </Panel>
        ) : (
          <div className="stack">
            {board.map((p, i) => (
              <div key={p.profileSlug || `${p.displayName}-${i}`} className="session-row" style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>
                      {p.profileSlug ? (
                        <Link href={`/${p.profileSlug}`} style={{ color: 'inherit' }}>
                          {p.displayName || 'Rep'}
                          {p.verified ? ' ✓' : ''}
                        </Link>
                      ) : (
                        <>
                          {p.displayName || 'Rep'}
                          {p.verified ? ' ✓' : ''}
                        </>
                      )}
                    </strong>
                    <span className="chip" style={{ marginLeft: '0.5rem' }}>
                      Open to work
                    </span>
                    {p.hiringHeadline && (
                      <div style={{ marginTop: '0.35rem', fontWeight: 600 }}>{p.hiringHeadline}</div>
                    )}
                    {p.hiringBio && (
                      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                        {p.hiringBio}
                      </p>
                    )}
                  </div>
                  <div className="session-row__meta" style={{ textAlign: 'right' }}>
                    {p.signalScore != null && <div>Signal {p.signalScore}</div>}
                    <div>
                      {p.totalPoints} pts · streak {p.currentStreak}
                    </div>
                    {p.profileSlug && (
                      <SoftLink href={`/${p.profileSlug}`}>/{p.profileSlug}</SoftLink>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  // Reps: resume / profile editor
  const statusColor =
    handleStatus === 'available'
      ? 'var(--accent-2)'
      : handleStatus === 'checking'
        ? 'var(--muted)'
        : handleStatus === 'idle'
          ? 'var(--muted)'
          : 'var(--bad)';

  const saveDisabled =
    handleStatus === 'taken' ||
    handleStatus === 'invalid' ||
    handleStatus === 'checking';

  return (
    <main className="app-page app-page--readable">
      <PageHeader
        eyebrow="Career"
        title="Your resume"
        description="Practice signal + public profile founders see when you go open to work."
        actions={
          savedSlug ? (
            <Link
              href={repPublicPath(savedSlug)}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              View public page
            </Link>
          ) : undefined
        }
      />

      {loadError && <p className="msg-err">{loadError}</p>}

      <StatGrid>
        <Stat label="Points" value={points} />
        <Stat label="Streak" value={`${streak}d`} tone={streak > 0 ? 'good' : undefined} />
        <Stat label="Badges" value={badges.length} />
        <Stat label="Board" value={openToWork ? 'Visible' : 'Hidden'} tone={openToWork ? 'accent' : undefined} />
      </StatGrid>

      {badges.length > 0 && (
        <div className="badge-row">
          {badges.map((b) => (
            <span key={b} className="chip">
              {b}
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveResume();
        }}
      >
        <Panel title="Visibility" description="Recruiters only see you when open to work is on.">
          <Toggle
            checked={openToWork}
            onChange={(next) => update({ openToWork: next })}
            label="Open to work"
            description="Appear on the talent board for brands and founders"
          />
        </Panel>

        <Panel title="Identity">
          <div className="form-field">
            <label className="form-field__label" htmlFor="resume-name">
              Display name
            </label>
            <input id="resume-name" className="field" value={displayName} disabled />
            <p className="form-field__hint">Managed from your account. Handle is your public URL.</p>
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label" htmlFor="resume-slug">
              Public handle
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="muted" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                coldcallreps.com/
              </span>
              <input
                id="resume-slug"
                className="field"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="your-handle"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <p className="form-field__hint" style={{ color: statusColor }}>
              {handleStatus === 'available'
                ? 'Available'
                : handleStatus === 'checking'
                  ? 'Checking…'
                  : handleStatus === 'taken'
                    ? `Taken${handleError ? ` — ${handleError}` : ''}`
                    : handleStatus === 'invalid'
                      ? handleError || 'Invalid'
                      : 'Pick a handle for your public resume'}
            </p>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {suggestions.map((s) => (
                  <button key={s} type="button" className="btn-ghost" onClick={() => onSlugChange(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Resume" description="What founders read when they open your profile.">
          <div className="form-field">
            <label className="form-field__label" htmlFor="resume-headline">
              Headline
            </label>
            <input
              id="resume-headline"
              className="field"
              value={headline}
              onChange={(e) => update({ headline: e.target.value })}
              placeholder="SDR · gatekeeper transfers · $500 local websites"
              maxLength={160}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="resume-summary">
              Summary
            </label>
            <textarea
              id="resume-summary"
              className="field"
              value={summary}
              onChange={(e) => update({ summary: e.target.value })}
              rows={3}
              placeholder="Who you are and what outbound motion you’re hunting for…"
              maxLength={2000}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="resume-exp">
              Experience
            </label>
            <textarea
              id="resume-exp"
              className="field"
              value={experience}
              onChange={(e) => update({ experience: e.target.value })}
              rows={4}
              placeholder="Roles, industries, dials per day, wins worth mentioning…"
              maxLength={2000}
            />
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label" htmlFor="resume-skills">
              Skills
            </label>
            <input
              id="resume-skills"
              className="field"
              value={skills}
              onChange={(e) => update({ skills: e.target.value })}
              placeholder="Gatekeeper, Pricing, Discovery, $500 pitch"
            />
            <p className="form-field__hint">Comma-separated.</p>
          </div>
        </Panel>

        <Panel
          title="Featured calls"
          description={`Pick up to ${MAX_FEATURED_CALLS} ready recorded calls for your public resume.`}
        >
          <p className="form-field__hint" style={{ marginTop: 0 }}>
            {featuredClipIds.length}/{MAX_FEATURED_CALLS} selected
            {featuredClipIds.length >= MAX_FEATURED_CALLS
              ? ' — deselect one to choose another.'
              : '.'}
          </p>

          {featuredClipIds.length > 0 && (
            <ol
              className="stack"
              style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', gap: '0.5rem' }}
            >
              {featuredClipIds.map((id, i) => {
                const clip = clips.find((c) => c.id === id);
                return (
                  <li
                    key={id}
                    className="session-row"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}
                  >
                    <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: '1.25rem' }}>
                      {i + 1}.
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {clip?.title || 'Recorded call'}{' '}
                      <SoftLink href={`/h/${id}`}>Open</SoftLink>
                    </span>
                    <span style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={i === 0}
                        onClick={() => moveFeaturedClip(id, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={i === featuredClipIds.length - 1}
                        onClick={() => moveFeaturedClip(id, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => toggleFeaturedClip(id)}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {readyClips.length === 0 ? (
            <EmptyState
              title="No ready calls yet"
              description="Publish a recorded call from a scored session, then feature it here."
            />
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {readyClips.map((c) => {
                const on = featuredClipIds.includes(c.id);
                const atCap = !on && featuredClipIds.length >= MAX_FEATURED_CALLS;
                return (
                  <li key={c.id} style={{ marginBottom: '0.35rem' }}>
                    <Toggle
                      compact
                      checked={on}
                      disabled={atCap}
                      onChange={() => toggleFeaturedClip(c.id)}
                      label={c.title || 'Recorded call'}
                      description={
                        atCap
                          ? `${MAX_FEATURED_CALLS} max — remove one first`
                          : c.mediaUrl
                            ? 'Ready to feature'
                            : 'Ready'
                      }
                      id={`feature-clip-${c.id}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="form-field" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            <label className="form-field__label" htmlFor="resume-clips">
              Extra highlight URLs
            </label>
            <textarea
              id="resume-clips"
              className="field"
              value={highlights}
              onChange={(e) => update({ highlights: e.target.value })}
              rows={2}
              placeholder="Optional — one URL per line"
            />
            <p className="form-field__hint">Legacy or external links. Featured calls above are preferred.</p>
          </div>
        </Panel>

        {savedSlug && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Link href={repPublicPath(savedSlug)} className="btn-ghost">
              Preview →
            </Link>
          </div>
        )}
        {msg && <p className={msg.includes('Failed') || msg.includes('Choose') ? 'msg-err' : 'msg-ok'}>{msg}</p>}
      </form>

      {inbox.length > 0 && (
        <Panel title="Direct Connect inbox" description="Messages from brands and founders.">
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {inbox.slice(0, 20).map((m) => (
              <li key={m.id} className="session-row" style={{ display: 'block' }}>
                <div className="session-row__meta">
                  From {m.fromUser?.displayName || m.fromUser?.email || 'Recruiter'} ·{' '}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
                <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <UnsavedChangesBar
        dirty={dirty}
        saving={saving}
        saveDisabled={saveDisabled}
        onReset={handleReset}
        onSave={saveResume}
        saveLabel="Save"
      />
    </main>
  );
}
