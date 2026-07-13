'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AccountDeskFilters, {
  useAccountBrandFilter,
} from '@/components/AccountDeskFilters';
import BrandSdrPayoutsClient from '@/components/BrandSdrPayoutsClient';
import { brandPathKey } from '@/lib/brand-context';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { getDemoKpis, getDemoPayouts } from '@/lib/demo/brand-demo-data';
import { PageHeader } from '@/components/ui/PagePrimitives';

type PayoutRow = {
  id: string;
  status: string;
  grossCents: number;
  campaignId: string;
  campaignTitle: string;
  sdrName: string;
  sdrId?: string | null;
  createdAt: string;
};

type PayoutBucket = {
  brandKey: string;
  brandName: string;
  brandId: string;
  escrowLabel: string;
  payouts: PayoutRow[];
};

function PayoutsBody() {
  const { brandKey, brands, campaignId } = useAccountBrandFilter({
    requireBrand: false,
  });
  const { mode } = useBrandDeskMode();
  const isDemo = mode === 'demo';
  const [buckets, setBuckets] = useState<PayoutBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const brandsKey = useMemo(
    () => brands.map((b) => brandPathKey(b)).join('|'),
    [brands]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      if (isDemo) {
        const keys = brandKey
          ? brands.filter((b) => brandPathKey(b) === brandKey || b.id === brandKey)
          : brands;
        const list = (keys.length ? keys : brands).map((b) => {
          const key = brandPathKey(b);
          return {
            brandKey: key,
            brandName: b.name,
            brandId: b.id,
            escrowLabel: getDemoKpis(key).escrowLabel,
            payouts: getDemoPayouts(key),
          };
        });
        if (!cancelled) setBuckets(list);
        return;
      }

      const targets = brandKey
        ? brands.filter((b) => brandPathKey(b) === brandKey || b.id === brandKey)
        : brands;

      if (targets.length === 0) {
        if (!cancelled) setBuckets([]);
        return;
      }

      const results = await Promise.all(
        targets.map(async (b) => {
          const key = brandPathKey(b);
          try {
            const res = await fetch(`/api/brands/${encodeURIComponent(key)}/sdrs/payouts`);
            const d = res.ok ? await res.json() : null;
            return {
              brandKey: key,
              brandName: b.name,
              brandId: d?.brandId || b.id,
              escrowLabel: d?.escrowLabel || '$0',
              payouts: (d?.payouts || []) as PayoutRow[],
            };
          } catch {
            return {
              brandKey: key,
              brandName: b.name,
              brandId: b.id,
              escrowLabel: '$0',
              payouts: [] as PayoutRow[],
            };
          }
        })
      );
      if (!cancelled) setBuckets(results);
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
    () =>
      buckets.map((b) => ({
        ...b,
        payouts: campaignId
          ? b.payouts.filter((p) => p.campaignId === campaignId)
          : b.payouts,
      })),
    [buckets, campaignId]
  );

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="SDR payouts"
        description="Verified payouts across brands — filter by brand or campaign."
        actions={
          <Link href="/recruit" className="btn-ghost">
            Recruit →
          </Link>
        }
      />
      <AccountDeskFilters showCampaign allowAllBrands />
      {loading ? (
        <p className="muted">Loading payouts…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No brands yet — create a brand to track payouts.</p>
      ) : brandKey && visible[0] ? (
        <BrandSdrPayoutsClient
          brandKey={visible[0].brandKey}
          brandId={visible[0].brandId}
          initial={visible[0].payouts}
          escrowLabel={visible[0].escrowLabel}
        />
      ) : (
        <div className="stack" style={{ gap: '1.5rem' }}>
          {visible.map((b) => (
            <section key={b.brandKey} className="account-desk-brand-block">
              <h2 className="account-desk-brand-block__title">{b.brandName}</h2>
              <BrandSdrPayoutsClient
                brandKey={b.brandKey}
                brandId={b.brandId}
                initial={b.payouts}
                escrowLabel={b.escrowLabel}
              />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

export default function SdrsPayoutsPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <PayoutsBody />
    </Suspense>
  );
}
