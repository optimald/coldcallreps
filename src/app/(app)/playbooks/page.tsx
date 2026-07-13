'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
} from '@/components/ui/PagePrimitives';
import {
  DEFAULT_PLAYBOOKS,
  DEFAULT_PLAYBOOK_TITLE,
} from '@/lib/playbooks/default';

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('foundation');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/playbooks');
      const data = await res.json();
      setPlaybooks(data.playbooks || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(opts?: { useTemplateTitle?: boolean }) {
    const selected = DEFAULT_PLAYBOOKS.find((p) => p.key === template) ?? DEFAULT_PLAYBOOKS[0];
    const name = title.trim() || (opts?.useTemplateTitle ? selected.title : '');
    if (!name) {
      setMsg('Add a title first.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, template: selected.key }),
      });
      const data = await res.json();
      if (res.ok) {
        setTitle('');
        window.location.href = `/playbooks/${data.playbook.id}`;
      } else setMsg(data.error);
    } finally {
      setBusy(false);
    }
  }

  const selectedTemplate =
    DEFAULT_PLAYBOOKS.find((p) => p.key === template) ?? DEFAULT_PLAYBOOKS[0];

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Train"
        title="Playbooks"
        description="Your talk-track skeleton injects into Practice playbooks and live coach. Review the playbook before you start a rep."
      />

      <Panel
        title="New playbook"
        description="Creates an editable Open → Qualify → Pitch → Close form you can tune for your motion."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="form-field">
            <label className="form-field__label" htmlFor="playbook-template">
              Starter template
            </label>
            <select
              id="playbook-template"
              className="field"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {DEFAULT_PLAYBOOKS.map((pb) => (
                <option key={pb.key} value={pb.key}>
                  {pb.title}
                </option>
              ))}
            </select>
            <p className="form-field__hint">{selectedTemplate.description}</p>
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="playbook-title">
              Title
            </label>
            <input
              id="playbook-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedTemplate.title || DEFAULT_PLAYBOOK_TITLE}
              maxLength={160}
            />
            <p className="form-field__hint">
              Leave blank and use “Create from template” to keep the template title, or set a custom
              name for the same skeleton.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={busy}>
              Create playbook
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => create({ useTemplateTitle: true })}
            >
              Create from template
            </button>
          </div>
        </form>
        {msg && (
          <p className={msg.includes('title') ? 'msg-err' : 'msg-ok'} style={{ marginBottom: 0, marginTop: '0.75rem' }}>
            {msg}
          </p>
        )}
      </Panel>

      {loading ? (
        <p className="muted">Loading playbooks…</p>
      ) : playbooks.length === 0 ? (
        <Panel>
          <EmptyState
            title="No playbooks yet"
            description="Starter playbooks are created automatically on first visit — refresh if you don’t see them."
          />
        </Panel>
      ) : (
        <div className="page-grid">
          {playbooks.map((p) => {
            let steps: number | null = null;
            try {
              const content = typeof p.contentJSON === 'string' ? JSON.parse(p.contentJSON) : p.content;
              steps = Array.isArray(content?.steps) ? content.steps.length : null;
            } catch {
              steps = Array.isArray(p.content?.steps) ? p.content.steps.length : null;
            }
            return (
              <Link key={p.id} href={`/playbooks/${p.id}`} className="card-tile">
                <h2 className="card-tile__title">{p.title}</h2>
                <p className="card-tile__meta">
                  {p.brand?.name ? `${p.brand.name} · ` : p.brandId ? 'Brand · ' : ''}
                  {steps != null ? `${steps} steps` : 'Custom playbook'}
                  {p.updatedAt
                    ? ` · updated ${new Date(p.updatedAt).toLocaleDateString()}`
                    : ''}
                </p>
                <span className="card-tile__footer">Edit form →</span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
