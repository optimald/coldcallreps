'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import Modal from '@/components/ui/Modal';
import { brandHref } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { DEMO_MSG } from '@/lib/demo/brand-demo-data';
import { CANONICAL_DEMO_BRANDS, resolveDemoBrandKey } from '@/lib/demo/canonical-brands';
import { DEFAULT_PLAYBOOKS } from '@/lib/playbooks/default';
import { EmptyState } from '@/components/ui/PagePrimitives';

type PlaybookRow = {
  id: string;
  title: string;
  updatedAt?: string;
  brandId?: string | null;
  stepCount?: number;
  objectionCount?: number;
  stepTitles?: string[];
  campaignCount?: number;
  productUrl?: string | null;
  hasTrainingMedia?: boolean;
};

function demoPlaybooksForBrand(brandKey: string): PlaybookRow[] {
  const key = resolveDemoBrandKey(brandKey) || brandKey;
  const brand = CANONICAL_DEMO_BRANDS.find((b) => b.slug === key || b.id === key);
  const name = brand?.name || 'Brand';
  const short = name.split(' ')[0] || name;
  return [
    {
      id: `demo-pb-${key}-1`,
      title: `${short} high-ticket opener`,
      updatedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
      stepCount: 4,
      objectionCount: 12,
      stepTitles: ['Open', 'Qualify', 'Pitch', 'Close'],
      campaignCount: 1,
      hasTrainingMedia: true,
    },
    {
      id: `demo-pb-${key}-2`,
      title: `${short} gatekeeper transfer`,
      updatedAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
      stepCount: 3,
      objectionCount: 8,
      stepTitles: ['Open', 'Ally', 'Transfer'],
      campaignCount: 1,
      hasTrainingMedia: false,
    },
  ];
}

export default function BrandPlaybooksPage() {
  const params = useParams();
  const brandKey = String(params.id || '');
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';

  const [brandName, setBrandName] = useState(brandKey);
  const [brandId, setBrandId] = useState(brandKey);
  const [brandPlaybooks, setBrandPlaybooks] = useState<PlaybookRow[]>([]);
  const [accountPlaybooks, setAccountPlaybooks] = useState<PlaybookRow[]>([]);
  const [loading, setLoading] = useState(!isDemo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSource, setCreateSource] = useState<'template' | 'clone'>('template');
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('foundation');
  const [cloneFromId, setCloneFromId] = useState('');
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignPlaybookId, setCampaignPlaybookId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!brandKey) return;
    if (isDemo) {
      const demo = CANONICAL_DEMO_BRANDS.find(
        (b) => b.slug === brandKey || b.id === brandKey
      );
      setBrandName(demo?.name || brandKey);
      setBrandId(demo?.id || brandKey);
      setBrandPlaybooks(demoPlaybooksForBrand(brandKey));
      setAccountPlaybooks(
        DEFAULT_PLAYBOOKS.map((p) => ({
          id: `demo-acct-${p.key}`,
          title: p.title,
          stepCount: p.steps.length,
          objectionCount: p.steps.reduce((n, s) => n + s.objections.length, 0),
          stepTitles: p.steps.map((s) => s.title),
        }))
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [brandRes, accountRes] = await Promise.all([
        fetch(`/api/brands/${encodeURIComponent(brandKey)}/playbooks`),
        fetch('/api/playbooks?scope=personal'),
      ]);
      const brandData = await brandRes.json().catch(() => ({}));
      const accountData = await accountRes.json().catch(() => ({}));
      if (brandRes.ok) {
        setBrandPlaybooks(brandData.playbooks || []);
        if (brandData.brand?.name) setBrandName(brandData.brand.name);
        if (brandData.brand?.id) setBrandId(brandData.brand.id);
      }
      if (accountRes.ok) {
        const brandIds = new Set(
          (brandData.playbooks || []).map((p: PlaybookRow) => p.id)
        );
        setAccountPlaybooks(
          (accountData.playbooks || []).filter(
            (p: PlaybookRow) => !p.brandId && !brandIds.has(p.id)
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }, [brandKey, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClone = useMemo(
    () => accountPlaybooks.find((p) => p.id === cloneFromId) || null,
    [accountPlaybooks, cloneFromId]
  );

  useEffect(() => {
    if (createSource === 'clone' && !cloneFromId && accountPlaybooks[0]) {
      setCloneFromId(accountPlaybooks[0].id);
    }
  }, [createSource, cloneFromId, accountPlaybooks]);

  async function submitCreate() {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const body =
        createSource === 'clone' && cloneFromId
          ? {
              cloneFromId,
              title:
                title.trim() ||
                (selectedClone ? `${selectedClone.title} · ${brandName}` : undefined),
            }
          : {
              title:
                title.trim() ||
                DEFAULT_PLAYBOOKS.find((p) => p.key === template)?.title,
              template,
            };

      const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/playbooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not create playbook');
        return;
      }
      setCreateOpen(false);
      setTitle('');
      window.location.href = brandHref(brandKey, 'playbooks', data.playbook.id);
    } finally {
      setBusy(false);
    }
  }

  async function clonePlaybook(source: PlaybookRow) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/playbooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloneFromId: source.id,
          title: `${source.title} (copy)`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Could not clone playbook');
        return;
      }
      await load();
      setMsg(`Cloned “${source.title}”.`);
    } finally {
      setBusy(false);
    }
  }

  function openCampaignFrom(playbookId: string) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setCampaignPlaybookId(playbookId);
    setCampaignOpen(true);
  }

  return (
    <main className="app-page app-page--desk pb-page">
      <div className="pb-toolbar">
        <div>
          <h1 className="pb-toolbar__title">Playbooks</h1>
          <p className="pb-toolbar__hint">
            Talk tracks for {brandName}. Attach one to every campaign.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setCreateSource('template');
            setCreateOpen(true);
          }}
        >
          New playbook
        </button>
      </div>

      {msg ? (
        <p className={msg.startsWith('Cloned') ? 'msg-ok' : 'msg-err'} role="status">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : brandPlaybooks.length === 0 ? (
        <EmptyState
          title="No playbooks yet"
          description="Create from a starter template or clone one from your account library."
          action={
            <button
              type="button"
              className="btn"
              style={{ marginTop: '1rem' }}
              onClick={() => setCreateOpen(true)}
            >
              New playbook
            </button>
          }
        />
      ) : (
        <div className="pb-grid">
          {brandPlaybooks.map((p) => {
            const steps = p.stepTitles?.length
              ? p.stepTitles
              : Array.from({ length: p.stepCount || 0 }, (_, i) => `Step ${i + 1}`);
            return (
              <article key={p.id} className="pb-card">
                <header className="pb-card__head">
                  <h2 className="pb-card__title">{p.title}</h2>
                  {p.updatedAt ? (
                    <span className="pb-card__when">
                      Updated{' '}
                      {new Date(p.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  ) : null}
                </header>

                <div className="pb-card__stats">
                  <div>
                    <span className="pb-card__stat-label">Steps</span>
                    <strong>{p.stepCount ?? steps.length}</strong>
                  </div>
                  <div>
                    <span className="pb-card__stat-label">Objections</span>
                    <strong>{p.objectionCount ?? 0}</strong>
                  </div>
                  <div>
                    <span className="pb-card__stat-label">Campaigns</span>
                    <strong>{p.campaignCount ?? 0}</strong>
                  </div>
                </div>

                {steps.length > 0 ? (
                  <ol className="pb-card__steps">
                    {steps.slice(0, 4).map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ol>
                ) : null}

                <div className="pb-card__flags">
                  {p.hasTrainingMedia ? (
                    <span className="pb-card__flag">Training media</span>
                  ) : null}
                  {p.productUrl ? (
                    <span className="pb-card__flag">Product link</span>
                  ) : null}
                </div>

                <footer className="pb-card__actions">
                  <Link
                    href={brandHref(brandKey, 'playbooks', p.id)}
                    className="btn-ghost pb-card__btn"
                  >
                    View
                  </Link>
                  <Link
                    href={brandHref(brandKey, 'playbooks', p.id)}
                    className="btn-ghost pb-card__btn"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost pb-card__btn"
                    disabled={busy || isDemo}
                    onClick={() => void clonePlaybook(p)}
                  >
                    Clone
                  </button>
                  <button
                    type="button"
                    className="btn pb-card__btn"
                    disabled={busy || isDemo}
                    onClick={() => openCampaignFrom(p.id)}
                  >
                    Campaign
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New playbook"
        description="Start from a template or clone an account playbook into this brand."
        wide
      >
        <div className="stack" style={{ gap: '0.85rem' }}>
          <div className="pb-create-source">
            <button
              type="button"
              className={
                createSource === 'template'
                  ? 'pb-create-source__btn is-on'
                  : 'pb-create-source__btn'
              }
              onClick={() => setCreateSource('template')}
            >
              Starter template
            </button>
            <button
              type="button"
              className={
                createSource === 'clone'
                  ? 'pb-create-source__btn is-on'
                  : 'pb-create-source__btn'
              }
              onClick={() => setCreateSource('clone')}
            >
              Clone from account
            </button>
          </div>

          {createSource === 'template' ? (
            <label className="muted" style={{ fontSize: '0.85rem' }}>
              Template
              <select
                className="field"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {DEFAULT_PLAYBOOKS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.title}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ display: 'block', marginTop: 6, fontSize: '0.8rem' }}>
                {DEFAULT_PLAYBOOKS.find((p) => p.key === template)?.description}
              </span>
            </label>
          ) : accountPlaybooks.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No personal playbooks yet to clone from. Use a starter template instead.
            </p>
          ) : (
            <label className="muted" style={{ fontSize: '0.85rem' }}>
              Account playbook
              <select
                className="field"
                value={cloneFromId}
                onChange={(e) => setCloneFromId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {accountPlaybooks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.stepCount != null ? ` · ${p.stepCount} steps` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="muted" style={{ fontSize: '0.85rem' }}>
            Title
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                createSource === 'clone' && selectedClone
                  ? `${selectedClone.title} · ${brandName}`
                  : 'e.g. Enterprise opener'
              }
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={
                busy ||
                isDemo ||
                (createSource === 'clone' && (!cloneFromId || accountPlaybooks.length === 0))
              }
              onClick={() => void submitCreate()}
            >
              {busy ? 'Creating…' : createSource === 'clone' ? 'Clone to brand' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {!isDemo ? (
        <CreateCampaignModal
          open={campaignOpen}
          onClose={() => {
            setCampaignOpen(false);
            setCampaignPlaybookId(null);
          }}
          brandId={brandId}
          brandName={brandName}
          playbooks={brandPlaybooks.map((p) => ({ id: p.id, title: p.title }))}
          initialPlaybookId={campaignPlaybookId || undefined}
          onCreated={(id) => {
            window.location.href = brandHref(brandKey, 'campaigns', id);
          }}
        />
      ) : null}
    </main>
  );
}
