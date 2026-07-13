'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AccountDeskFilters, {
  useAccountBrandFilter,
} from '@/components/AccountDeskFilters';
import BrandSdrTeamClient, {
  type TeamMemberRow,
} from '@/components/BrandSdrTeamClient';
import { brandPathKey } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { enrichDemoTeamMetrics } from '@/lib/demo/brand-demo-data';
import { PageHeader } from '@/components/ui/PagePrimitives';

function filterByCampaign(team: TeamMemberRow[], campaignId: string | null) {
  if (!campaignId) return team;
  return team.filter((m) => m.campaigns.some((c) => c.id === campaignId));
}

/** One profile per SDR — merge multi-brand / multi-campaign memberships. */
function mergeTeamByUser(rows: TeamMemberRow[]): TeamMemberRow[] {
  const byUser = new Map<string, TeamMemberRow>();

  for (const row of rows) {
    const brandEntry =
      row.brandKey || row.brandName
        ? [{ brandKey: row.brandKey || '', brandName: row.brandName || row.brandKey || '' }]
        : [];
    const campaigns = row.campaigns.map((c) => ({
      ...c,
      brandKey: c.brandKey || row.brandKey,
      brandName: c.brandName || row.brandName,
    }));

    const existing = byUser.get(row.userId);
    if (!existing) {
      byUser.set(row.userId, {
        ...row,
        brands: brandEntry.filter((b) => b.brandKey),
        campaigns,
      });
      continue;
    }

    const brandKeys = new Set(existing.brands?.map((b) => b.brandKey) || []);
    const brands = [...(existing.brands || [])];
    for (const b of brandEntry) {
      if (b.brandKey && !brandKeys.has(b.brandKey)) {
        brandKeys.add(b.brandKey);
        brands.push(b);
      }
    }

    const campIds = new Set(existing.campaigns.map((c) => c.id));
    const mergedCampaigns = [...existing.campaigns];
    for (const c of campaigns) {
      if (!campIds.has(c.id)) {
        campIds.add(c.id);
        mergedCampaigns.push(c);
      }
    }

    const existingLast = existing.lastCallAt
      ? new Date(existing.lastCallAt).getTime()
      : 0;
    const rowLast = row.lastCallAt ? new Date(row.lastCallAt).getTime() : 0;

    byUser.set(row.userId, {
      ...existing,
      name: existing.name || row.name,
      slug: existing.slug || row.slug,
      avatarUrl: existing.avatarUrl || row.avatarUrl,
      brands,
      campaigns: mergedCampaigns,
      dials: existing.dials + row.dials,
      verifiedGoals: (existing.verifiedGoals || 0) + (row.verifiedGoals || 0),
      lastCallAt:
        rowLast > existingLast ? row.lastCallAt : existing.lastCallAt,
      brandKey: existing.brandKey || row.brandKey,
      brandName: brands.map((b) => b.brandName).filter(Boolean).join(' · ') || existing.brandName,
    });
  }

  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function TeamBody() {
  const { brandKey, brands, campaignId } = useAccountBrandFilter({
    requireBrand: false,
  });
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const brandsKey = useMemo(
    () => brands.map((b) => brandPathKey(b)).join('|'),
    [brands]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const targets = brandKey
        ? brands.filter((b) => brandPathKey(b) === brandKey || b.id === brandKey)
        : brands;

      if (targets.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }

      if (isDemo) {
        const list = targets.flatMap((b) => {
          const key = brandPathKey(b);
          return enrichDemoTeamMetrics(key, b.name);
        });
        if (!cancelled) setRows(mergeTeamByUser(list));
        return;
      }

      const results = await Promise.all(
        targets.map(async (b) => {
          const key = brandPathKey(b);
          try {
            const res = await fetch(`/api/brands/${encodeURIComponent(key)}/sdrs/team`);
            const d = res.ok ? await res.json() : null;
            return ((d?.team || []) as TeamMemberRow[]).map((m) => ({
              ...m,
              brandKey: key,
              brandName: b.name,
            }));
          } catch {
            return [] as TeamMemberRow[];
          }
        })
      );
      if (!cancelled) setRows(mergeTeamByUser(results.flat()));
    }

    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // brandsKey is a stable fingerprint of brands; avoid depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandKey, brandsKey, isDemo]);

  const visible = useMemo(
    () => filterByCampaign(rows, campaignId),
    [rows, campaignId]
  );

  const multiBrand = !brandKey && brands.length > 1;

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="SDR team"
        description="Accepted and active SDRs — one profile per rep, across brands and campaigns."
        actions={
          <Link href="/recruit" className="btn-ghost">
            Recruit →
          </Link>
        }
      />
      <AccountDeskFilters showCampaign allowAllBrands />
      {loading ? (
        <p className="muted">Loading team…</p>
      ) : brands.length === 0 ? (
        <p className="muted">No brands yet — create a brand to build a roster.</p>
      ) : (
        <BrandSdrTeamClient
          brandKey={brandKey || brandPathKey(brands[0]) || brands[0].id}
          initial={visible}
          showBrandColumn={multiBrand}
        />
      )}
    </main>
  );
}

export default function SdrsTeamPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <TeamBody />
    </Suspense>
  );
}
