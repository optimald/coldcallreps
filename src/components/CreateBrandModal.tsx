'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

export default function CreateBrandModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with brand slug or id after create. */
  onCreated?: (key: string) => void;
}) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) {
      setMsg('Add a brand name first.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          pack: {
            name: 'Default pack',
            icp: { segment: 'local SMB' },
            scripts: ['Open with a specific observation'],
            objections: ['We already have a site'],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not create brand');
        return;
      }
      const key = data.brand?.slug || data.brand?.id;
      setName('');
      onClose();
      if (key) {
        onCreated?.(key);
        window.location.href = `/brands/${key}`;
      } else {
        onCreated?.('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create brand"
      description="Spins up a default practice pack. Next you’ll tune talk tracks and post a campaign."
    >
      <div className="stack" style={{ gap: '0.75rem' }}>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
          placeholder="Brand name"
          autoFocus
        />
        {msg ? <p className="msg-err" style={{ margin: 0 }}>{msg}</p> : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creating…' : 'Create brand'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
