'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';

type AuditRow = {
  id: string;
  action: string;
  companyName: string;
  targetId: string | null;
  createdAt: string;
  actorName: string;
  actorEmail?: string | null;
  meta?: {
    changes?: Record<string, { from: unknown; to: unknown }>;
    source?: string;
  };
};

/** Brand-wide lead change audit: who edited which lead. */
export default function BrandLeadAuditClient({
  brandKey,
  brandName,
}: {
  brandKey: string;
  brandName: string;
}) {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/brands/${encodeURIComponent(brandKey)}/lead-audit`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load audit');
        if (!cancelled) setAudits(Array.isArray(data.audits) ? data.audits : []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandKey]);

  return (
    <div className="brand-lead-audit">
      <p className="muted" style={{ marginTop: 0 }}>
        Full change history across {brandName} leads — actor, fields, and timestamps.
      </p>
      {error ? (
        <p className="cc-desk__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : audits.length === 0 ? (
        <p className="muted">No lead edits logged yet.</p>
      ) : (
        <ul className="lead-detail__audit-list">
          {audits.map((a) => {
            const changes = a.meta?.changes || {};
            const keys = Object.keys(changes);
            return (
              <li key={a.id}>
                <div className="lead-detail__audit-head">
                  <strong>
                    {a.targetId ? (
                      <Link href={brandHref(brandKey, 'leads', a.targetId)}>{a.companyName}</Link>
                    ) : (
                      a.companyName
                    )}{' '}
                    · {a.action.replace(/_/g, ' ')}
                  </strong>
                  <span className="muted">
                    {a.actorName}
                    {a.actorEmail ? ` · ${a.actorEmail}` : ''} ·{' '}
                    {new Date(a.createdAt).toLocaleString()}
                    {a.meta?.source ? ` · ${a.meta.source}` : ''}
                  </span>
                </div>
                {keys.length > 0 ? (
                  <ul className="lead-detail__audit-changes">
                    {keys.map((k) => (
                      <li key={k}>
                        <em>{k}</em>:{' '}
                        <span className="muted">
                          {changes[k]?.from == null || changes[k]?.from === ''
                            ? '—'
                            : String(changes[k]?.from)}
                        </span>
                        {' → '}
                        <span>
                          {changes[k]?.to == null || changes[k]?.to === ''
                            ? '—'
                            : String(changes[k]?.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
