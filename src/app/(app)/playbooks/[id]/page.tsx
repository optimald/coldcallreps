'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, Panel } from '@/components/ui/PagePrimitives';
import UnsavedChangesBar from '@/components/ui/UnsavedChangesBar';
import { useUnsavedForm } from '@/hooks/useUnsavedForm';

interface Step {
  title: string;
  script: string;
  objections: string;
}

type PlaybookForm = {
  title: string;
  steps: Step[];
};

const DEFAULT_FORM: PlaybookForm = {
  title: '',
  steps: [{ title: 'Open', script: '', objections: '' }],
};

export default function PlaybookEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');
  const { values, setValues, update, dirty, hydrate, markSaved, reset } =
    useUnsavedForm<PlaybookForm>(DEFAULT_FORM);
  const { title, steps } = values;

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    fetch(`/api/playbooks/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to load playbook');
        }
        return r.json();
      })
      .then((d) => {
        if (!d?.playbook) {
          setNotFound(true);
          return;
        }
        let nextSteps: Step[] = [{ title: 'Open', script: '', objections: '' }];
        try {
          const content = JSON.parse(d.playbook.contentJSON || '{}');
          const raw = Array.isArray(content.steps) ? content.steps : [];
          if (raw.length) {
            nextSteps = raw.map((s: any) =>
              typeof s === 'string'
                ? { title: s, script: s, objections: '' }
                : {
                    title: s.title || 'Step',
                    script: s.script || '',
                    objections: (s.objections || []).join('\n'),
                  }
            );
          }
        } catch {
          /* keep default */
        }
        hydrate({ title: d.playbook.title || '', steps: nextSteps });
      })
      .catch((e) => setLoadError(e.message || 'Failed to load playbook'))
      .finally(() => setLoading(false));
  }, [id, hydrate]);

  function updateStep(i: number, patch: Partial<Step>) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }

  function removeStep(i: number) {
    setValues((prev) => ({
      ...prev,
      steps: prev.steps.length <= 1 ? prev.steps : prev.steps.filter((_, idx) => idx !== i),
    }));
  }

  async function save() {
    if (loading || loadError || notFound) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/playbooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: {
            steps: steps.map((s) => ({
              title: s.title,
              script: s.script,
              objections: s.objections
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean),
            })),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        markSaved();
        setMsg('Saved. Select this playbook on the trainer before you start a rep.');
      } else {
        setMsg(data.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removePlaybook() {
    if (loading || loadError || notFound || deleting) return;
    if (!confirm('Delete this playbook? This cannot be undone.')) return;
    setDeleting(true);
    setMsg('');
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Failed to delete');
        return;
      }
      router.push('/playbooks');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading playbook…</p>
      </main>
    );
  }

  if (notFound || loadError) {
    return (
      <main className="app-page">
        <PageHeader
          title={notFound ? 'Playbook not found' : 'Could not load'}
          description={loadError || 'This playbook may have been removed.'}
        />
        <Link href="/playbooks" className="soft-link">
          ← Playbooks
        </Link>
      </main>
    );
  }

  return (
    <main className="app-page app-page--readable">
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/playbooks" className="muted" style={{ fontWeight: 600 }}>
          ← Playbooks
        </Link>
      </p>

      <PageHeader
        eyebrow="Edit"
        title="Playbook form"
        description="Each step becomes a cheat-sheet section and coach instruction when selected on the trainer."
        actions={
          <>
            <Link href="/trainer" className="btn-ghost">
              Open trainer
            </Link>
            <button
              type="button"
              className="btn-ghost"
              disabled={deleting || saving}
              onClick={() => void removePlaybook()}
              style={{ color: 'var(--danger)' }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Panel title="Basics">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label" htmlFor="pb-title">
              Playbook title
            </label>
            <input
              id="pb-title"
              className="field"
              value={title}
              onChange={(e) => update({ title: e.target.value })}
              required
              maxLength={160}
            />
          </div>
        </Panel>

        <Panel
          title="Call steps"
          description="Script is what you say. Objections are one per line — coach will help you handle them."
        >
          {steps.map((s, i) => (
            <div key={i} className="playbook-step-card">
              <div className="playbook-step-card__head">
                <span className="playbook-step-card__num">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button type="button" className="btn-ghost" onClick={() => removeStep(i)}>
                    Remove
                  </button>
                )}
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor={`step-title-${i}`}>
                  Step title
                </label>
                <input
                  id={`step-title-${i}`}
                  className="field"
                  value={s.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder="Open"
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor={`step-script-${i}`}>
                  Script / talk track
                </label>
                <textarea
                  id={`step-script-${i}`}
                  className="field"
                  value={s.script}
                  onChange={(e) => updateStep(i, { script: e.target.value })}
                  rows={3}
                  placeholder="What you say in this beat…"
                  required
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-field__label" htmlFor={`step-obj-${i}`}>
                  Objections (one per line)
                </label>
                <textarea
                  id={`step-obj-${i}`}
                  className="field"
                  value={s.objections}
                  onChange={(e) => updateStep(i, { objections: e.target.value })}
                  rows={2}
                  placeholder={"Who is this?\nWe're not interested."}
                />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  steps: [...prev.steps, { title: 'Step', script: '', objections: '' }],
                }))
              }
            >
              Add step
            </button>
          </div>
        </Panel>
      </form>

      {msg && <p className={msg.includes('Failed') ? 'msg-err' : 'msg-ok'}>{msg}</p>}

      <UnsavedChangesBar
        dirty={dirty}
        saving={saving}
        onReset={() => {
          reset();
          setMsg('');
        }}
        onSave={save}
        saveLabel="Save"
      />
    </main>
  );
}
