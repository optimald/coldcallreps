'use client';

import { useState, type ReactNode } from 'react';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  SoftLink,
  useAdminFetch,
} from '@/components/AdminPageKit';
import { FOCUS_LABELS, type FocusArea } from '@/lib/product';

type Data = {
  packs: Array<{ id: string; name: string; active: boolean; brandName: string }>;
  playbooks: Array<{
    id: string;
    title: string;
    brandName: string | null;
    brandId?: string | null;
    brandSlug?: string | null;
  }>;
  bounties: Array<{
    id: string;
    title: string;
    active: boolean;
    rewardCents: number;
    brandName: string;
  }>;
  boards: Array<{ id: string; title: string; active: boolean; brandName: string }>;
  scenarios: Array<{
    id: string;
    slug: string;
    title: string;
    focusArea: string;
    active: boolean;
    difficulty: string;
  }>;
  academies: Array<{
    id: string;
    name: string;
    members: number;
    curricula: number;
    orgId: string;
  }>;
};

const FOCUS_OPTIONS = Object.entries(FOCUS_LABELS) as [FocusArea, string][];
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function brandPlaybooksHref(p: Data['playbooks'][number]) {
  const key = p.brandSlug || p.brandId;
  return key ? `/brands/${key}/playbooks` : null;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'admin-cms__badge admin-cms__badge--on'
          : 'admin-cms__badge admin-cms__badge--off'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ContentToggleRow({
  title,
  meta,
  active,
  onToggle,
}: {
  title: string;
  meta: ReactNode;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="admin-cms__row">
      <div className="admin-cms__main">
        <span className="admin-cms__title">{title}</span>
        {meta ? <span className="admin-cms__meta">{meta}</span> : null}
      </div>
      <div className="admin-cms__actions">
        <StatusBadge active={active} />
        <button
          type="button"
          className="btn-ghost btn-ghost--sm"
          onClick={onToggle}
          aria-pressed={active}
        >
          {active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </li>
  );
}

export default function AdminContentPage() {
  const { data, forbidden, reload, error, isDemo, demoMsg } =
    useAdminFetch<Data>('/api/admin/content');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [focusArea, setFocusArea] = useState<FocusArea>('gatekeeper');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('medium');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function onTitleChange(next: string) {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
  }

  async function createScenario() {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    if (!title.trim() || !slug.trim()) {
      setMsg('Title and slug are required.');
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        slug: slug.trim(),
        focusArea,
        difficulty,
        description: description.trim() || undefined,
        promptText: promptText.trim() || undefined,
        active,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Scenario created.' : d.error || 'Failed');
    if (res.ok) {
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setFocusArea('gatekeeper');
      setDifficulty('medium');
      setDescription('');
      setPromptText('');
      setActive(true);
      reload();
    }
  }

  async function toggle(kind: string, id: string, currentActive: boolean) {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, active: !currentActive }),
    });
    reload();
  }

  async function toggleScenario(id: string, currentActive: boolean) {
    if (isDemo) {
      setMsg(demoMsg);
      return;
    }
    await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !currentActive }),
    });
    reload();
  }

  return (
    <AdminGate title="Content" forbidden={forbidden}>
      <AdminPageChrome
        title="Content catalog"
        description="Platform practice scenarios, brand packs/playbooks, SDR reward bounties, and org academies — each is a different content type."
      >
        <Panel
          title="New practice scenario"
          description="Add a platform AI warm-up to the trainer catalog (focus area + difficulty). This is not a brand call script."
        >
          <div className="admin-cms__form">
            <label className="field-label">
              Title
              <input
                className="field"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Tough gatekeeper"
                disabled={busy}
              />
            </label>
            <label className="field-label">
              Slug
              <input
                className="field"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="tough-gatekeeper"
                disabled={busy}
              />
            </label>
            <label className="field-label">
              Focus area
              <select
                className="field"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value as FocusArea)}
                disabled={busy}
              >
                {FOCUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Difficulty
              <select
                className="field"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as (typeof DIFFICULTIES)[number])
                }
                disabled={busy}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label admin-cms__form-span">
              Description
              <textarea
                className="field"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What reps practice in this warm-up…"
                disabled={busy}
              />
            </label>
            <label className="field-label admin-cms__form-span">
              Prompt / instructions (optional)
              <textarea
                className="field"
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Extra coach notes stored in promptJSON as { instructions }…"
                disabled={busy}
              />
            </label>
            <label className="admin-cms__check">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={busy}
              />
              Active (visible in trainer catalog)
            </label>
            <div className="admin-cms__form-actions">
              <button
                type="button"
                className="btn"
                onClick={createScenario}
                disabled={busy}
                title={isDemo ? demoMsg : 'Create practice scenario'}
              >
                Create scenario
              </button>
            </div>
          </div>
        </Panel>

        <div className="admin-split">
          <Panel
            title="Scenarios"
            description="Platform AI practice sessions — ops-owned warm-ups by focus area and difficulty, not brand scripts."
          >
            <ul className="admin-cms__list">
              {(data?.scenarios || []).map((s) => (
                <ContentToggleRow
                  key={s.id}
                  title={s.title}
                  meta={
                    <>
                      {FOCUS_LABELS[s.focusArea as FocusArea] || s.focusArea} ·{' '}
                      {s.difficulty}
                      {s.slug ? ` · ${s.slug}` : ''}
                    </>
                  }
                  active={s.active}
                  onToggle={() => toggleScenario(s.id, s.active)}
                />
              ))}
              {!data?.scenarios?.length ? (
                <li className="admin-cms__empty muted">
                  None yet — create a practice catalog entry above.
                </li>
              ) : null}
            </ul>
          </Panel>
          <Panel
            title="Product packs"
            description="Brand content packs / opener packs attached to a brand desk."
          >
            <ul className="admin-cms__list">
              {(data?.packs || []).map((p) => (
                <ContentToggleRow
                  key={p.id}
                  title={p.name}
                  meta={p.brandName}
                  active={p.active}
                  onToggle={() => toggle('pack', p.id, p.active)}
                />
              ))}
              {!data?.packs?.length ? (
                <li className="admin-cms__empty muted">No brand packs yet.</li>
              ) : null}
            </ul>
          </Panel>
        </div>

        <div className="admin-split">
          <Panel
            title="Bounties"
            description="Optional $ incentives for SDR goals (e.g. first booking bonus) — brand-scoped rewards, not practice content."
          >
            <ul className="admin-cms__list">
              {(data?.bounties || []).map((b) => (
                <ContentToggleRow
                  key={b.id}
                  title={b.title}
                  meta={
                    <>
                      ${(b.rewardCents / 100).toFixed(0)} · {b.brandName}
                    </>
                  }
                  active={b.active}
                  onToggle={() => toggle('bounty', b.id, b.active)}
                />
              ))}
              {!data?.bounties?.length ? (
                <li className="admin-cms__empty muted">
                  No bounties yet. Brands attach cash bonuses to goals (e.g. first
                  booking) from their desk — this panel only enables/disables them.
                </li>
              ) : null}
            </ul>
          </Panel>
          <Panel
            title="Playbooks"
            description="Brand-desk call scripts and guides. Edit on the brand desk — this is a read-only overview."
          >
            <ul className="admin-cms__list">
              {(data?.playbooks || []).map((p) => {
                const href = brandPlaybooksHref(p);
                return (
                  <li key={p.id} className="admin-cms__row">
                    <div className="admin-cms__main">
                      <span className="admin-cms__title">{p.title}</span>
                      <span className="admin-cms__meta">
                        {p.brandName || 'Unassigned brand'}
                      </span>
                    </div>
                    <div className="admin-cms__actions">
                      {href ? (
                        <SoftLink href={href}>Open →</SoftLink>
                      ) : (
                        <span className="muted">No brand link</span>
                      )}
                    </div>
                  </li>
                );
              })}
              {!data?.playbooks?.length ? (
                <li className="admin-cms__empty muted">Created on brand desks.</li>
              ) : null}
            </ul>
          </Panel>
        </div>

        <Panel
          title="Academies"
          description="Org training programs with members and curricula — separate from scenarios and playbooks."
        >
          <ul className="admin-cms__list">
            {(data?.academies || []).map((a) => (
              <li key={a.id} className="admin-cms__row">
                <div className="admin-cms__main">
                  <span className="admin-cms__title">{a.name}</span>
                  <span className="admin-cms__meta">
                    {a.members} members · {a.curricula} curricula · org {a.orgId}
                  </span>
                </div>
              </li>
            ))}
            {!data?.academies?.length ? (
              <li className="admin-cms__empty muted">No academies yet.</li>
            ) : null}
          </ul>
        </Panel>

        {msg || error ? (
          <p className={msg.includes('created') ? 'msg-ok' : 'msg-err'}>{msg || error}</p>
        ) : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
