'use client';

import { useEffect, useRef, useState } from 'react';
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
  productUrl: string;
  trainingVideoUrl: string;
  trainingImages: string[];
};

const DEFAULT_FORM: PlaybookForm = {
  title: '',
  steps: [{ title: 'Open', script: '', objections: '' }],
  productUrl: '',
  trainingVideoUrl: '',
  trainingImages: [],
};

const MAX_TRAINING_IMAGES = 8;

function looksLikeMediaUrl(url: string): boolean {
  const t = url.trim();
  return Boolean(t) && (/^https?:\/\//i.test(t) || t.startsWith('/'));
}

export default function PlaybookEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');
  const { values, setValues, update, dirty, hydrate, markSaved, reset } =
    useUnsavedForm<PlaybookForm>(DEFAULT_FORM);
  const { title, steps, productUrl, trainingVideoUrl, trainingImages } = values;

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadAvailable, setUploadAvailable] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
        let nextProductUrl = '';
        let nextVideoUrl = '';
        let nextImages: string[] = [];
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
          if (typeof content.productUrl === 'string') nextProductUrl = content.productUrl;
          if (typeof content.trainingVideoUrl === 'string') {
            nextVideoUrl = content.trainingVideoUrl;
          }
          if (Array.isArray(content.trainingImages)) {
            nextImages = content.trainingImages.map(String).filter(Boolean).slice(0, MAX_TRAINING_IMAGES);
          }
        } catch {
          /* keep default */
        }
        hydrate({
          title: d.playbook.title || '',
          steps: nextSteps,
          productUrl: nextProductUrl,
          trainingVideoUrl: nextVideoUrl,
          trainingImages: nextImages,
        });
      })
      .catch((e) => setLoadError(e.message || 'Failed to load playbook'))
      .finally(() => setLoading(false));
  }, [id, hydrate]);

  useEffect(() => {
    if (!id || loading || notFound || loadError) return;
    fetch(`/api/playbooks/${id}/assets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUploadAvailable(Boolean(d?.uploadAvailable)))
      .catch(() => setUploadAvailable(false));
  }, [id, loading, notFound, loadError]);

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

  function updateImageAt(i: number, value: string) {
    setValues((prev) => ({
      ...prev,
      trainingImages: prev.trainingImages.map((u, idx) => (idx === i ? value : u)),
    }));
  }

  function removeImageAt(i: number) {
    setValues((prev) => ({
      ...prev,
      trainingImages: prev.trainingImages.filter((_, idx) => idx !== i),
    }));
  }

  function addImageSlot() {
    setValues((prev) => {
      if (prev.trainingImages.length >= MAX_TRAINING_IMAGES) return prev;
      return { ...prev, trainingImages: [...prev.trainingImages, ''] };
    });
  }

  async function uploadAsset(file: File, kind: 'image' | 'video') {
    if (!id || uploading) return;
    setUploading(kind);
    setMsg('');
    try {
      const res = await fetch(`/api/playbooks/${id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type || undefined, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Upload not available');
        return;
      }
      const put = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: data.uploadHeaders || { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) {
        setMsg('Upload failed — try again or paste a public URL.');
        return;
      }
      const publicUrl = String(data.publicUrl || '');
      if (!publicUrl) {
        setMsg('Upload succeeded but no public URL returned.');
        return;
      }
      if (kind === 'video') {
        update({ trainingVideoUrl: publicUrl });
      } else {
        setValues((prev) => {
          if (prev.trainingImages.length >= MAX_TRAINING_IMAGES) return prev;
          return { ...prev, trainingImages: [...prev.trainingImages, publicUrl] };
        });
      }
      setMsg('Uploaded — save the playbook to keep this media.');
    } catch {
      setMsg('Upload failed — paste a public URL instead.');
    } finally {
      setUploading(null);
    }
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
            productUrl: productUrl.trim() || undefined,
            trainingVideoUrl: trainingVideoUrl.trim() || undefined,
            trainingImages: trainingImages.map((u) => u.trim()).filter(Boolean),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        markSaved();
        setMsg('Saved. Select this playbook in Practice before you start a rep.');
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
        description="Each step becomes a playbook section and coach instruction when selected in Practice. Add product media so SDRs can review before dialing."
        actions={
          <>
            <Link href="/practice" className="btn-ghost">
              Open Practice
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
          title="Product media"
          description="SDRs see this in Review playbook on Practice and Cold Call — product link, images, and an optional training video."
        >
          <div className="form-field">
            <label className="form-field__label" htmlFor="pb-product-url">
              Product URL
            </label>
            <input
              id="pb-product-url"
              className="field"
              type="url"
              value={productUrl}
              onChange={(e) => update({ productUrl: e.target.value })}
              placeholder="https://example.com/product"
              maxLength={500}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="pb-video-url">
              Training video URL
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                id="pb-video-url"
                className="field"
                style={{ flex: '1 1 220px' }}
                type="url"
                value={trainingVideoUrl}
                onChange={(e) => update({ trainingVideoUrl: e.target.value })}
                placeholder="https://…/demo.mp4"
                maxLength={2000}
              />
              {uploadAvailable && (
                <>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadAsset(file, 'video');
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={Boolean(uploading)}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {uploading === 'video' ? 'Uploading…' : 'Upload video'}
                  </button>
                </>
              )}
            </div>
            {looksLikeMediaUrl(trainingVideoUrl) && (
              <div style={{ marginTop: '0.65rem' }}>
                {/\.(mp4|webm|mov)(\?|$)/i.test(trainingVideoUrl.trim()) ||
                trainingVideoUrl.trim().startsWith('/') ? (
                  <video
                    controls
                    preload="metadata"
                    src={trainingVideoUrl.trim()}
                    style={{ width: '100%', maxHeight: 220, borderRadius: 8 }}
                  />
                ) : (
                  <a
                    href={trainingVideoUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="soft-link"
                  >
                    Preview video link →
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-field__label">Training image URLs</label>
            <p className="muted" style={{ margin: '0 0 0.55rem', fontSize: '0.85rem' }}>
              Up to {MAX_TRAINING_IMAGES} images. Use https:// or / paths.
              {!uploadAvailable && ' Paste public URLs — file upload needs R2 storage.'}
            </p>
            {trainingImages.map((url, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  marginBottom: '0.55rem',
                }}
              >
                <input
                  className="field"
                  style={{ flex: '1 1 220px' }}
                  value={url}
                  onChange={(e) => updateImageAt(i, e.target.value)}
                  placeholder="https://…/product.jpg"
                  maxLength={2000}
                />
                <button type="button" className="btn-ghost" onClick={() => removeImageAt(i)}>
                  Remove
                </button>
                {looksLikeMediaUrl(url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url.trim()}
                    alt=""
                    style={{
                      width: 72,
                      height: 54,
                      objectFit: 'cover',
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                    }}
                  />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-ghost"
                disabled={trainingImages.length >= MAX_TRAINING_IMAGES}
                onClick={addImageSlot}
              >
                Add image URL
              </button>
              {uploadAvailable && (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadAsset(file, 'image');
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={
                      Boolean(uploading) || trainingImages.length >= MAX_TRAINING_IMAGES
                    }
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {uploading === 'image' ? 'Uploading…' : 'Upload image'}
                  </button>
                </>
              )}
            </div>
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

      {msg && <p className={msg.includes('Failed') || msg.includes('not available') || msg.includes('Upload failed') ? 'msg-err' : 'msg-ok'}>{msg}</p>}

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
