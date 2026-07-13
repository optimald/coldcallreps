'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';

export type TrainingLeadView = {
  id: string;
  companyName: string;
  phone?: string | null;
  ownerName?: string | null;
  ownerTitle?: string | null;
  city?: string | null;
  industry?: string | null;
  brandId?: string | null;
  brand?: { id: string; name: string; slug: string } | null;
  hooksJSON?: string | null;
};

import { parseHooks as parseHooksPayload } from '@/lib/prospect-intel';

function parseHooks(hooksJSON?: string | null): string[] {
  return parseHooksPayload(hooksJSON).slice(0, 3);
}

function trainerHref(lead: TrainingLeadView) {
  if (!lead.brandId) return '/practice';
  return `/practice?brandId=${encodeURIComponent(lead.brandId)}`;
}

/**
 * Shared training-lead list for Brands (manage) and SDRs (practice dial).
 */
export default function TrainingLeadsPanel({
  leads,
  mode,
  emptyAction,
}: {
  leads: TrainingLeadView[];
  mode: 'brand' | 'sdr';
  emptyAction?: ReactNode;
}) {
  return (
    <Panel
      title={`Practice leads (${leads.length})`}
      description={
        mode === 'brand'
          ? 'Practice contacts for your playbook — not paid campaign dials. Reps can dial these from Outbound without a brand deal.'
          : 'Practice contacts from demo brands. Dial for reps, or open Practice with the brand playbook — no brand deal acceptance required.'
      }
      actions={
        <Link href="/cold_calls" className="btn-ghost">
          {mode === 'sdr' ? 'Open dialer' : 'Preview dialer'}
        </Link>
      }
    >
      {leads.length === 0 ? (
        <EmptyState
          title="No practice leads yet"
          description="Run npm run seed:demo-brands to load platform practice contacts, or add your own on the Practice tab."
          action={emptyAction}
        />
      ) : (
        <div className="stack" style={{ gap: '0.45rem' }}>
          {leads.map((l) => {
            const hooks = parseHooks(l.hooksJSON);
            return (
              <div
                key={l.id}
                className="session-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '1 1 220px' }}>
                  <strong>{l.companyName}</strong>
                  <div className="session-row__meta">
                    {l.ownerName || '—'}
                    {l.ownerTitle ? ` · ${l.ownerTitle}` : ''}
                    {l.phone ? ` · ${l.phone}` : ' · no phone'}
                    {l.city ? ` · ${l.city}` : ''}
                    {l.brand?.name ? ` · ${l.brand.name}` : ''}
                  </div>
                  {hooks.length > 0 ? (
                    <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {hooks[0]}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Link href={trainerHref(l)} className="btn-ghost">
                    Practice
                  </Link>
                  <Link
                    href={`/cold_calls?lead=${encodeURIComponent(l.id)}&training=1`}
                    className="btn"
                  >
                    Dial
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
