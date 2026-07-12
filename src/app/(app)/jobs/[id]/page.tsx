'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function JobDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [job, setJob] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [applications, setApplications] = useState<any[] | null>(null);
  const [isPoster, setIsPoster] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/jobs/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          setJob(null);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.job) setJob(d.job);
        else if (d !== null) setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    fetch(`/api/jobs/${id}/applications`)
      .then((r) => {
        if (r.ok) {
          setIsPoster(true);
          return r.json();
        }
        return null;
      })
      .then((d) => d && setApplications(d.applications || []))
      .catch(() => {});
  }, [id]);

  async function apply() {
    setBusy(true);
    const res = await fetch(`/api/jobs/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    setMsg(res.ok ? data.notice : data.error);
    if (res.ok) setJob((j: any) => (j ? { ...j, applied: true } : j));
    setBusy(false);
  }

  async function setStatus(applicationId: string, status: string) {
    const res = await fetch(`/api/jobs/${id}/applications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, status }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Marked ${status}.` : data.error);
    if (res.ok) {
      setApplications((list) =>
        (list || []).map((a) => (a.id === applicationId ? { ...a, status } : a))
      );
    }
  }

  if (loading) {
    return (
      <main className="app-page">
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </main>
    );
  }

  if (notFound || !job) {
    return (
      <main className="app-page">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>Job not found</h1>
        <p style={{ color: 'var(--muted)' }}>This posting may have been removed or the link is wrong.</p>
        <Link href="/jobs" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          ← Back to jobs
        </Link>
      </main>
    );
  }

  return (
    <main className="app-page">
      <p>
        <Link href="/jobs" style={{ color: 'var(--muted)' }}>
          ← Jobs
        </Link>
      </p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem' }}>{job.title}</h1>
      <p style={{ color: 'var(--muted)' }}>
        {job.company || job.posterName}
        {job.posterSlug && (
          <>
            {' '}
            ·{' '}
            <Link href={`/${job.posterSlug}`} style={{ color: 'var(--accent)' }}>
              poster profile
            </Link>
          </>
        )}
      </p>
      {job.scenarioTags?.length > 0 && (
        <p style={{ color: 'var(--accent-2)', fontSize: '0.9rem' }}>
          Scenario tags: {job.scenarioTags.join(', ')}
        </p>
      )}
      <p style={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{job.description}</p>

      {isPoster && applications && (
        <section style={panel}>
          <strong>Applications ({applications.length})</strong>
          {applications.length === 0 ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>No applicants yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {applications.map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: '0.65rem 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: '0.9rem',
                  }}
                >
                  <strong>{a.applicant.displayName}</strong>
                  {a.applicant.verified ? ' · verified' : ''} · {a.applicant.totalPoints} pts ·{' '}
                  {a.status}
                  {a.applicant.profileSlug && (
                    <>
                      {' '}
                      ·{' '}
                      <Link href={`/${a.applicant.profileSlug}`} style={{ color: 'var(--accent)' }}>
                        profile
                      </Link>
                    </>
                  )}
                  {a.message && (
                    <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>{a.message}</div>
                  )}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                    {['viewed', 'rejected', 'hired'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(a.id, s)}
                        className="btn-ghost btn-ghost--sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!isPoster &&
        (job.applied ? (
          <p style={{ color: 'var(--accent-2)', fontWeight: 600 }}>You already applied.</p>
        ) : (
          <div style={panel}>
            <strong>Apply</strong>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Short note — why you're a fit (optional)"
              style={input}
            />
            <button type="button" onClick={apply} disabled={busy} className="btn">
              Submit application
            </button>
          </div>
        ))}
      {msg && <p style={{ color: 'var(--accent-2)' }}>{msg}</p>}
    </main>
  );
}

const panel: React.CSSProperties = {
  marginTop: '1.25rem',
  padding: '1rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
};
