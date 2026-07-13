'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  brandPathKey,
  writeSelectedBrandKey,
  type BrandRef,
} from '@/lib/brand-context';
import { useShell } from '@/components/ShellProvider';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { getDemoCampaigns } from '@/lib/demo/brand-demo-data';
import { CANONICAL_DEMO_BRANDS } from '@/lib/demo/canonical-brands';

type CampaignOpt = { id: string; title: string; brandId?: string };

/**
 * Standard account-desk filters (Brand + optional Campaign).
 * Defaults to All brands / All campaigns unless URL params say otherwise.
 */
export default function AccountDeskFilters({
  showCampaign = true,
  campaigns: campaignsProp,
  allowAllBrands = true,
}: {
  showCampaign?: boolean;
  campaigns?: CampaignOpt[];
  allowAllBrands?: boolean;
}) {
  const shell = useShell();
  const { mode } = useBrandDeskMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brands = useMemo<BrandRef[]>(
    () =>
      mode === 'demo'
        ? CANONICAL_DEMO_BRANDS.map((b) => ({
            id: b.id,
            slug: b.slug,
            name: b.name,
            logoUrl: b.logoUrl,
          }))
        : shell?.brands || [],
    [mode, shell?.brands]
  );
  const brandParam = searchParams.get('brand') || '';
  const campaignParam = searchParams.get('campaign') || '';
  const [fetchedCampaigns, setFetchedCampaigns] = useState<CampaignOpt[]>([]);

  useEffect(() => {
    if (!showCampaign || campaignsProp) return;
    if (mode === 'demo') {
      const rows: CampaignOpt[] = [];
      for (const b of CANONICAL_DEMO_BRANDS) {
        for (const c of getDemoCampaigns(b.slug)) {
          rows.push({ id: c.id, title: c.title, brandId: b.id });
        }
      }
      setFetchedCampaigns(rows);
      return;
    }
    let cancelled = false;
    fetch('/api/campaigns?mine=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list = (d?.campaigns || []).map(
          (c: { id: string; title: string; brandId?: string; brand?: { id: string } }) => ({
            id: c.id,
            title: c.title,
            brandId: c.brandId || c.brand?.id,
          })
        );
        setFetchedCampaigns(list);
      })
      .catch(() => {
        if (!cancelled) setFetchedCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showCampaign, campaignsProp, mode]);

  const campaigns = campaignsProp || fetchedCampaigns;

  const resolvedKey = useMemo(() => {
    if (brandParam) return brandParam;
    if (!allowAllBrands && shell?.selectedBrand) {
      return brandPathKey(shell.selectedBrand);
    }
    if (!allowAllBrands && brands[0]) return brandPathKey(brands[0]);
    return '';
  }, [brandParam, allowAllBrands, shell?.selectedBrand, brands]);

  const selectedBrand =
    brands.find((b) => brandPathKey(b) === resolvedKey || b.id === resolvedKey) ||
    null;

  const campaignOptions = useMemo(() => {
    if (!showCampaign) return [];
    if (!selectedBrand) return campaigns;
    return campaigns.filter(
      (c) =>
        !c.brandId ||
        c.brandId === selectedBrand.id ||
        c.brandId === brandPathKey(selectedBrand)
    );
  }, [campaigns, showCampaign, selectedBrand]);

  function setQuery(next: { brand?: string | null; campaign?: string | null }) {
    const q = new URLSearchParams(searchParams.toString());
    if (next.brand !== undefined) {
      if (next.brand) q.set('brand', next.brand);
      else q.delete('brand');
    }
    if (next.campaign !== undefined) {
      if (next.campaign) q.set('campaign', next.campaign);
      else q.delete('campaign');
    }
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  if (brands.length === 0 && mode !== 'demo') {
    return (
      <p className="muted account-desk-filters__empty">
        Create a brand to filter Recruit, team, and payouts.
      </p>
    );
  }

  return (
    <div className="account-desk-filters" role="group" aria-label="Desk filters">
      <label className="account-desk-filters__field">
        <span className="account-desk-filters__label">Brand</span>
        <select
          className="field"
          aria-label="Filter by brand"
          value={resolvedKey}
          onChange={(e) => {
            const key = e.target.value;
            if (key) writeSelectedBrandKey(key);
            setQuery({ brand: key || null, campaign: null });
          }}
        >
          {allowAllBrands ? <option value="">All brands</option> : null}
          {brands.map((b) => (
            <option key={b.id} value={brandPathKey(b)}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {showCampaign ? (
        <label className="account-desk-filters__field">
          <span className="account-desk-filters__label">Campaign</span>
          <select
            className="field"
            aria-label="Filter by campaign"
            value={campaignParam}
            onChange={(e) => setQuery({ campaign: e.target.value || null })}
          >
            <option value="">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function useAccountBrandFilter(opts?: { requireBrand?: boolean }): {
  brandKey: string | null;
  brands: BrandRef[];
  campaignId: string | null;
} {
  const shell = useShell();
  const { mode } = useBrandDeskMode();
  const searchParams = useSearchParams();
  const brands = useMemo<BrandRef[]>(
    () =>
      mode === 'demo'
        ? CANONICAL_DEMO_BRANDS.map((b) => ({
            id: b.id,
            slug: b.slug,
            name: b.name,
            logoUrl: b.logoUrl,
          }))
        : shell?.brands || [],
    [mode, shell?.brands]
  );
  const brandParam = searchParams.get('brand');
  const campaignId = searchParams.get('campaign');
  if (brandParam) return { brandKey: brandParam, brands, campaignId };
  if (opts?.requireBrand) {
    const sel = shell?.selectedBrand || brands[0] || null;
    return { brandKey: sel ? brandPathKey(sel) : null, brands, campaignId };
  }
  return { brandKey: null, brands, campaignId };
}
