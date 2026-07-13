'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';
import { repPublicPath } from '@/lib/public-urls';
import { useShell } from '@/components/ShellProvider';

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

type ProfileForm = {
  slug: string;
};

const EMPTY_PROFILE: ProfileForm = { slug: '' };

export default function ProfilePage() {
  const shell = useShell();
  const [role, setRole] = useState<string>(() => shell?.role || 'REP');
  const [displayName, setDisplayName] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');
  const [handleError, setHandleError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [board, setBoard] = useState<BoardProfile[]>([]);
  const [interested, setInterested] = useState<
    {
      id: string;
      rep: {
        displayName: string | null;
        headline: string | null;
        slug: string | null;
        verified: boolean;
        totalPoints: number;
      };
    }[]
  >([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('https://coldcallreps.com');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const { values, update, dirty, hydrate, markSaved, reset } =
    useUnsavedForm<ProfileForm>(EMPTY_PROFILE);
  const { slug } = values;

  const isTalentViewer =
    role === 'RECRUITER' || role === 'BRAND' || role === 'SUPERADMIN';

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meRes, profileRes, boardRes, inboxRes, interestRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/profile'),
          fetch('/api/hiring/board?limit=50'),
          fetch('/api/recruiter/messages?box=inbox'),
          fetch('/api/talent/interest?status=interested'),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) {
            setRole(me.platformRole || 'REP');
            setDisplayName(me.displayName || '');
          }
        }

        if (profileRes.ok) {
          const d = await profileRes.json();
          if (!cancelled && d.profile) {
            hydrate({ slug: d.profile.slug || '' });
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

        if (inboxRes.ok) {
          const d = await inboxRes.json();
          if (!cancelled) setInbox(d.messages || []);
        }

        if (interestRes.ok) {
          const d = await interestRes.json();
          if (!cancelled) setInterested(d.interests || []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load profile.');
        }
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

  async function saveProfile() {
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
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (res.ok) {
        markSaved({ slug: data.profile.slug });
        setSavedSlug(data.profile.slug);
        setHandleStatus('available');
        setHandleError('');
        setSuggestions([]);
        setMsg('Profile saved.');
      } else {
        setMsg(data.error || 'Failed to save');
        if (data.suggestions?.length) setSuggestions(data.suggestions);
        if (res.status === 409) setHandleStatus('taken');
      }
    } finally {
      setSaving(false);
    }
  }

  const linkSlug = savedSlug || (handleStatus === 'available' && slug.trim() ? slug.trim() : '');
  const profilePath = linkSlug ? repPublicPath(linkSlug) : '';
  const profileUrl = profilePath ? `${origin}${profilePath}` : '';

  async function copyProfileLink() {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setMsg('Could not copy — select the link manually.');
    }
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (isTalentViewer) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Career"
          title="Talent board"
          description="Swipe right on resumes to shortlist. Open-to-work reps ranked by clean practice signal."
          actions={
            <Link href="/campaigns" className="btn">
              Post a campaign
            </Link>
          }
        />
        {loadError && <p className="msg-err">{loadError}</p>}

        {interested.length > 0 ? (
          <Panel
            title="Your shortlist"
            description="SDRs you marked Interested on their public resume."
          >
            <div className="stack">
              {interested.map((row) => (
                <div key={row.id} className="session-row" style={{ display: 'block' }}>
                  <strong>
                    {row.rep.slug ? (
                      <Link href={`/${row.rep.slug}`} style={{ color: 'inherit' }}>
                        {row.rep.displayName || 'Rep'}
                        {row.rep.verified ? ' ✓' : ''}
                      </Link>
                    ) : (
                      row.rep.displayName || 'Rep'
                    )}
                  </strong>
                  {row.rep.headline ? (
                    <div style={{ marginTop: '0.25rem', fontWeight: 600 }}>{row.rep.headline}</div>
                  ) : null}
                  <div className="session-row__meta">{row.rep.totalPoints} pts</div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

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
              <div
                key={p.profileSlug || `${p.displayName}-${i}`}
                className="session-row"
                style={{ display: 'block' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
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
        eyebrow="Account"
        title="Profile"
        description="Your public handle and Direct Connect inbox. Edit career copy on Resume."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/resume" className="btn-ghost">
              Edit resume
            </Link>
            {savedSlug ? (
              <Link
                href={repPublicPath(savedSlug)}
                className="btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public page
              </Link>
            ) : undefined}
          </div>
        }
      />

      {loadError && <p className="msg-err">{loadError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveProfile();
        }}
      >
        <Panel title="Identity">
          <div className="form-field">
            <label className="form-field__label" htmlFor="profile-name">
              Display name
            </label>
            <input id="profile-name" className="field" value={displayName} disabled />
            <p className="form-field__hint">
              Managed from your account. Handle is your public URL.
            </p>
          </div>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label" htmlFor="profile-slug">
              Public handle
            </label>
            <div className="profile-link-copy">
              <span className="muted profile-handle-prefix">coldcallreps.com/</span>
              <input
                id="profile-slug"
                className="field"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="your-handle"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button
                type="button"
                className="btn"
                disabled={!linkSlug}
                onClick={() => void copyProfileLink()}
                aria-label="Copy profile link"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="form-field__hint" style={{ color: statusColor }}>
              {handleStatus === 'available'
                ? 'Available — Copy shares your full profile URL'
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
                  <button
                    key={s}
                    type="button"
                    className="btn-ghost"
                    onClick={() => onSlugChange(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {msg && (
          <p className={msg.includes('Failed') || msg.includes('Choose') ? 'msg-err' : 'msg-ok'}>
            {msg}
          </p>
        )}
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
        onReset={() => {
          reset();
          setMsg('');
          setHandleError('');
          setSuggestions([]);
          setHandleStatus('available');
        }}
        onSave={saveProfile}
        saveLabel="Save profile"
      />
    </main>
  );
}
