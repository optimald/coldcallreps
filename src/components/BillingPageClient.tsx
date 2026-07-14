'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { brandHref } from '@/lib/brand-context';
import { EmptyState, Panel } from '@/components/ui/PagePrimitives';
import Modal from '@/components/ui/Modal';
import { useShell } from '@/components/ShellProvider';
import type { BillingInvoice, BillingPaymentMethod } from '@/lib/billing-stripe';
import {
  CANONICAL_DEMO_BRANDS,
  DEMO_MSG,
  getDemoCampaigns,
  getDemoKpis,
} from '@/lib/demo/brand-demo-data';

type LedgerEntry = {
  id: string;
  type: string;
  amountCents: number;
  balanceAfter: number;
  createdAt: string;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  description: string;
  direction: 'credit' | 'debit' | 'neutral';
};

type LedgerBrand = {
  id: string;
  slug: string;
  name: string;
  walletBalanceCents: number;
  walletBalanceLabel: string;
};

type LedgerCampaign = {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  status: string;
};

type BrandDesk = {
  id: string;
  slug: string;
  name: string;
  walletBalanceCents?: number;
  walletBalanceLabel: string;
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    budgetLabel: string;
    escrowLabel: string;
  }>;
};

type LeadCreditSnapshot = {
  plan: string;
  allotmentRemaining: number;
  packRemaining: number;
  totalRemaining: number;
  usedThisPeriod: number;
  periodLimit: number;
  packExpiresAt?: string | null;
  planPeriodEnd?: string | null;
};

type CreditLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  allotmentAfter: number;
  packAfter: number;
  note: string | null;
  createdAt: string;
};

type BrandCreditsView = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  credits: LeadCreditSnapshot | null;
  creditLedger: CreditLedgerEntry[];
  loading: boolean;
  error: string | null;
};

type BrandBillingTab = 'wallets' | 'escrow' | 'credits' | 'methods' | 'charges';

const FUND_PRESETS = [100, 250, 500, 1000, 2500];

const TAB_LABELS: { id: BrandBillingTab; label: string }[] = [
  { id: 'wallets', label: 'Wallets' },
  { id: 'escrow', label: 'Escrow ledger' },
  { id: 'credits', label: 'Lead credits' },
  { id: 'methods', label: 'Payment methods' },
  { id: 'charges', label: 'Charges' },
];

function parseBillingTab(raw: string | null): BrandBillingTab {
  if (raw === 'credits' || raw === 'escrow' || raw === 'wallets' || raw === 'methods' || raw === 'charges') {
    return raw;
  }
  // Legacy ?tab=payment
  if (raw === 'payment') return 'methods';
  return 'wallets';
}

function money(cents: number) {
  const sign = cents < 0 ? '−' : cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function cardLabel(pm: BillingPaymentMethod) {
  return `${(pm.brand || 'Card').toUpperCase()} ···· ${pm.last4 || '????'}`;
}

function campaignStatusChip(status: string) {
  const ok = status === 'OPEN' || status === 'ACTIVE';
  return `brand-campaign__badge${ok ? ' brand-campaign__badge--ok' : ' brand-campaign__badge--muted'}`;
}

function buildDemoCreditRows(brand: {
  id: string;
  slug: string;
  name: string;
}): BrandCreditsView {
  const kpis = getDemoKpis(brand.slug);
  const used = kpis.leadCreditsUsed ?? 0;
  const available = kpis.leadCreditsAvailable ?? 100;
  const remaining = Math.max(0, available - used);
  const now = Date.now();
  const ledger: CreditLedgerEntry[] = [
    {
      id: `demo-credit-grant-${brand.id}`,
      type: 'GRANT_ALLOTMENT',
      amount: available,
      allotmentAfter: available,
      packAfter: 0,
      note: 'Monthly enrichment allotment',
      createdAt: new Date(now - 28 * 86400_000).toISOString(),
    },
  ];
  if (used > 0) {
    const first = Math.max(1, Math.floor(used * 0.6));
    const second = used - first;
    ledger.push({
      id: `demo-credit-deduct-a-${brand.id}`,
      type: 'DEDUCT_SAVE',
      amount: -first,
      allotmentAfter: available - first,
      packAfter: 0,
      note: 'Enrichment on generate save',
      createdAt: new Date(now - 12 * 86400_000).toISOString(),
    });
    if (second > 0) {
      ledger.push({
        id: `demo-credit-deduct-b-${brand.id}`,
        type: 'DEDUCT_SAVE',
        amount: -second,
        allotmentAfter: remaining,
        packAfter: 0,
        note: 'Enrichment on generate save',
        createdAt: new Date(now - 5 * 86400_000).toISOString(),
      });
    }
  }
  ledger.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return {
    brandId: brand.id,
    brandSlug: brand.slug,
    brandName: brand.name,
    credits: {
      plan: 'FREE',
      allotmentRemaining: remaining,
      packRemaining: 0,
      totalRemaining: remaining,
      usedThisPeriod: used,
      periodLimit: available,
    },
    creditLedger: ledger,
    loading: false,
    error: null,
  };
}

function buildDemoBilling(selectedId?: string | null) {
  const brands: LedgerBrand[] = CANONICAL_DEMO_BRANDS.map((b) => {
    const kpis = getDemoKpis(b.slug);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      walletBalanceCents: kpis.escrowBalanceCents,
      walletBalanceLabel: kpis.escrowLabel.replace(/\.00$/, ''),
    };
  });

  const campaigns: LedgerCampaign[] = [];
  const entries: LedgerEntry[] = [];
  const activePayloads: BrandDesk[] = [];

  for (const b of CANONICAL_DEMO_BRANDS) {
    const camps = getDemoCampaigns(b.slug);
    const kpis = getDemoKpis(b.slug);
    const activeCampaigns = camps.map((c) => {
      campaigns.push({
        id: c.id,
        title: c.title,
        brandId: b.id,
        brandName: b.name,
        status: c.status,
      });
      const escrowCents = (() => {
        if (!c.escrowLabel) return 0;
        const n = Number(String(c.escrowLabel).replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
      })();
      if (escrowCents > 0) {
        entries.push({
          id: `demo-ledger-fund-${c.id}`,
          type: 'FUND',
          amountCents: escrowCents,
          balanceAfter: kpis.escrowBalanceCents,
          createdAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
          brandId: b.id,
          brandName: b.name,
          brandSlug: b.slug,
          campaignId: c.id,
          campaignTitle: c.title,
          description: `Credited $${(escrowCents / 100).toLocaleString()} on ${c.title} to fund the campaign`,
          direction: 'credit',
        });
        entries.push({
          id: `demo-ledger-lock-${c.id}`,
          type: 'ESCROW_LOCK',
          amountCents: -escrowCents,
          balanceAfter: Math.max(0, kpis.escrowBalanceCents - escrowCents),
          createdAt: new Date(Date.now() - 14 * 86400_000 + 60_000).toISOString(),
          brandId: b.id,
          brandName: b.name,
          brandSlug: b.slug,
          campaignId: c.id,
          campaignTitle: c.title,
          description: `Debited $${(escrowCents / 100).toLocaleString()} — locked to ${c.title}`,
          direction: 'debit',
        });
      }
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        budgetLabel:
          c.budgetCents != null
            ? `$${(c.budgetCents / 100).toLocaleString()}`
            : c.budgetLabel || '—',
        escrowLabel: c.escrowLabel || '$0',
      };
    });

    activePayloads.push({
      id: b.id,
      slug: b.slug,
      name: b.name,
      walletBalanceLabel: kpis.escrowLabel.replace(/\.00$/, ''),
      campaigns: activeCampaigns,
    });
  }

  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  void selectedId;
  return { brands, campaigns, entries, brandDesks: activePayloads };
}

export default function BillingPageClient() {
  const shell = useShell();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = shell?.role || 'REP';
  const isBrandDesk = role === 'BRAND' || role === 'RECRUITER';
  const isDemo = shell?.deskMode === 'demo';
  const subscribeHref = isBrandDesk ? '/subscribe/brand' : '/subscribe/sdr';

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [paymentMethods, setPaymentMethods] = useState<BillingPaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [planLabel, setPlanLabel] = useState<string | null>(null);

  const [ledgerBrands, setLedgerBrands] = useState<LedgerBrand[]>([]);
  const [ledgerCampaigns, setLedgerCampaigns] = useState<LedgerCampaign[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [brandDesks, setBrandDesks] = useState<BrandDesk[]>([]);
  const [filterBrandId, setFilterBrandId] = useState(''); // '' = all brands
  const [filterCampaignId, setFilterCampaignId] = useState('');
  const [fundBrandId, setFundBrandId] = useState('');
  const [customDollars, setCustomDollars] = useState('500');
  const [fundOpen, setFundOpen] = useState(false);
  const [brandTab, setBrandTab] = useState<BrandBillingTab>(() =>
    parseBillingTab(searchParams.get('tab'))
  );
  const [creditsByBrand, setCreditsByBrand] = useState<BrandCreditsView[]>([]);
  const [creditsQuery, setCreditsQuery] = useState('');
  const [creditsBrandId, setCreditsBrandId] = useState('');
  const [creditsType, setCreditsType] = useState('');
  const [creditsSort, setCreditsSort] = useState<'newest' | 'oldest' | 'amount'>('newest');

  useEffect(() => {
    setBrandTab(parseBillingTab(searchParams.get('tab')));
  }, [searchParams]);

  function selectBrandTab(next: BrandBillingTab) {
    setBrandTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    const qs = params.toString();
    router.replace(`/billing?${qs}`, { scroll: false });
  }

  const loadAccount = useCallback(async () => {
    if (isDemo) {
      setPaymentMethods([]);
      setInvoices([]);
      setPlanLabel('Demo');
      return;
    }
    const res = await fetch('/api/billing/account');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Could not load billing');
    setPaymentMethods(json.paymentMethods || []);
    setInvoices(json.invoices || []);
    setPlanLabel(json.planLabel || json.plan || null);
  }, [isDemo]);

  const loadLedger = useCallback(async (brandId?: string, campaignId?: string) => {
    if (isDemo) {
      const demo = buildDemoBilling(brandId || undefined);
      setLedgerBrands(demo.brands);
      setLedgerCampaigns(demo.campaigns);
      setBrandDesks(demo.brandDesks);
      let ledger = demo.entries;
      if (brandId) ledger = ledger.filter((e) => e.brandId === brandId);
      if (campaignId) ledger = ledger.filter((e) => e.campaignId === campaignId);
      setEntries(ledger);
      setFundBrandId((prev) => prev || demo.brands[0]?.id || '');
      return;
    }
    const params = new URLSearchParams();
    if (brandId) params.set('brandId', brandId);
    if (campaignId) params.set('campaignId', campaignId);
    const qs = params.toString();
    const res = await fetch(`/api/billing/ledger${qs ? `?${qs}` : ''}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not load ledger');
    setLedgerBrands(json.brands || []);
    setLedgerCampaigns(json.campaigns || []);
    setEntries(json.entries || []);
    setBrandDesks(json.brandDesks || []);
    setFundBrandId((prev) => prev || json.brands?.[0]?.id || '');
  }, [isDemo]);

  const loadCredits = useCallback(async () => {
    if (isDemo) {
      const brands =
        ledgerBrands.length > 0
          ? ledgerBrands
          : CANONICAL_DEMO_BRANDS.map((b) => ({
              id: b.id,
              slug: b.slug,
              name: b.name,
              walletBalanceCents: 0,
              walletBalanceLabel: '$0',
            }));
      setCreditsByBrand(brands.map((b) => buildDemoCreditRows(b)));
      return;
    }
    const brands = ledgerBrands;
    if (brands.length === 0) {
      setCreditsByBrand([]);
      return;
    }
    setCreditsByBrand(
      brands.map((b) => ({
        brandId: b.id,
        brandSlug: b.slug,
        brandName: b.name,
        credits: null,
        creditLedger: [],
        loading: true,
        error: null,
      }))
    );
    const results = await Promise.all(
      brands.map(async (b) => {
        try {
          const res = await fetch(`/api/brands/${b.id}/billing`);
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              brandId: b.id,
              brandSlug: b.slug,
              brandName: b.name,
              credits: null,
              creditLedger: [] as CreditLedgerEntry[],
              loading: false,
              error: (json.error as string) || 'Could not load credits',
            } satisfies BrandCreditsView;
          }
          return {
            brandId: b.id,
            brandSlug: b.slug,
            brandName: b.name,
            credits: (json.credits as LeadCreditSnapshot) || null,
            creditLedger: (json.creditLedger as CreditLedgerEntry[]) || [],
            loading: false,
            error: null,
          } satisfies BrandCreditsView;
        } catch (e: unknown) {
          return {
            brandId: b.id,
            brandSlug: b.slug,
            brandName: b.name,
            credits: null,
            creditLedger: [] as CreditLedgerEntry[],
            loading: false,
            error: e instanceof Error ? e.message : 'Could not load credits',
          } satisfies BrandCreditsView;
        }
      })
    );
    setCreditsByBrand(results);
  }, [isDemo, ledgerBrands]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      await loadAccount();
      if (isBrandDesk) {
        await loadLedger(filterBrandId || undefined, filterCampaignId || undefined);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [isBrandDesk, loadAccount, loadLedger, filterBrandId, filterCampaignId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('wallet') === 'funded') {
      setMsg('Wallet funded — balance updates after Stripe confirms payment.');
    } else if (params.get('wallet') === 'cancel') {
      setErr('Checkout canceled — no charge was made.');
    }
  }, []);

  // Account-level billing: load all brands by default (not tied to sidebar brand)
  useEffect(() => {
    if (!isBrandDesk) {
      void refresh();
      return;
    }
    setLoading(true);
    void loadAccount()
      .catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => {
        /* ledger effect sets loading false */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBrandDesk, isDemo]);

  useEffect(() => {
    if (!isBrandDesk) return;
    setLoading(true);
    loadLedger(filterBrandId || undefined, filterCampaignId || undefined)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [filterBrandId, filterCampaignId, isBrandDesk, loadLedger]);

  useEffect(() => {
    if (!isBrandDesk || brandTab !== 'credits') return;
    void loadCredits();
  }, [isBrandDesk, brandTab, loadCredits]);

  const campaignOptions = useMemo(() => {
    if (!filterBrandId) return ledgerCampaigns;
    return ledgerCampaigns.filter((c) => c.brandId === filterBrandId);
  }, [ledgerCampaigns, filterBrandId]);

  const visibleDesks = brandDesks;

  const fundBrand =
    ledgerBrands.find((b) => b.id === fundBrandId) ||
    brandDesks.find((b) => b.id === fundBrandId) ||
    null;

  type FlatCreditRow = CreditLedgerEntry & {
    brandId: string;
    brandName: string;
    brandSlug: string;
  };

  const flatCreditRows = useMemo(() => {
    const rows: FlatCreditRow[] = [];
    for (const block of creditsByBrand) {
      for (const entry of block.creditLedger) {
        rows.push({
          ...entry,
          brandId: block.brandId,
          brandName: block.brandName,
          brandSlug: block.brandSlug,
        });
      }
    }
    return rows;
  }, [creditsByBrand]);

  const creditTypeOptions = useMemo(() => {
    const set = new Set(flatCreditRows.map((r) => r.type));
    return [...set].sort();
  }, [flatCreditRows]);

  const filteredCreditRows = useMemo(() => {
    const q = creditsQuery.trim().toLowerCase();
    let rows = flatCreditRows.filter((r) => {
      if (creditsBrandId && r.brandId !== creditsBrandId) return false;
      if (creditsType && r.type !== creditsType) return false;
      if (!q) return true;
      const hay = `${r.brandName} ${r.type} ${r.note || ''}`.toLowerCase();
      return hay.includes(q);
    });
    rows = [...rows].sort((a, b) => {
      if (creditsSort === 'amount') return Math.abs(b.amount) - Math.abs(a.amount);
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return creditsSort === 'oldest' ? ta - tb : tb - ta;
    });
    return rows;
  }, [
    flatCreditRows,
    creditsQuery,
    creditsBrandId,
    creditsType,
    creditsSort,
  ]);

  function openFundModal(brandId?: string) {
    if (brandId) setFundBrandId(brandId);
    else if (!fundBrandId && ledgerBrands[0]) setFundBrandId(ledgerBrands[0].id);
    setFundOpen(true);
  }

  async function openPortal() {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/billing' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Portal unavailable');
      if (json.url) window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setBusy(false);
    }
  }

  async function patchPaymentMethod(body: Record<string, string | null>) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/billing/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not update payment method');
      setMsg('Payment methods updated.');
      await loadAccount();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function fund(dollars: number) {
    if (isDemo) {
      setMsg(DEMO_MSG);
      setFundOpen(false);
      return;
    }
    if (!fundBrandId) {
      setErr('Select a brand to fund.');
      return;
    }
    const amountCents = Math.round(dollars * 100);
    if (amountCents < 5000) {
      setErr('Minimum fund is $50');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch(`/api/brands/${fundBrandId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, returnTo: 'billing' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error('No checkout URL');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setBusy(false);
    }
  }

  const primary = paymentMethods.find((pm) => pm.isDefault) || null;
  const backup = paymentMethods.find((pm) => pm.isBackup) || null;

  const methodsPanel = (
      <Panel
        title="Payment methods"
        description="Primary card is charged first. Backup is used if primary fails — add cards in Stripe portal."
        actions={
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
            Add / edit cards
          </button>
        }
      >
        {paymentMethods.length === 0 ? (
          <EmptyState
            title="No cards on file"
            description="Subscribe or fund a wallet — Stripe saves the card. Then set primary and backup here."
            action={
              <Link href={subscribeHref} className="btn" style={{ marginTop: '1rem' }}>
                View plans →
              </Link>
            }
          />
        ) : (
          <div className="stack" style={{ gap: '1rem' }}>
            <div className="billing-pm-slots">
              <div className="billing-pm-slot">
                <p className="page-eyebrow">Primary</p>
                {primary ? (
                  <p style={{ margin: '0.35rem 0 0', fontWeight: 700 }}>{cardLabel(primary)}</p>
                ) : (
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                    Not set
                  </p>
                )}
              </div>
              <div className="billing-pm-slot">
                <p className="page-eyebrow">Backup</p>
                {backup ? (
                  <p style={{ margin: '0.35rem 0 0', fontWeight: 700 }}>{cardLabel(backup)}</p>
                ) : (
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                    Add a second card, then mark backup
                  </p>
                )}
              </div>
            </div>
            <ul className="brand-list">
              {paymentMethods.map((pm) => (
                <li key={pm.id}>
                  <span>
                    {cardLabel(pm)}
                    {pm.isDefault ? (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        Primary
                      </span>
                    ) : null}
                    {pm.isBackup ? (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                        Backup
                      </span>
                    ) : null}
                  </span>
                  <span style={{ display: 'flex', gap: '0.65rem' }}>
                    {!pm.isDefault ? (
                      <button
                        type="button"
                        className="soft-link"
                        disabled={busy}
                        onClick={() => void patchPaymentMethod({ defaultPaymentMethodId: pm.id })}
                      >
                        Make primary
                      </button>
                    ) : null}
                    {!pm.isBackup && !pm.isDefault ? (
                      <button
                        type="button"
                        className="soft-link"
                        disabled={busy}
                        onClick={() => void patchPaymentMethod({ backupPaymentMethodId: pm.id })}
                      >
                        Make backup
                      </button>
                    ) : null}
                    {pm.isDefault || pm.isBackup ? <span className="muted">—</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
  );

  const chargesPanel = (
      <Panel title="Charges" description="Stripe invoices for subscriptions, packs, and wallet funds.">
        {invoices.length === 0 ? (
          <EmptyState title="No charges yet" description="Charges appear here after the first Stripe checkout." />
        ) : (
          <div className="billing-ledger-wrap">
            <table className="billing-ledger">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col">Amount</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {new Date(inv.created * 1000).toLocaleDateString()}
                    </td>
                    <td>{inv.description || inv.number || inv.id}</td>
                    <td>{inv.status}</td>
                    <td>${(inv.amountPaid / 100).toFixed(2)}</td>
                    <td>
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          className="soft-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
  );

  return (
    <main className="app-page">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="page-eyebrow">Account</p>
          <h1 className="page-title">Billing</h1>
          <p className="page-desc">
            {isDemo
              ? 'Demo · wallets, escrow, and lead credits across sample brands. Switch to Live for real Stripe billing.'
              : isBrandDesk
                ? 'Account billing across every brand — wallets, campaign escrow, lead credits, and Stripe charges.'
                : planLabel
                  ? `Plan ${planLabel} · payment methods and charge history.`
                  : 'Payment methods and charge history.'}
          </p>
        </div>
        <div className="page-header__actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href={subscribeHref} className="btn-ghost">
            Plans →
          </Link>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void openPortal()}>
            Stripe portal
          </button>
        </div>
      </header>

      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}
      {loading ? <p className="muted">Loading billing…</p> : null}

      {isBrandDesk ? (
        <>
          <div className="recruit-tabs" role="tablist" aria-label="Billing sections">
            {TAB_LABELS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={brandTab === t.id}
                className={`recruit-tabs__btn${brandTab === t.id ? ' is-active' : ''}`}
                onClick={() => selectBrandTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {brandTab === 'wallets' ? (
            <Panel
              title="Brand wallets"
              description="Prepaid wallet balance and locked campaign escrow per brand."
              actions={
                <button
                  type="button"
                  className="btn"
                  disabled={busy || ledgerBrands.length === 0}
                  onClick={() => openFundModal()}
                >
                  Fund wallet
                </button>
              }
            >
              {visibleDesks.length === 0 ? (
                <EmptyState
                  title="No brands yet"
                  description="Create a brand to open wallets and campaign escrow."
                />
              ) : (
                <div className="billing-wallet-grid">
                  {visibleDesks.map((b) => (
                    <article key={b.id} className="billing-wallet-card">
                      <div className="billing-wallet-card__head">
                        <strong className="billing-wallet-card__name">{b.name}</strong>
                        <div className="billing-wallet-card__actions">
                          <button
                            type="button"
                            className="soft-link"
                            onClick={() => openFundModal(b.id)}
                          >
                            Fund
                          </button>
                          <Link href={brandHref(b, 'campaigns')} className="soft-link">
                            Campaigns →
                          </Link>
                        </div>
                      </div>
                      <p className="billing-wallet-card__balance">{b.walletBalanceLabel}</p>
                      <p className="billing-wallet-card__campaigns">
                        {b.campaigns.length}{' '}
                        {b.campaigns.length === 1 ? 'campaign' : 'campaigns'}
                      </p>
                      {b.campaigns.length === 0 ? (
                        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                          No campaigns yet.
                        </p>
                      ) : (
                        <ul className="billing-wallet-card__list">
                          {b.campaigns.map((c) => (
                            <li key={c.id}>
                              <Link
                                href={brandHref(b, 'campaigns', c.id)}
                                className="billing-wallet-card__campaign"
                              >
                                <span className="billing-wallet-card__campaign-title">
                                  {c.title}
                                </span>
                                <span className={campaignStatusChip(c.status)}>{c.status}</span>
                                <span className="billing-wallet-card__campaign-meta muted">
                                  Budget {c.budgetLabel}
                                </span>
                                <span className="billing-wallet-card__campaign-escrow">
                                  Locked {c.escrowLabel}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {brandTab === 'escrow' ? (
            <Panel
              title="Campaign ledger"
              description="Credits (wallet funds / refunds) and debits (escrow locks / goal payouts). Filter by brand or campaign."
            >
              <div className="billing-ledger-filters">
                <label className="billing-ledger-filters__field">
                  <span>Brand</span>
                  <select
                    className="field"
                    value={filterBrandId}
                    onChange={(e) => {
                      setFilterBrandId(e.target.value);
                      setFilterCampaignId('');
                    }}
                    aria-label="Filter ledger by brand"
                  >
                    <option value="">All brands</option>
                    {ledgerBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="billing-ledger-filters__field">
                  <span>Campaign</span>
                  <select
                    className="field"
                    value={filterCampaignId}
                    onChange={(e) => setFilterCampaignId(e.target.value)}
                    aria-label="Filter ledger by campaign"
                  >
                    <option value="">All campaigns</option>
                    {campaignOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {filterBrandId ? c.title : `${c.brandName} · ${c.title}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {entries.length === 0 ? (
                <EmptyState
                  title="No ledger activity"
                  description="Fund a wallet or open a campaign to see credits and debits here."
                />
              ) : (
                <div className="billing-ledger-wrap">
                  <table className="billing-ledger">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Entry</th>
                        <th scope="col">Brand</th>
                        <th scope="col">Campaign</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((row) => (
                        <tr key={row.id}>
                          <td className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            {new Date(row.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>{row.description}</td>
                          <td>{row.brandName || <span className="muted">—</span>}</td>
                          <td>
                            {row.campaignTitle && row.brandSlug && row.campaignId ? (
                              <Link
                                href={brandHref(row.brandSlug, 'campaigns', row.campaignId)}
                                className="soft-link"
                              >
                                {row.campaignTitle}
                              </Link>
                            ) : (
                              row.campaignTitle || <span className="muted">—</span>
                            )}
                          </td>
                          <td
                            style={{
                              color:
                                row.direction === 'debit'
                                  ? 'var(--bad)'
                                  : row.direction === 'credit'
                                    ? 'var(--good)'
                                    : undefined,
                              fontWeight: 650,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {money(row.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ) : null}

          {brandTab === 'credits' ? (
            <Panel
              title="Lead credits"
              description="Enrichment allotment and pack balance. Maps generate + enhanced saves consume credits; CSV/manual imports do not."
              actions={
                <Link href="/subscribe/brand" className="soft-link">
                  Buy credits →
                </Link>
              }
            >
              {loading && creditsByBrand.length === 0 ? (
                <p className="muted">Loading lead credits…</p>
              ) : creditsByBrand.length === 0 ? (
                <EmptyState
                  title="No brands yet"
                  description="Create a brand to track lead credits."
                  action={
                    <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                      Brands →
                    </Link>
                  }
                />
              ) : (
                <>
                  {creditsByBrand.some((b) => b.credits) ? (
                    <div className="billing-credits-summary">
                      {creditsByBrand.map((row) =>
                        row.credits ? (
                          <div key={row.brandId} className="billing-credits-summary__item">
                            <strong>{row.brandName}</strong>
                            <span className="muted">
                              {row.credits.usedThisPeriod}/{row.credits.periodLimit} used ·{' '}
                              {row.credits.totalRemaining.toLocaleString()} left
                              {row.credits.packRemaining > 0
                                ? ` · ${row.credits.packRemaining} pack`
                                : ''}
                            </span>
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : null}

                  <div className="billing-ledger-filters billing-credits-filters">
                    <label className="billing-ledger-filters__field billing-credits-filters__search">
                      <span>Search</span>
                      <input
                        className="field"
                        type="search"
                        value={creditsQuery}
                        onChange={(e) => setCreditsQuery(e.target.value)}
                        placeholder="Brand, type, or note…"
                        aria-label="Search credit ledger"
                      />
                    </label>
                    <label className="billing-ledger-filters__field">
                      <span>Brand</span>
                      <select
                        className="field"
                        value={creditsBrandId}
                        onChange={(e) => setCreditsBrandId(e.target.value)}
                        aria-label="Filter credits by brand"
                      >
                        <option value="">All brands</option>
                        {creditsByBrand.map((b) => (
                          <option key={b.brandId} value={b.brandId}>
                            {b.brandName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="billing-ledger-filters__field">
                      <span>Type</span>
                      <select
                        className="field"
                        value={creditsType}
                        onChange={(e) => setCreditsType(e.target.value)}
                        aria-label="Filter credits by type"
                      >
                        <option value="">All types</option>
                        {creditTypeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="billing-ledger-filters__field">
                      <span>Sort</span>
                      <select
                        className="field"
                        value={creditsSort}
                        onChange={(e) =>
                          setCreditsSort(e.target.value as 'newest' | 'oldest' | 'amount')
                        }
                        aria-label="Sort credit ledger"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="amount">Largest amount</option>
                      </select>
                    </label>
                  </div>

                  {creditsByBrand.some((b) => b.loading) ? (
                    <p className="muted" style={{ marginTop: '0.75rem' }}>
                      Loading ledger…
                    </p>
                  ) : null}
                  {creditsByBrand
                    .filter((b) => b.error)
                    .map((b) => (
                      <p key={b.brandId} className="msg-err" style={{ marginTop: '0.45rem' }}>
                        {b.brandName}: {b.error}
                      </p>
                    ))}

                  {filteredCreditRows.length === 0 ? (
                    <EmptyState
                      title="No credit activity"
                      description={
                        flatCreditRows.length === 0
                          ? 'Lead credit grants and deductions will show here.'
                          : 'No rows match your filters.'
                      }
                    />
                  ) : (
                    <div className="billing-ledger-wrap" style={{ marginTop: '0.75rem' }}>
                      <table className="billing-ledger">
                        <thead>
                          <tr>
                            <th scope="col">When</th>
                            <th scope="col">Brand</th>
                            <th scope="col">Type</th>
                            <th scope="col">Note</th>
                            <th scope="col">Amount</th>
                            <th scope="col">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCreditRows.map((entry) => (
                            <tr key={`${entry.brandId}-${entry.id}`}>
                              <td
                                className="muted"
                                style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                              >
                                {new Date(entry.createdAt).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td>{entry.brandName}</td>
                              <td>
                                <span className="billing-ledger__type">{entry.type}</span>
                              </td>
                              <td>{entry.note || <span className="muted">—</span>}</td>
                              <td
                                style={{
                                  color: entry.amount < 0 ? 'var(--bad)' : 'var(--good)',
                                  fontWeight: 650,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {entry.amount > 0 ? '+' : ''}
                                {entry.amount}
                              </td>
                              <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                                {entry.allotmentAfter}
                                {entry.packAfter > 0 ? ` + ${entry.packAfter} pack` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Panel>
          ) : null}

          {brandTab === 'methods' ? methodsPanel : null}
          {brandTab === 'charges' ? chargesPanel : null}

          {!loading && ledgerBrands.length === 0 ? (
            <Panel title="Brand billing">
              <EmptyState
                title="Create a brand first"
                description="Campaign ledgers, escrow wallets, and lead credits are per brand."
                action={
                  <Link href="/brands" className="btn" style={{ marginTop: '1rem' }}>
                    Brands →
                  </Link>
                }
              />
            </Panel>
          ) : null}
        </>
      ) : (
        <>
          <div className="recruit-tabs" role="tablist" aria-label="Billing sections">
            <button
              type="button"
              role="tab"
              aria-selected={brandTab === 'methods' || brandTab === 'wallets'}
              className={`recruit-tabs__btn${brandTab === 'methods' || brandTab === 'wallets' ? ' is-active' : ''}`}
              onClick={() => selectBrandTab('methods')}
            >
              Payment methods
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={brandTab === 'charges'}
              className={`recruit-tabs__btn${brandTab === 'charges' ? ' is-active' : ''}`}
              onClick={() => selectBrandTab('charges')}
            >
              Charges
            </button>
          </div>
          {brandTab === 'charges' ? chargesPanel : methodsPanel}
        </>
      )}

      <Modal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        title="Fund a brand wallet"
        description="Pick which brand receives the prepaid escrow (20% platform fee on payouts, capped)."
      >
        <label className="billing-ledger-filters__field" style={{ marginBottom: '0.75rem' }}>
          <span>Brand to fund</span>
          <select
            className="field"
            value={fundBrandId}
            onChange={(e) => setFundBrandId(e.target.value)}
            aria-label="Brand to fund"
          >
            {ledgerBrands.length === 0 ? <option value="">No brands</option> : null}
            {ledgerBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.walletBalanceLabel}
              </option>
            ))}
          </select>
        </label>
        {fundBrand ? (
          <p className="muted" style={{ margin: '0 0 0.65rem', fontSize: '0.85rem' }}>
            Funding <strong>{fundBrand.name}</strong>
          </p>
        ) : null}
        <div className="billing-fund-presets">
          {FUND_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              className="btn"
              disabled={busy || !fundBrandId}
              onClick={() => void fund(d)}
            >
              ${d.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="billing-fund-custom" style={{ marginTop: '0.75rem' }}>
          <input
            className="field"
            type="number"
            min={50}
            max={5000}
            step={50}
            value={customDollars}
            onChange={(e) => setCustomDollars(e.target.value)}
            aria-label="Custom fund amount USD"
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !fundBrandId}
            onClick={() => void fund(Number(customDollars) || 0)}
          >
            {busy ? 'Opening Stripe…' : 'Fund custom amount'}
          </button>
        </div>
      </Modal>
    </main>
  );
}
