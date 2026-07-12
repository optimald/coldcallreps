'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Toggle from '@/components/ui/Toggle';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';

type Prospect = {
  id: string;
  companyName: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  website?: string | null;
  ownerName?: string | null;
  notes?: string | null;
  status?: string | null;
  imageUrl?: string | null;
  source?: string | null;
  hooksJSON?: string | null;
};

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'warming', label: 'Warming' },
  { value: 'dialing', label: 'Dialing' },
  { value: 'done', label: 'Done' },
];

const CSV_COLUMNS = [
  'companyName',
  'industry',
  'city',
  'state',
  'phone',
  'website',
  'ownerName',
  'status',
  'notes',
  'source',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Split one CSV line, respecting double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvEscape(value: string | null | undefined): string {
  const s = value ?? '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

const HEADER_ALIASES: Record<string, CsvColumn> = {
  companyname: 'companyName',
  company: 'companyName',
  name: 'companyName',
  industry: 'industry',
  city: 'city',
  state: 'state',
  phone: 'phone',
  phonenumber: 'phone',
  website: 'website',
  url: 'website',
  ownername: 'ownerName',
  owner: 'ownerName',
  status: 'status',
  notes: 'notes',
  note: 'notes',
  source: 'source',
};

function parseProspectCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => HEADER_ALIASES[normalizeHeader(h)]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((key, idx) => {
      if (!key) return;
      row[key] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

export default function ProspectsCrmPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Manual create
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');

  // Maps import
  const [mapsQuery, setMapsQuery] = useState('plumbers');
  const [mapsLocation, setMapsLocation] = useState('Austin, TX');
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);

  // Edit drawer fields
  const [edit, setEdit] = useState<Partial<Prospect>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const selected = prospects.find((p) => p.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await fetch(`/api/prospects?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setProspects(data.prospects || []);
    } catch (e: any) {
      setMsg(e.message || 'Could not load prospects');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setEdit({});
      return;
    }
    setEdit({
      companyName: selected.companyName,
      city: selected.city || '',
      state: selected.state || '',
      phone: selected.phone || '',
      website: selected.website || '',
      industry: selected.industry || '',
      notes: selected.notes || '',
      status: selected.status || 'new',
      imageUrl: selected.imageUrl || '',
    });
  }, [selected]);

  async function createManual(e?: FormEvent) {
    e?.preventDefault();
    if (!companyName.trim()) {
      setMsg('Add a company name');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, city, website, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setCompanyName('');
      setCity('');
      setWebsite('');
      setPhone('');
      setSelectedId(data.prospect.id);
      setMsg('Lead added.');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importMaps() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mapsQuery,
          location: mapsLocation,
          maxResults: 10,
          save: true,
          noWebsiteOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maps import failed');
      const n = data.saved?.length || 0;
      setMsg(
        n
          ? `Pulled ${n} lead${n === 1 ? '' : 's'} from Maps.`
          : 'No Maps results — try another trade/city.'
      );
      if (data.saved?.[0]?.id) setSelectedId(data.saved[0].id);
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/prospects?limit=200');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      const list: Prospect[] = data.prospects || [];
      const header = CSV_COLUMNS.join(',');
      const body = list
        .map((p) =>
          CSV_COLUMNS.map((col) => csvEscape((p[col] as string | null | undefined) ?? '')).join(',')
        )
        .join('\n');
      const csv = `${header}\n${body}\n`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Exported ${list.length} prospect${list.length === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setMsg(err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function importCsvFile(file: File) {
    setBusy(true);
    setMsg('');
    try {
      const text = await file.text();
      const parsed = parseProspectCsv(text);
      if (parsed.length === 0) {
        setMsg('CSV has no data rows — need a header plus at least one company.');
        return;
      }
      const rows = parsed.slice(0, 200).map((r) => ({
        companyName: r.companyName || '',
        industry: r.industry || '',
        city: r.city || '',
        state: r.state || '',
        phone: r.phone || '',
        website: r.website || '',
        ownerName: r.ownerName || '',
        status: r.status || '',
        notes: r.notes || '',
      }));
      const res = await fetch('/api/prospects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const errN = Array.isArray(data.errors) ? data.errors.length : 0;
      const parts = [
        `Created ${data.created || 0}`,
        `skipped ${data.skipped || 0}`,
        errN ? `${errN} error${errN === 1 ? '' : 's'}` : null,
        data.truncated ? 'capped at 200 rows' : null,
      ].filter(Boolean);
      setMsg(`Import complete — ${parts.join(', ')}.`);
      await load();
    } catch (err: any) {
      setMsg(err.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selectedId) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/prospects/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMsg('Prospect saved.');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function enrichSelected() {
    if (!selectedId) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/prospects/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: selectedId,
          url: edit.website || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrich failed');
      setMsg(
        data.hasWebsite === false
          ? 'No website — hooks set for a no-site pitch.'
          : `Scraped ${data.hooks?.length || 0} hooks.`
      );
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selectedId) return;
    if (!confirm('Delete this prospect?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/prospects/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }
      setSelectedId(null);
      setMsg('Deleted.');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (!selectedId) return;
    setBusy(true);
    setMsg('');
    try {
      const start = await fetch(`/api/prospects/${selectedId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type || 'image/jpeg' }),
      });
      const startData = await start.json();
      if (start.status === 503) {
        setMsg(startData.error || 'Storage unavailable — paste an image URL instead.');
        return;
      }
      if (!start.ok) throw new Error(startData.error || 'Upload start failed');

      const put = await fetch(startData.uploadUrl, {
        method: 'PUT',
        headers: startData.uploadHeaders || { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Image upload failed');

      const done = await fetch(`/api/prospects/${selectedId}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: startData.key }),
      });
      const doneData = await done.json();
      if (!done.ok) throw new Error(doneData.error || 'Could not finalize image');
      setEdit((e) => ({ ...e, imageUrl: doneData.prospect?.imageUrl || startData.publicUrl }));
      setMsg('Image attached.');
      await load();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  let hooks: string[] = [];
  try {
    hooks = selected?.hooksJSON ? JSON.parse(selected.hooksJSON) : [];
  } catch {
    hooks = [];
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Train"
        title="Prospects CRM"
        description="Pull Maps leads, import a CSV, attach a storefront photo, enrich websites — then warm up on them in the trainer before real dials."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-ghost" disabled={busy} onClick={exportCsv}>
              Export CSV
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => csvFileRef.current?.click()}
            >
              Import CSV
            </button>
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsvFile(f);
                e.target.value = '';
              }}
            />
            <Link href="/trainer" className="btn">
              Open trainer
            </Link>
          </div>
        }
      />

      {msg && (
        <p className={/fail|error|could not|unavailable/i.test(msg) ? 'msg-err' : 'msg-ok'}>
          {msg}
        </p>
      )}

      <div className="page-split">
        <div className="stack" style={{ gap: '1rem' }}>
          <Panel title="Pull from Maps" description="Search Google Maps and save leads into your CRM.">
            <div className="search-row" style={{ marginBottom: '0.65rem' }}>
              <input
                className="field"
                value={mapsQuery}
                onChange={(e) => setMapsQuery(e.target.value)}
                placeholder="Trade — e.g. plumbers"
              />
              <input
                className="field"
                value={mapsLocation}
                onChange={(e) => setMapsLocation(e.target.value)}
                placeholder="City — e.g. Austin, TX"
              />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <Toggle
                compact
                checked={noWebsiteOnly}
                onChange={setNoWebsiteOnly}
                label="Prefer no-website leads"
                description="Strong angle for $500 site pitches"
              />
            </div>
            <button type="button" className="btn" disabled={busy} onClick={importMaps}>
              {busy ? 'Pulling…' : 'Pull from Maps'}
            </button>
          </Panel>

          <Panel title="Add manually">
            <form onSubmit={createManual}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="co">
                  Company
                </label>
                <input
                  id="co"
                  className="field"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Plumbing"
                  required
                />
              </div>
              <div className="search-row" style={{ marginBottom: '0.65rem' }}>
                <input
                  className="field"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <input
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="web">
                  Website
                </label>
                <input
                  id="web"
                  className="field"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <button type="submit" className="btn" disabled={busy}>
                Add lead
              </button>
            </form>
          </Panel>

          <Panel
            title={`Leads (${prospects.length})`}
            description="Select a row to edit, attach an image, or practice."
            actions={
              <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
                Refresh
              </button>
            }
          >
            <div className="search-row" style={{ marginBottom: '0.75rem' }}>
              <input
                className="field"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search company, city, phone…"
              />
              <select
                className="field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: 'auto', minWidth: 140 }}
              >
                {STATUSES.map((s) => (
                  <option key={s.value || 'all'} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="muted">Loading…</p>
            ) : prospects.length === 0 ? (
              <EmptyState
                title="No prospects yet"
                description="Pull from Maps, import a CSV, or add a company manually."
              />
            ) : (
              <div className="stack">
                {prospects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="session-row"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: selectedId === p.id ? 'var(--accent)' : undefined,
                      background: selectedId === p.id ? 'var(--accent-soft)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            background: 'var(--bg-soft)',
                            border: '1px solid var(--line)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650 }}>{p.companyName}</div>
                        <div className="session-row__meta">
                          {[p.city, p.state].filter(Boolean).join(', ') || 'No city'}
                          {p.source ? ` · ${p.source}` : ''}
                          {p.status ? ` · ${p.status}` : ''}
                          {!p.website ? ' · no site' : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div>
          {!selected ? (
            <Panel>
              <EmptyState
                title="Select a lead"
                description="Edit details, attach a photo, scrape the site, or warm up in the trainer."
              />
            </Panel>
          ) : (
            <Panel
              title="Lead detail"
              description="Saved to your CRM — pick this prospect on the trainer for personalized warm-ups."
              actions={
                <Link href={`/trainer?prospectId=${selected.id}`} className="btn">
                  Practice
                </Link>
              }
            >
              <div className="form-field">
                <label className="form-field__label">Company</label>
                <input
                  className="field"
                  value={edit.companyName || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, companyName: e.target.value }))}
                />
              </div>
              <div className="search-row" style={{ marginBottom: '0.65rem' }}>
                <input
                  className="field"
                  value={edit.city || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, city: e.target.value }))}
                  placeholder="City"
                />
                <input
                  className="field"
                  value={edit.state || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, state: e.target.value }))}
                  placeholder="State"
                />
              </div>
              <div className="form-field">
                <label className="form-field__label">Phone</label>
                <input
                  className="field"
                  value={edit.phone || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-field__label">Website</label>
                <input
                  className="field"
                  value={edit.website || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, website: e.target.value }))}
                  placeholder="https://"
                />
              </div>
              <div className="form-field">
                <label className="form-field__label">Status</label>
                <select
                  className="field"
                  value={edit.status || 'new'}
                  onChange={(e) => setEdit((x) => ({ ...x, status: e.target.value }))}
                >
                  {STATUSES.filter((s) => s.value).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-field__label">Notes</label>
                <textarea
                  className="field"
                  rows={3}
                  value={edit.notes || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, notes: e.target.value }))}
                  placeholder="Gatekeeper name, best time, angle…"
                />
              </div>

              <div className="form-field">
                <label className="form-field__label">Image</label>
                {(edit.imageUrl || selected.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={edit.imageUrl || selected.imageUrl || ''}
                    alt=""
                    style={{
                      width: '100%',
                      maxHeight: 160,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      marginBottom: '0.5rem',
                    }}
                  />
                )}
                <input
                  className="field"
                  value={edit.imageUrl || ''}
                  onChange={(e) => setEdit((x) => ({ ...x, imageUrl: e.target.value }))}
                  placeholder="Paste image URL, or upload below"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: '0.45rem' }}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Upload image
                </button>
              </div>

              {hooks.length > 0 && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <p className="form-field__label">Talk hooks</p>
                  <ul className="list-quiet" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {hooks.slice(0, 6).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn" disabled={busy} onClick={saveSelected}>
                  Save
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={enrichSelected}>
                  Scrape website
                </button>
                <SoftLink href={`/trainer?prospectId=${selected.id}`}>Warm up →</SoftLink>
                <button type="button" className="btn-ghost" disabled={busy} onClick={removeSelected}>
                  Delete
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}
