'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Toggle from '@/components/ui/Toggle';

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function AcademyPage() {
  const [academy, setAcademy] = useState<any>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('SDR Academy');
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newCurriculum, setNewCurriculum] = useState('');
  const [newFocus, setNewFocus] = useState('gatekeeper,standard');
  const [teamSlug, setTeamSlug] = useState('');
  const [publicBio, setPublicBio] = useState('');
  const [openToHire, setOpenToHire] = useState(false);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');
  const [handleError, setHandleError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedTeamSlug, setSavedTeamSlug] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const res = await fetch('/api/academy');
    const data = await res.json();
    setAcademy(data.academy);
    setPublicUrl(data.publicUrl || null);
    setNotice(data.notice || '');
    if (data.academy) {
      setTeamSlug(data.academy.slug || '');
      setSavedTeamSlug(data.academy.slug || null);
      setPublicBio(data.academy.publicBio || '');
      setOpenToHire(Boolean(data.academy.openToHire));
      if (data.academy.slug) setHandleStatus('available');
      const p = await fetch('/api/academy/progress').then((r) => r.json());
      setProgress(p.progress || []);
    }
  }

  function onTeamSlugChange(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setTeamSlug(next);
    setMsg('');
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!next.trim()) {
      setHandleStatus('idle');
      setHandleError('');
      setSuggestions([]);
      return;
    }
    if (savedTeamSlug && next === savedTeamSlug) {
      setHandleStatus('available');
      setHandleError('');
      setSuggestions([]);
      return;
    }

    setHandleStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/academy/handle?q=${encodeURIComponent(next)}`);
        const data = await res.json();
        if (data.available) {
          setHandleStatus('available');
          setHandleError('');
          setSuggestions([]);
          if (data.handle && data.handle !== next) setTeamSlug(data.handle);
        } else {
          setHandleStatus(data.handle ? 'taken' : 'invalid');
          setHandleError(data.error || 'Unavailable');
          setSuggestions(data.suggestions || []);
          if (data.handle) setTeamSlug(data.handle);
        }
      } catch {
        setHandleStatus('idle');
      }
    }, 350);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const res = await fetch('/api/academy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setAcademy(data.academy);
      setMsg('Academy created.');
      load();
      return;
    }
    if (res.status === 402 && data.checkoutTier) {
      setMsg(data.error || 'Team plan required');
      const checkout = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: data.checkoutTier }),
      });
      const c = await checkout.json();
      if (c.url) window.location.href = c.url;
      return;
    }
    setMsg(data.error);
  }

  async function invite() {
    const res = await fetch('/api/academy/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Member added.' : data.error);
    if (res.ok) {
      setInviteEmail('');
      load();
    }
  }

  async function addCurriculum() {
    const res = await fetch('/api/academy/curricula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newCurriculum,
        focusAreas: newFocus.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Curriculum added.' : data.error);
    if (res.ok) {
      setNewCurriculum('');
      load();
    }
  }

  async function removeCurriculum(id: string) {
    const res = await fetch(`/api/academy/curricula?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    setMsg(res.ok ? 'Curriculum removed.' : data.error);
    if (res.ok) load();
  }

  async function saveTeamPage() {
    if (handleStatus === 'taken' || handleStatus === 'invalid') {
      setMsg(handleError || 'Choose an available handle first.');
      return;
    }
    const res = await fetch('/api/academy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: teamSlug, publicBio, openToHire }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg('Team page saved.');
      setPublicUrl(data.publicUrl || null);
      setSavedTeamSlug(data.academy?.slug || teamSlug);
      setTeamSlug(data.academy?.slug || teamSlug);
      setHandleStatus('available');
      setHandleError('');
      setSuggestions([]);
      load();
    } else {
      setMsg(data.error || 'Failed');
      if (data.suggestions?.length) setSuggestions(data.suggestions);
      if (res.status === 409) setHandleStatus('taken');
    }
  }

  return (
    <main className="app-page">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Org academy</h1>
      <p style={{ color: 'var(--muted)' }}>Curricula for SDR teams — progress from practice sessions.</p>
      {notice && <p style={{ color: 'var(--muted)' }}>{notice}</p>}
      {!academy ? (
        <div style={panel}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <button type="button" onClick={create} className="btn">
            Create academy
          </button>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{academy.name}</h2>
          {publicUrl && (
            <p style={{ color: 'var(--muted)' }}>
              Public team page:{' '}
              <Link href={publicUrl} style={{ color: 'var(--accent)' }}>
                {publicUrl}
              </Link>
            </p>
          )}

          <div style={{ ...panel, marginBottom: '1rem' }}>
            <strong>Public team profile</strong>
            <div style={{ margin: '0.5rem 0' }}>
              <Toggle
                checked={openToHire}
                onChange={setOpenToHire}
                label="Open to hire"
                description="Shows a Hiring badge on your public team page"
              />
            </div>
            <label style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Team handle
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  /
                </span>
                <input
                  value={teamSlug}
                  onChange={(e) => onTeamSlugChange(e.target.value)}
                  placeholder="your-team"
                  style={{ ...input, marginTop: 0 }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div
                style={{
                  marginTop: '0.3rem',
                  fontSize: '0.85rem',
                  color:
                    handleStatus === 'available'
                      ? 'var(--accent-2)'
                      : handleStatus === 'checking' || handleStatus === 'idle'
                        ? 'var(--muted)'
                        : 'var(--bad)',
                  minHeight: '1.2em',
                }}
              >
                {handleStatus === 'available' && 'Available'}
                {handleStatus === 'checking' && 'Checking…'}
                {handleStatus === 'taken' && `Taken — ${handleError}`}
                {handleStatus === 'invalid' && handleError}
              </div>
              {suggestions.length > 0 && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Try:{' '}
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onTeamSlugChange(s)}
                      style={{
                        marginRight: '0.35rem',
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        padding: '0.15rem 0.45rem',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </label>
            <textarea
              value={publicBio}
              onChange={(e) => setPublicBio(e.target.value)}
              placeholder="Public bio for brands / candidates"
              rows={3}
              style={input}
            />
            <button
              type="button"
              onClick={saveTeamPage}
              className="btn"
              disabled={
                handleStatus === 'taken' ||
                handleStatus === 'invalid' ||
                handleStatus === 'checking'
              }
            >
              Save team page
            </button>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(academy.curricula || []).map((c: any) => {
              const p = progress.find((x) => x.curriculumId === c.id);
              let focusAreas: string[] = [];
              try {
                focusAreas = JSON.parse(c.focusAreas || '[]');
              } catch {
                focusAreas = [];
              }
              return (
                <li key={c.id} style={panel}>
                  <strong>{c.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {p
                      ? `${p.sessions} sessions · best ${p.bestScore}${p.complete ? ' · complete ✓' : ''}`
                      : 'Loading progress…'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {focusAreas.map((fa) => (
                      <Link
                        key={fa}
                        href={`/trainer?focus=${fa}`}
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--accent)',
                          border: '1px solid var(--line)',
                          borderRadius: 999,
                          padding: '0.2rem 0.55rem',
                        }}
                      >
                        Practice {fa}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => removeCurriculum(c.id)}
                      style={{
                        fontSize: '0.75rem',
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div style={{ ...panel, marginBottom: '1rem' }}>
            <strong>Add curriculum</strong>
            <input
              value={newCurriculum}
              onChange={(e) => setNewCurriculum(e.target.value)}
              placeholder="Title"
              style={input}
            />
            <input
              value={newFocus}
              onChange={(e) => setNewFocus(e.target.value)}
              placeholder="Focus areas (comma-separated)"
              style={input}
            />
            <button type="button" onClick={addCurriculum} className="btn">
              Add
            </button>
          </div>

          <h3 style={{ fontSize: '1.05rem' }}>
            Members{' '}
            <Link href="/team" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent)' }}>
              Open roster →
            </Link>
          </h3>
          <ul style={{ color: 'var(--muted)' }}>
            {(academy.members || []).map((m: any) => (
              <li key={m.id}>
                {m.userId.slice(0, 12)}… · {m.role}
              </li>
            ))}
          </ul>
          <div style={{ ...panel, marginTop: '0.75rem' }}>
            <strong>Invite by email</strong>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="rep@company.com"
              style={input}
            />
            <button type="button" onClick={invite} className="btn">
              Add member
            </button>
          </div>
        </div>
      )}
      {msg && <p style={{ color: 'var(--accent-2)' }}>{msg}</p>}
    </main>
  );
}

const panel: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '1rem',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
  marginBottom: '0.5rem',
};
