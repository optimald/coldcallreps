'use client';

import { useEffect, useState } from 'react';
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
import { useShell } from '@/components/ShellProvider';

type ResumeForm = {
  openToWork: boolean;
  headline: string;
  summary: string;
  experience: string;
  skills: string;
  featuredClipIds: string[];
};

const MAX_FEATURED_CALLS = 3;

const EMPTY_RESUME: ResumeForm = {
  openToWork: false,
  headline: '',
  summary: '',
  experience: '',
  skills: '',
  featuredClipIds: [],
};

export default function ResumePage() {
  const shell = useShell();
  const [points, setPoints] = useState(() => shell?.metrics.totalPoints || 0);
  const [streak, setStreak] = useState(() => shell?.metrics.currentStreak || 0);
  const [badges, setBadges] = useState<string[]>([]);
  const [savedSlug, setSavedSlug] = useState<string | null>(
    () => shell?.metrics.profileSlug || null
  );
  const [clips, setClips] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const { values, update, dirty, hydrate, markSaved, reset } =
    useUnsavedForm<ResumeForm>(EMPTY_RESUME);
  const { openToWork, headline, summary, experience, skills, featuredClipIds } =
    values;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meRes, profileRes, clipsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/profile'),
          fetch('/api/clips'),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) {
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
            let nextFeatured: string[] = [];
            try {
              nextSkills = JSON.parse(d.profile.skillsJSON || '[]').join(', ');
            } catch {
              nextSkills = '';
            }
            try {
              nextFeatured = JSON.parse(d.profile.featuredClipIdsJSON || '[]');
              if (!Array.isArray(nextFeatured)) nextFeatured = [];
              nextFeatured = nextFeatured.map(String).filter(Boolean).slice(0, MAX_FEATURED_CALLS);
            } catch {
              nextFeatured = [];
            }
            hydrate({
              openToWork: Boolean(d.openToWork),
              headline: d.hiringHeadline || '',
              summary: d.profile.bio || '',
              experience: d.hiringBio || '',
              skills: nextSkills,
              featuredClipIds: nextFeatured,
            });
            setSavedSlug(d.profile.slug || null);
          }
        }

        if (clipsRes.ok) {
          const d = await clipsRes.json();
          if (!cancelled) setClips(d.clips || []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load resume.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  async function saveResume() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: summary,
          headline,
          hiringBio: experience,
          openToWork,
          skills: skills
            .split(',')
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
          openToWork: Boolean(data.openToWork),
          featuredClipIds: savedFeatured,
        };
        markSaved(next);
        if (data.profile?.slug) setSavedSlug(data.profile.slug);
        setMsg(
          next.openToWork
            ? 'Resume saved — you’re visible on the talent board.'
            : 'Resume saved.'
        );
      } else {
        setMsg(data.error || 'Failed to save');
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

  return (
    <main className="app-page app-page--readable">
      <PageHeader
        eyebrow="Career"
        title="Resume"
        description="Practice signal and the story founders see when you go open to work."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {savedSlug ? (
              <Link
                href={repPublicPath(savedSlug)}
                className="btn-ghost"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public page
              </Link>
            ) : (
              <Link href="/hiring" className="btn-ghost">
                Claim handle →
              </Link>
            )}
          </div>
        }
      />

      {loadError && <p className="msg-err">{loadError}</p>}

      <StatGrid>
        <Stat label="Points" value={points} />
        <Stat label="Streak" value={`${streak}d`} tone={streak > 0 ? 'good' : undefined} />
        <Stat label="Badges" value={badges.length} />
        <Stat
          label="Board"
          value={openToWork ? 'Visible' : 'Hidden'}
          tone={openToWork ? 'accent' : undefined}
        />
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
          {!savedSlug ? (
            <p className="form-field__hint" style={{ marginBottom: 0 }}>
              Claim a public handle on{' '}
              <SoftLink href="/hiring">Profile</SoftLink> before going live.
            </p>
          ) : null}
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--muted)',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: '1.25rem',
                      }}
                    >
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
        </Panel>

        {msg && (
          <p className={msg.includes('Failed') || msg.includes('feature') ? 'msg-err' : 'msg-ok'}>
            {msg}
          </p>
        )}
      </form>

      <UnsavedChangesBar
        dirty={dirty}
        saving={saving}
        onReset={() => {
          reset();
          setMsg('');
        }}
        onSave={saveResume}
        saveLabel="Save resume"
      />
    </main>
  );
}
