'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { DEMO_KPIS } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';

type Kpis = {
  openCampaigns: number;
  pendingApplications: number;
  leads: number;
  callsToday: number;
  escrowBalanceCents: number;
  escrowLabel: string;
};

export default function BrandDeskKpis({ brandKey }: { brandKey: string }) {
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = hydrated && mode === 'demo';
  const [liveKpis, setLiveKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    if (!hydrated || mode === 'demo') return;
    let cancelled = false;
    fetch(`/api/brands/${encodeURIComponent(brandKey)}/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.kpis) setLiveKpis(d.kpis);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandKey, hydrated, mode]);

  const kpis = isDemo ? DEMO_KPIS : liveKpis;
  if (!kpis) return null;

  const items = [
    {
      href: brandHref(brandKey, 'campaigns'),
      value: String(kpis.openCampaigns),
      label: 'Open campaigns',
    },
    {
      href: brandHref(brandKey, 'sdrs', 'applications'),
      value: String(kpis.pendingApplications),
      label: 'Pending apps',
    },
    {
      href: brandHref(brandKey, 'leads'),
      value: String(kpis.leads),
      label: 'Leads',
    },
    {
      href: brandHref(brandKey, 'calls'),
      value: String(kpis.callsToday),
      label: 'Calls today',
    },
    {
      href: brandHref(brandKey, 'sdrs', 'payouts'),
      value: kpis.escrowLabel,
      label: 'Escrow',
    },
  ];

  return (
    <div className="brand-kpi" aria-label="Brand overview">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="brand-kpi__item">
          <span className="brand-kpi__value">{item.value}</span>
          <span className="brand-kpi__label">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
