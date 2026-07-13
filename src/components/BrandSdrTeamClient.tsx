'use client';

import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { getDemoTeam } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';

export type TeamMemberRow = {
  userId: string;
  name: string;
  slug: string | null;
  campaigns: { id: string; title: string; status: string }[];
  dials: number;
  lastCallAt: string | Date | null;
};

function formatLastCall(at: string | Date | null): string {
  if (!at) return 'no dials yet';
  const d = typeof at === 'string' ? new Date(at) : at;
  return `last ${d.toLocaleDateString()}`;
}

export default function BrandSdrTeamClient({
  brandKey,
  initial,
}: {
  brandKey: string;
  initial: TeamMemberRow[];
}) {
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const team: TeamMemberRow[] = isDemo ? getDemoTeam(brandKey) : initial;

  return (
    <Panel title="Active SDRs" description={`${team.length} on roster`}>
      {team.length === 0 ? (
        <EmptyState
          title="No active SDRs yet"
          description="Accept applicants from Applications, then activate them on a campaign."
        />
      ) : (
        <ul className="brand-list">
          {team.map((m) => (
            <li key={m.userId}>
              <span>
                {m.name}
                <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  {m.dials} dial{m.dials === 1 ? '' : 's'}
                  {' · '}
                  {formatLastCall(m.lastCallAt)}
                  {' · '}
                  {m.campaigns.map((c) => `${c.title} (${c.status})`).join(' · ')}
                </span>
              </span>
              <span className="brand-list__links">
                {m.slug ? (
                  <Link href={`/r/${m.slug}`} className="soft-link">
                    Profile
                  </Link>
                ) : null}
                {m.campaigns[0] ? (
                  <Link
                    href={brandHref(brandKey, 'campaigns', m.campaigns[0].id)}
                    className="soft-link"
                  >
                    Campaign →
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
