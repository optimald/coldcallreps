'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MatchState } from '@/lib/brand-lead-match';
import {
  asPhaseIntel,
  boolMark,
  enrichScore,
  enrichStatusLabel,
  formatPhaseDate,
  numOrPending,
} from '@/lib/phase-intel';
import { parseIntel } from '@/lib/prospect-intel';

export type PhaseTableLead = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  ownerName: string | null;
  ownerTitle?: string | null;
  ownerEmail?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  campaignId?: string | null;
  status?: string | null;
  hooksJSON?: string | null;
  enrichmentStatus?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  bookingUrlFound?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  mapsPlaceId?: string | null;
  callCount?: number;
  attemptCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type CampaignOpt = { id: string; title: string };

function domainOf(website?: string | null) {
  if (!website) return null;
  return website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 36);
}

function formatReviewRating(rating?: number | null) {
  if (rating == null || Number.isNaN(rating)) return null;
  return (Math.round(rating * 10) / 10).toFixed(1);
}

function PhaseDots({
  lead,
}: {
  lead: Pick<PhaseTableLead, 'qualifyPhase1' | 'qualifyPhase2' | 'qualifyPhase3'>;
}) {
  const phases = [lead.qualifyPhase1, lead.qualifyPhase2, lead.qualifyPhase3];
  return (
    <div className="brand-leads__phases" aria-label="Pipeline phases 1–3">
      {phases.map((p, i) => {
        const pending = p == null && (i === 0 || phases[i - 1] === true);
        const tone = p === true ? 'ok' : p === false ? 'bad' : pending ? 'pending' : 'idle';
        return (
          <span
            key={i}
            className={`brand-leads__phase-dot brand-leads__phase-dot--${tone}`}
            title={`Phase ${i + 1}`}
          >
            {p === true ? '✓' : p === false ? '×' : pending ? '·' : ''}
          </span>
        );
      })}
    </div>
  );
}

function muted(v: ReactNode) {
  return <span className="muted small">{v}</span>;
}

function scoreClass(n: number | null | undefined) {
  if (n == null) return 'muted';
  if (n >= 70) return 'ok';
  if (n >= 40) return 'mid';
  return 'bad';
}

export default function BrandLeadsPhaseTable({
  leads,
  isLive,
  brandKey,
  brandCampaigns,
  selected,
  allPageSelected,
  somePageSelected,
  onToggleSelectAll,
  onToggleSelect,
  onOpenDetail,
  onAssignLead,
  campaignTitle,
  matchChipClass,
  matchLabel,
  matchStateOf,
}: {
  leads: PhaseTableLead[];
  isLive: boolean;
  brandKey: string;
  brandCampaigns: CampaignOpt[];
  selected: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (lead: PhaseTableLead) => void;
  onAssignLead: (id: string, campaignId: string) => void;
  campaignTitle: (id: string | null | undefined) => string;
  matchChipClass: (state: MatchState) => string;
  matchLabel: (state: MatchState) => string;
  matchStateOf: (lead: PhaseTableLead) => MatchState;
}) {
  const identityCols = isLive ? 2 : 1;

  return (
    <div className="brand-leads__table-wrap">
      <table className="brand-leads__table brand-leads__table--phases">
        <thead>
          <tr className="brand-leads__row brand-leads__row--groups">
            <th className="brand-leads__group brand-leads__group--identity" colSpan={identityCols} />
            <th className="brand-leads__group brand-leads__group--gate" colSpan={1}>
              Gate
            </th>
            <th className="brand-leads__group brand-leads__group--p1" colSpan={9}>
              Phase 1: Scrape
            </th>
            <th className="brand-leads__group brand-leads__group--p2" colSpan={29}>
              Phase 2: Web Scan
            </th>
            <th className="brand-leads__group brand-leads__group--p3" colSpan={10}>
              Phase 3: Enrichment
            </th>
            <th className="brand-leads__group brand-leads__group--dates" colSpan={2}>
              Dates
            </th>
            <th className="brand-leads__group brand-leads__group--pipeline" colSpan={3}>
              Desk
            </th>
          </tr>
          <tr className="brand-leads__row brand-leads__row--head">
            {isLive ? (
              <th className="brand-leads__th-check brand-leads__col--check">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected && !allPageSelected;
                  }}
                  onChange={onToggleSelectAll}
                  aria-label="Select page"
                />
              </th>
            ) : null}
            <th className="brand-leads__col--company">Name</th>
            <th className="brand-leads__col--phases">P1–P3</th>

            {/* P1 */}
            <th className="brand-leads__col--p1">Links</th>
            <th className="brand-leads__col--p1">Reviews</th>
            <th className="brand-leads__col--p1">Category</th>
            <th className="brand-leads__col--p1">Google Phone</th>
            <th className="brand-leads__col--p1">Google Email</th>
            <th className="brand-leads__col--p1">Address</th>
            <th className="brand-leads__col--p1">PlaceID</th>
            <th className="brand-leads__col--p1">Coords</th>
            <th className="brand-leads__col--p1">Industry</th>

            {/* P2 */}
            <th className="brand-leads__col--p2">Quick Health</th>
            <th className="brand-leads__col--p2">SEO Score</th>
            <th className="brand-leads__col--p2">Opportunity</th>
            <th className="brand-leads__col--p2 brand-leads__col--wide">Meta Title</th>
            <th className="brand-leads__col--p2 brand-leads__col--wide">Meta Desc</th>
            <th className="brand-leads__col--p2 brand-leads__col--mid">H1</th>
            <th className="brand-leads__col--p2">H2s</th>
            <th className="brand-leads__col--p2">Heading</th>
            <th className="brand-leads__col--p2">Words</th>
            <th className="brand-leads__col--p2">Images</th>
            <th className="brand-leads__col--p2">Canonical</th>
            <th className="brand-leads__col--p2">Robots</th>
            <th className="brand-leads__col--p2">OG</th>
            <th className="brand-leads__col--p2">Local KW</th>
            <th className="brand-leads__col--p2">HTTPS</th>
            <th className="brand-leads__col--p2">Platform</th>
            <th className="brand-leads__col--p2">Mobile</th>
            <th className="brand-leads__col--p2">© Year</th>
            <th className="brand-leads__col--p2">Load</th>
            <th className="brand-leads__col--p2">Email</th>
            <th className="brand-leads__col--p2">SPF</th>
            <th className="brand-leads__col--p2">DMARC</th>
            <th className="brand-leads__col--p2">DKIM</th>
            <th className="brand-leads__col--p2">DNS Sec</th>
            <th className="brand-leads__col--p2">GSC</th>
            <th className="brand-leads__col--p2 brand-leads__col--mid">SaaS Tools</th>
            <th className="brand-leads__col--p2">DNS / CDN</th>
            <th className="brand-leads__col--p2">Web Phone</th>
            <th className="brand-leads__col--p2">Web Email</th>

            {/* P3 */}
            <th className="brand-leads__col--p3">Enrich Status</th>
            <th className="brand-leads__col--p3">Owner</th>
            <th className="brand-leads__col--p3">Title</th>
            <th className="brand-leads__col--p3">Email</th>
            <th className="brand-leads__col--p3">Phone</th>
            <th className="brand-leads__col--p3">Gen. Email</th>
            <th className="brand-leads__col--p3">Biz Phone</th>
            <th className="brand-leads__col--p3">Services</th>
            <th className="brand-leads__col--p3">Booking</th>
            <th className="brand-leads__col--p3">Score</th>

            <th className="brand-leads__col--dates">Created</th>
            <th className="brand-leads__col--dates">Modified</th>
            <th className="brand-leads__col--match-status">Status</th>
            <th className="brand-leads__col--calls">Calls</th>
            <th className="brand-leads__col--campaign">Campaign</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const intel = asPhaseIntel(parseIntel(l.hooksJSON));
            const scanned = (l.webScanStatus || '').toLowerCase() === 'completed';
            const domain = domainOf(l.website);
            const ratingLabel = formatReviewRating(l.reviewRating);
            const placeId = intel.googlePlaceId || l.mapsPlaceId || null;
            const lat = intel.latitude;
            const lon = intel.longitude;
            const addr =
              intel.address || [l.city, l.state].filter(Boolean).join(', ') || null;
            const state = matchStateOf(l);
            const callCount =
              typeof l.callCount === 'number'
                ? l.callCount
                : typeof l.attemptCount === 'number'
                  ? l.attemptCount
                  : 0;
            const eScore = enrichScore(l, intel);
            const websiteHref = l.website
              ? l.website.startsWith('http')
                ? l.website
                : `https://${l.website}`
              : null;
            const mapsHref =
              lat != null && lon != null
                ? `https://www.google.com/maps/@${lat},${lon},17z`
                : intel.googleMapsUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${l.companyName} ${l.city || ''} ${l.state || ''}`
                  )}`;

            return (
              <tr
                key={l.id}
                className={`brand-leads__tr brand-leads__row${selected.has(l.id) ? ' is-selected' : ''}`}
                onClick={() => onOpenDetail(l)}
              >
                {isLive ? (
                  <td
                    className="brand-leads__td-check brand-leads__col--check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => onToggleSelect(l.id)}
                      aria-label={`Select ${l.companyName}`}
                    />
                  </td>
                ) : null}
                <td className="brand-leads__col--company">
                  <div className="brand-leads__name-cell">
                    <span className="brand-leads__avatar" aria-hidden>
                      {l.companyName.charAt(0).toUpperCase()}
                    </span>
                    <div className="brand-leads__name-meta">
                      <span className="brand-leads__name">{l.companyName}</span>
                      <span className="brand-leads__sub muted">{domain || '—'}</span>
                    </div>
                  </div>
                </td>
                <td className="brand-leads__col--phases">
                  <PhaseDots lead={l} />
                </td>

                {/* P1 */}
                <td className="brand-leads__col--p1" onClick={(e) => e.stopPropagation()}>
                  <div className="brand-leads__links">
                    {websiteHref ? (
                      <a href={websiteHref} target="_blank" rel="noreferrer" title="Website">
                        Web
                      </a>
                    ) : (
                      muted('—')
                    )}
                    <a href={mapsHref} target="_blank" rel="noreferrer" title="Maps">
                      Maps
                    </a>
                  </div>
                </td>
                <td className="brand-leads__col--p1">
                  {ratingLabel ? (
                    <>
                      {ratingLabel}★
                      {l.reviewCount != null ? muted(` (${l.reviewCount})`) : null}
                    </>
                  ) : (
                    muted('⏸')
                  )}
                </td>
                <td className="brand-leads__col--p1">{intel.googleCategory || muted('—')}</td>
                <td className="brand-leads__col--p1">
                  {intel.googlePhone || l.phone || muted('—')}
                </td>
                <td className="brand-leads__col--p1">{intel.googleEmail || muted('—')}</td>
                <td className="brand-leads__col--p1">
                  {addr ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="soft-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {addr}
                    </a>
                  ) : (
                    muted('—')
                  )}
                </td>
                <td className="brand-leads__col--p1" title={placeId || undefined}>
                  {placeId ? `${placeId.slice(0, 10)}…` : muted('—')}
                </td>
                <td className="brand-leads__col--p1">
                  {lat != null && lon != null
                    ? `${lat.toFixed(3)}, ${lon.toFixed(3)}`
                    : muted('—')}
                </td>
                <td className="brand-leads__col--p1">{l.industry || muted('—')}</td>

                {/* P2 */}
                <td className={`brand-leads__col--p2 brand-leads__score--${scoreClass(intel.quickHealth ?? intel.health)}`}>
                  {numOrPending(intel.quickHealth ?? intel.health, scanned)}
                </td>
                <td className={`brand-leads__col--p2 brand-leads__score--${scoreClass(intel.seoScore)}`}>
                  {numOrPending(intel.seoScore, scanned)}
                </td>
                <td className={`brand-leads__col--p2 brand-leads__score--${scoreClass(intel.opportunity)}`}>
                  {numOrPending(intel.opportunity, scanned)}
                </td>
                <td className="brand-leads__col--p2 brand-leads__col--wide" title={intel.metaTitle || undefined}>
                  {scanned ? intel.metaTitle || muted('Missing') : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2 brand-leads__col--wide" title={intel.metaDesc || undefined}>
                  {scanned ? intel.metaDesc || muted('Missing') : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2 brand-leads__col--mid" title={intel.h1 || undefined}>
                  {scanned
                    ? intel.h1Count === 0
                      ? muted('✗ 0')
                      : intel.h1 || muted('—')
                    : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned ? (intel.h2Count ?? 0) : muted('—')}
                </td>
                <td className="brand-leads__col--p2">{numOrPending(intel.headingScore, scanned)}</td>
                <td className="brand-leads__col--p2">
                  {scanned ? (intel.wordCount ?? muted('—')) : muted('—')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned ? (
                    <>
                      {intel.imgCount ?? 0}
                      {(intel.imgMissingAlt || 0) > 0
                        ? muted(` (${intel.imgMissingAlt} no alt)`)
                        : null}
                    </>
                  ) : (
                    muted('—')
                  )}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned
                    ? intel.canonicalValid === true
                      ? '✓ Valid'
                      : intel.canonicalValid === false
                        ? '✗ Bad'
                        : muted('Missing')
                    : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">{scanned ? intel.robots || muted('—') : muted('—')}</td>
                <td className="brand-leads__col--p2">{boolMark(intel.hasOg, scanned)}</td>
                <td className="brand-leads__col--p2">{boolMark(intel.localKw, scanned)}</td>
                <td className="brand-leads__col--p2">
                  {scanned ? (intel.https ? 'HTTPS' : 'HTTP') : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">{scanned ? intel.cms || muted('—') : muted('—')}</td>
                <td className="brand-leads__col--p2">{boolMark(intel.mobile, scanned)}</td>
                <td className="brand-leads__col--p2">
                  {scanned ? intel.copyrightYear || muted('⏸') : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned && intel.loadSec != null ? `${intel.loadSec.toFixed(1)}s` : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned ? intel.dnsEmail || muted('No MX') : muted('—')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned ? (intel.spf === 'pass' ? '✓' : '✗') : muted('—')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned
                    ? intel.dmarc === 'reject'
                      ? 'Reject'
                      : intel.dmarc === 'quarantine'
                        ? 'Quar.'
                        : intel.dmarc === 'none'
                          ? 'None'
                          : muted('Missing')
                    : muted('—')}
                </td>
                <td className="brand-leads__col--p2">{boolMark(intel.dkim, scanned)}</td>
                <td className="brand-leads__col--p2">{numOrPending(intel.dnsSec, scanned)}</td>
                <td className="brand-leads__col--p2">{boolMark(intel.gsc, scanned)}</td>
                <td className="brand-leads__col--p2 brand-leads__col--mid">
                  {scanned ? intel.saasTools || muted('None') : muted('—')}
                </td>
                <td className="brand-leads__col--p2">
                  {scanned ? intel.dnsCdn || muted('⏸') : muted('⏸')}
                </td>
                <td className="brand-leads__col--p2">{intel.webPhone || muted('—')}</td>
                <td className="brand-leads__col--p2">{intel.webEmail || muted('—')}</td>

                {/* P3 */}
                <td className="brand-leads__col--p3">
                  <span
                    className={`brand-leads__enrich-pill brand-leads__enrich-pill--${enrichStatusLabel(l.enrichmentStatus).toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {enrichStatusLabel(l.enrichmentStatus)}
                  </span>
                </td>
                <td className="brand-leads__col--p3">{l.ownerName || muted('—')}</td>
                <td className="brand-leads__col--p3">{l.ownerTitle || muted('—')}</td>
                <td className="brand-leads__col--p3">
                  {l.ownerEmail || intel.webEmail || muted('⏸')}
                </td>
                <td className="brand-leads__col--p3">{l.phone || muted('⏸')}</td>
                <td className="brand-leads__col--p3">{intel.generalEmail || muted('—')}</td>
                <td className="brand-leads__col--p3">
                  {intel.businessPhone || l.phone || muted('—')}
                </td>
                <td className="brand-leads__col--p3" title={intel.services || undefined}>
                  {intel.services
                    ? intel.services.split(', ').slice(0, 2).join(', ')
                    : muted('—')}
                </td>
                <td className="brand-leads__col--p3">
                  {intel.bookingSystem || l.bookingUrlFound ? (
                    <span className="brand-leads__booking-pill">
                      {intel.bookingSystem || 'Booking'}
                    </span>
                  ) : (
                    muted('—')
                  )}
                </td>
                <td className="brand-leads__col--p3">
                  <span className={`brand-leads__enrich-score brand-leads__enrich-score--${scoreClass(eScore)}`}>
                    {eScore}%
                  </span>
                </td>

                <td className="brand-leads__col--dates muted small">
                  {formatPhaseDate(l.createdAt) || '—'}
                </td>
                <td className="brand-leads__col--dates muted small">
                  {formatPhaseDate(l.updatedAt) || '—'}
                </td>
                <td className="brand-leads__col--match-status">
                  <span className={matchChipClass(state)}>{matchLabel(state)}</span>
                </td>
                <td className="brand-leads__col--calls">
                  {brandKey ? (
                    <Link
                      href={`/brands/${brandKey}/leads/${l.id}`}
                      className="soft-link"
                      onClick={(e) => e.stopPropagation()}
                      title="Call log"
                    >
                      {callCount}
                    </Link>
                  ) : (
                    callCount
                  )}
                </td>
                <td className="brand-leads__col--campaign" onClick={(e) => e.stopPropagation()}>
                  {isLive ? (
                    <select
                      className="brand-leads__campaign-select"
                      value={l.campaignId || ''}
                      onChange={(e) => onAssignLead(l.id, e.target.value)}
                      aria-label="Assign campaign"
                    >
                      {!l.campaignId ? (
                        <option value="" disabled>
                          Select…
                        </option>
                      ) : null}
                      {brandCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted small">{campaignTitle(l.campaignId)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}