'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MAX_FEATURED = 3;

/** Compact resume toggle for session detail header actions. */
export default function SessionResumePick({
  clipId,
  isOwner,
  initiallyFeatured,
  hasRecording,
}: {
  clipId: string | null;
  sessionId: string;
  isOwner: boolean;
  initiallyFeatured: boolean;
  hasRecording: boolean;
}) {
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [onResume, setOnResume] = useState(initiallyFeatured);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        let ids: string[] = [];
        try {
          ids = JSON.parse(data.profile?.featuredClipIdsJSON || '[]');
        } catch {
          ids = [];
        }
        if (!cancelled) {
          setFeaturedIds(Array.isArray(ids) ? ids : []);
          if (clipId) setOnResume(ids.includes(clipId));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clipId, isOwner]);

  if (!isOwner) return null;

  async function toggle() {
    if (!clipId || !hasRecording) {
      setMsg(hasRecording ? 'Recording still processing…' : 'Needs a recording first');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      let next: string[];
      if (onResume) {
        next = featuredIds.filter((id) => id !== clipId);
      } else {
        if (featuredIds.length >= MAX_FEATURED && !featuredIds.includes(clipId)) {
          setMsg(`Resume full (${MAX_FEATURED}). Manage on Profile.`);
          setBusy(false);
          return;
        }
        next = [...featuredIds.filter((id) => id !== clipId), clipId].slice(0, MAX_FEATURED);
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredClipIds: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update resume');
      setFeaturedIds(next);
      setOnResume(next.includes(clipId));
      setMsg(next.includes(clipId) ? 'On resume' : 'Removed');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-resume-pick session-resume-pick--compact">
      <button
        type="button"
        className={onResume ? 'btn' : 'btn-ghost'}
        onClick={() => void toggle()}
        disabled={busy || !hasRecording || !clipId}
        title={
          hasRecording
            ? onResume
              ? 'Remove from resume'
              : 'Feature on public resume (max 3)'
            : 'Recording required to feature on resume'
        }
      >
        {onResume ? 'On resume' : 'Use on resume'}
      </button>
      <Link href="/hiring" className="soft-link">
        Manage →
      </Link>
      {msg ? <span className="session-resume-pick__msg muted">{msg}</span> : null}
    </div>
  );
}
