/**
 * Phase 1–3 column helpers for the brand leads table (Trojan Scrape / WebScan / Enrich parity).
 * Extra scan fields live on ProspectIntel; flat Prospect columns cover Maps + contact basics.
 */

import type { ProspectIntel } from '@/lib/prospect-intel';

export type PhaseLead = {
  companyName: string;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  ownerName?: string | null;
  ownerTitle?: string | null;
  ownerEmail?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  enrichmentStatus?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  bookingUrlFound?: string | null;
  mapsPlaceId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PhaseScan = {
  googleEmail?: string | null;
  googlePlaceId?: string | null;
  quickHealth?: number | null;
  seoScore?: number | null;
  opportunity?: number | null;
  metaTitle?: string | null;
  metaDesc?: string | null;
  h1?: string | null;
  h1Count?: number | null;
  h2Count?: number | null;
  headingScore?: number | null;
  wordCount?: number | null;
  imgCount?: number | null;
  imgMissingAlt?: number | null;
  canonicalValid?: boolean | null;
  robots?: string | null;
  hasOg?: boolean | null;
  localKw?: boolean | null;
  loadSec?: number | null;
  dnsEmail?: string | null;
  spf?: 'pass' | 'fail' | null;
  dmarc?: string | null;
  dkim?: boolean | null;
  dnsSec?: number | null;
  gsc?: boolean | null;
  saasTools?: string | null;
  dnsCdn?: string | null;
  webPhone?: string | null;
  webEmail?: string | null;
  generalEmail?: string | null;
  businessPhone?: string | null;
  services?: string | null;
};

declare module '@/lib/prospect-intel' {
  // Augment via intersection in this module instead — keep explicit merge below.
}

/** Scan fields stored alongside Quick Intel on hooksJSON.intel */
export type ProspectIntelWithPhases = ProspectIntel & PhaseScan;

export function asPhaseIntel(intel: ProspectIntel | null | undefined): ProspectIntelWithPhases {
  return (intel || {}) as ProspectIntelWithPhases;
}

export function enrichStatusLabel(status?: string | null) {
  const s = (status || 'none').toLowerCase();
  if (s === 'done' || s === 'completed') return 'Complete';
  if (s === 'failed') return 'Failed';
  if (s === 'pending' || s === 'queued' || s === 'in_progress') return 'Pending';
  return 'Not Started';
}

export function enrichScore(lead: PhaseLead, intel: ProspectIntelWithPhases) {
  const filled = [
    Boolean(lead.ownerEmail || intel.webEmail),
    Boolean(lead.phone),
    Boolean(lead.ownerName),
    Boolean(intel.cms),
    (lead.reviewCount || 0) > 0,
    Boolean(intel.bookingSystem || lead.bookingUrlFound),
    (intel.health || 0) > 0,
  ].filter(Boolean).length;
  return Math.round((filled / 7) * 100);
}

export function formatPhaseDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function boolMark(v: boolean | null | undefined, scanned: boolean) {
  if (!scanned) return '⏸';
  if (v == null) return '—';
  return v ? '✓' : '✗';
}

export function numOrPending(v: number | null | undefined, scanned: boolean) {
  if (!scanned) return '⏸';
  if (v == null) return '—';
  return String(Math.round(v));
}

/** Deterministic demo scan payload for a lead index. */
export function buildDemoPhaseScan(i: number, phone: string): PhaseScan {
  const scanned = i % 5 !== 4;
  if (!scanned) {
    return {
      quickHealth: null,
      seoScore: null,
      opportunity: null,
    };
  }
  const tools = ['HubSpot', 'Intercom', 'Stripe', 'Segment', 'None'];
  const cdns = ['Cloudflare', 'Fastly', 'AWS CloudFront', 'None'];
  return {
    googleEmail: i % 4 === 0 ? `info@example-${i}.com` : null,
    googlePlaceId: `ChIJdemo${String(1000 + i).padStart(4, '0')}xxxx`,
    quickHealth: 48 + (i % 45),
    seoScore: 40 + (i % 50),
    opportunity: 35 + (i % 55),
    metaTitle: `Demo Company ${i} | Services & Solutions`,
    metaDesc: `Trusted partner for teams that need reliable outbound outcomes. Book a consult.`,
    h1: `Welcome to Demo Company ${i}`,
    h1Count: i % 3 === 0 ? 0 : 1,
    h2Count: 2 + (i % 6),
    headingScore: 55 + (i % 40),
    wordCount: 420 + i * 17,
    imgCount: 8 + (i % 20),
    imgMissingAlt: i % 5,
    canonicalValid: i % 4 !== 0,
    robots: i % 3 === 0 ? 'index,follow' : 'noindex',
    hasOg: i % 2 === 0,
    localKw: i % 3 !== 0,
    loadSec: 1.2 + (i % 40) / 10,
    dnsEmail: i % 5 === 0 ? null : ['Google', 'Microsoft 365', 'Zoho'][i % 3],
    spf: i % 4 === 0 ? 'fail' : 'pass',
    dmarc: ['reject', 'quarantine', 'none', null][i % 4] as string | null,
    dkim: i % 3 !== 0,
    dnsSec: 40 + (i % 55),
    gsc: i % 2 === 0,
    saasTools: tools[i % tools.length],
    dnsCdn: cdns[i % cdns.length],
    webPhone: phone,
    webEmail: i % 3 === 0 ? `hello@example-${i}.com` : null,
    generalEmail: i % 2 === 0 ? `contact@example-${i}.com` : null,
    businessPhone: phone,
    services: ['RevOps audit', 'Pipeline coaching', 'CRM cleanup'].slice(0, 1 + (i % 3)).join(', '),
  };
}
