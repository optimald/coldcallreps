'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import BrandPhonePoolPanel from '@/components/BrandPhonePoolPanel';
import { EmptyState } from '@/components/ui/PagePrimitives';
import { brandHref } from '@/lib/brand-context';

export default function BrandDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [brand, setBrand] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [packName, setPackName] = useState('Default pack');
  const [scripts, setScripts] = useState('');
  const [objections, setObjections] = useState('');
  const [bountyTitle, setBountyTitle] = useState('');
  const [bountyMin, setBountyMin] = useState('80');
  const [boardTitle, setBoardTitle] = useState('');
  const [playbookTitle, setPlaybookTitle] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/brands/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setBrand(null);
        return;
      }
      const d = await res.json();
      if (!d.brand) {
        setNotFound(true);
        setBrand(null);
        return;
      }
      setBrand(d.brand);
      setEditName(d.brand.name || '');
      setEditDesc(d.brand.description || '');
      setEditLogo(d.brand.logoUrl || '');
    } catch {
      setNotFound(true);
      setBrand(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function saveSettings() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          logoUrl: editLogo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not save');
        return;
      }
      setMsg('Brand updated.');
      setShowSettings(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function createPack() {
    const res = await fetch(`/api/brands/${id}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: packName,
        scripts: scripts
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        objections: objections
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        icp: { note: 'Configured in brand desk' },
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Pack created.' : data.error);
    if (res.ok) load();
  }

  async function createBounty() {
    const res = await fetch(`/api/brands/${id}/bounties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: bountyTitle,
        minScore: Number(bountyMin) || 80,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Bounty created.' : data.error);
    if (res.ok) {
      setBountyTitle('');
      load();
    }
  }

  async function createBoard() {
    const res = await fetch(`/api/brands/${id}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: boardTitle }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Board created.' : data.error);
    if (res.ok) {
      setBoardTitle('');
      load();
    }
  }

  async function createPlaybook() {
    const res = await fetch(`/api/brands/${id}/playbooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: playbookTitle.trim() || undefined,
        template: 'foundation',
      }),
    });
    const data = await res.json();
    if (res.ok && data.playbook?.id) {
      setPlaybookTitle('');
      window.location.href = brandHref(id, 'playbooks', data.playbook.id);
      return;
    }
    setMsg(data.error || 'Could not create playbook');
  }

  if (loading) {
    return (
      <main className="app-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (notFound || !brand) {
    return (
      <main className="app-page">
        <h1 className="page-title">Brand not found</h1>
        <p className="page-desc">This brand may have been removed or the link is wrong.</p>
        <Link href="/brands" className="soft-link">
          ← Back to brands
        </Link>
      </main>
    );
  }

  const packs = brand.packs || [];
  const playbooks = brand.playbooks || [];
  const bounties = brand.bounties || [];
  const boards = brand.sponsoredBoards || [];
  const certs = brand.certifications || [];
  const campaignCount = brand._count?.campaigns ?? 0;
  const primaryPack = packs[0];
  const primaryPlaybook = playbooks[0];
  const practiceQs = new URLSearchParams({ brandId: brand.id });
  if (primaryPack) practiceQs.set('packId', primaryPack.id);
  if (primaryPlaybook) practiceQs.set('playbookId', primaryPlaybook.id);
  const practiceHref = `/practice?${practiceQs.toString()}`;
  const canEdit = Boolean(brand.canEdit);

  return (
    <main className="app-page brand-desk">
      <header className="brand-desk__hero">
        <div className="brand-desk__hero-glow" aria-hidden />
        <div className="brand-desk__hero-row">
          <BrandLogo
            name={brand.name}
            slug={brand.slug}
            logoUrl={brand.logoUrl}
            size="hero"
            className="brand-desk__mark"
          />
          <div className="brand-desk__identity">
            <p className="brand-desk__eyebrow">Brand settings</p>
            <h1 className="brand-desk__name">{brand.name}</h1>
            <p className="brand-desk__desc">
              {brand.description ||
                'Pack → practice → bounty → certify. Get reps fluent on your offer.'}
            </p>
            <p className="brand-desk__meta">
              <span>{packs.length} pack{packs.length === 1 ? '' : 's'}</span>
              <span aria-hidden>·</span>
              <span>{playbooks.length} playbook{playbooks.length === 1 ? '' : 's'}</span>
              <span aria-hidden>·</span>
              <span>{bounties.length} bounty{bounties.length === 1 ? '' : 's'}</span>
              <span aria-hidden>·</span>
              <span>{campaignCount} campaign{campaignCount === 1 ? '' : 's'}</span>
            </p>
            <div className="brand-desk__actions">
              <Link href={`/brands/${brand.slug || brand.id}`} className="btn">
                Brand dashboard →
              </Link>
              <Link href={practiceHref} className="btn-ghost">
                Practice
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowSettings((v) => !v)}
                >
                  {showSettings ? 'Close editor' : 'Edit brand'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {msg ? <p className={msg.includes('Could') || msg.includes('fail') ? 'msg-err' : 'msg-ok'}>{msg}</p> : null}

      {showSettings && canEdit ? (
        <section className="brand-section brand-section--settings" aria-labelledby="brand-settings">
          <h2 id="brand-settings" className="brand-section__title">
            Brand settings
          </h2>
          <p className="brand-section__lead">
            Logo URL (https or site path like <code>/brands/your-logo.svg</code>) and public description.
          </p>
          <div className="brand-settings-grid">
            <label className="brand-field">
              <span>Name</span>
              <input
                className="field"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className="brand-field">
              <span>Logo URL</span>
              <input
                className="field"
                value={editLogo}
                onChange={(e) => setEditLogo(e.target.value)}
                placeholder="https://… or /brands/your-logo.svg"
              />
            </label>
            <label className="brand-field brand-field--full">
              <span>Description</span>
              <textarea
                className="field"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder="What reps should know about this brand"
              />
            </label>
          </div>
          <div className="brand-desk__actions" style={{ marginTop: '0.85rem' }}>
            <button type="button" className="btn" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      ) : null}

      {canEdit ? <BrandPhonePoolPanel brandId={brand.id} /> : null}

      <section className="brand-section" aria-labelledby="brand-practice">
        <div className="brand-section__head">
          <div>
            <p className="brand-section__kicker">Practice materials</p>
            <h2 id="brand-practice" className="brand-section__title">
              Packs & playbooks
            </h2>
            <p className="brand-section__lead">
              Talk tracks inject into the Practice playbook and live coach. Reps should review before dialing.
            </p>
          </div>
        </div>

        <div className="brand-split">
          <div className="brand-unit">
            <h3 className="brand-unit__title">Packs</h3>
            {packs.length === 0 ? (
              <p className="muted brand-unit__empty">No packs yet — add talk tracks below.</p>
            ) : (
              <ul className="brand-list">
                {packs.map((p: any) => {
                  const qs = new URLSearchParams({ brandId: brand.id, packId: p.id });
                  if (primaryPlaybook) qs.set('playbookId', primaryPlaybook.id);
                  return (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <Link href={`/practice?${qs.toString()}`}>Practice →</Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="stack brand-unit__form">
              <input
                className="field"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Pack name"
              />
              <textarea
                className="field"
                value={scripts}
                onChange={(e) => setScripts(e.target.value)}
                rows={3}
                placeholder="Talk tracks (one per line)"
              />
              <textarea
                className="field"
                value={objections}
                onChange={(e) => setObjections(e.target.value)}
                rows={3}
                placeholder="Objections (one per line)"
              />
              <button type="button" className="btn" onClick={createPack} style={{ alignSelf: 'flex-start' }}>
                {packs.length ? 'Add another pack' : 'Create pack'}
              </button>
            </div>
          </div>

          <div className="brand-unit">
            <h3 className="brand-unit__title">Playbooks</h3>
            {playbooks.length === 0 ? (
              <p className="muted brand-unit__empty">No playbooks yet — open → qualify → pitch → close.</p>
            ) : (
              <ul className="brand-list">
                {playbooks.map((pb: any) => {
                  const qs = new URLSearchParams({ brandId: brand.id, playbookId: pb.id });
                  if (primaryPack) qs.set('packId', primaryPack.id);
                  return (
                    <li key={pb.id}>
                      <span>{pb.title}</span>
                      <span className="brand-list__links">
                        <Link href={brandHref(id, 'playbooks', pb.id)}>Edit</Link>
                        <Link href={`/practice?${qs.toString()}`}>Practice →</Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="search-row brand-unit__form" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
              <input
                className="field"
                value={playbookTitle}
                onChange={(e) => setPlaybookTitle(e.target.value)}
                placeholder="Playbook title (optional)"
              />
              <button type="button" className="btn" onClick={createPlaybook}>
                {playbooks.length ? 'Add playbook' : 'Create playbook'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-section" aria-labelledby="brand-bar">
        <p className="brand-section__kicker">Motivation</p>
        <h2 id="brand-bar" className="brand-section__title">
          Bounties & boards
        </h2>
        <p className="brand-section__lead">
          Set the score bar, then showcase who cleared it.
        </p>

        <div className="brand-split">
          <div className="brand-unit">
            <h3 className="brand-unit__title">Bounties</h3>
            {bounties.length > 0 ? (
              <ul className="brand-list">
                {bounties.map((b: any) => (
                  <li key={b.id}>
                    <span>
                      {b.title} · min {b.minScore}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted brand-unit__empty">No bounties yet.</p>
            )}
            <div className="search-row brand-unit__form" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
              <input
                className="field"
                value={bountyTitle}
                onChange={(e) => setBountyTitle(e.target.value)}
                placeholder="Bounty title"
              />
              <input
                className="field"
                value={bountyMin}
                onChange={(e) => setBountyMin(e.target.value)}
                placeholder="Min score"
                style={{ maxWidth: 120 }}
              />
              <button type="button" className="btn" onClick={createBounty}>
                Create bounty
              </button>
            </div>
          </div>

          <div className="brand-unit">
            <h3 className="brand-unit__title">Sponsored boards</h3>
            {boards.length > 0 ? (
              <ul className="brand-list">
                {boards.map((b: any) => (
                  <li key={b.id}>
                    <span>{b.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted brand-unit__empty">No boards yet.</p>
            )}
            <div className="search-row brand-unit__form" style={{ marginBottom: 0 }}>
              <input
                className="field"
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                placeholder="Board title"
              />
              <button type="button" className="btn-ghost" onClick={createBoard}>
                Create board
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-section" aria-labelledby="brand-certs">
        <p className="brand-section__kicker">Proof</p>
        <h2 id="brand-certs" className="brand-section__title">
          Certified closers
        </h2>
        <p className="brand-section__lead">Reps who scored 80+ on a brand pack session.</p>
        {certs.length === 0 ? (
          <EmptyState
            title="None yet"
            description="Send reps into Practice with your pack — certifications show up here."
            action={
              <Link href={practiceHref} className="btn-ghost">
                Open Practice →
              </Link>
            }
          />
        ) : (
          <ul className="brand-list brand-list--certs">
            {certs.map((c: any) => (
              <li key={c.id}>
                <span>{c.user?.displayName || 'Rep'}</span>
                <span className="brand-list__score">
                  {c.label} · {c.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
