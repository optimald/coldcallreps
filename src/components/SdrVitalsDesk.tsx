'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { formatPct } from '@/lib/desk-economics';
import type { SdrVitals } from '@/lib/sdr-vitals-shared';
import {
  formatSdrMoney,
  formatTalkTime,
  formatVelocity,
} from '@/lib/sdr-vitals-shared';

type Tone = 'good' | 'warn' | 'bad' | 'accent' | 'muted';

export function SdrVitalsStrip({ vitals }: { vitals: SdrVitals }) {
  const items: { label: string; value: string; tone?: Tone }[] = [
    {
      label: 'Dial velocity',
      value: formatVelocity(vitals.dialingVelocity),
      tone: 'accent',
    },
    {
      label: 'Avg talk time',
      value: formatTalkTime(vitals.avgTalkSeconds),
      tone:
        vitals.avgTalkSeconds != null && vitals.avgTalkSeconds < 15
          ? 'warn'
          : vitals.avgTalkSeconds != null && vitals.avgTalkSeconds >= 60
            ? 'good'
            : 'muted',
    },
    {
      label: 'Audited convert',
      value: formatPct(vitals.auditedConversionRate),
      tone: 'good',
    },
    {
      label: 'Paid',
      value: formatSdrMoney(vitals.earningsPaidCents),
      tone: 'good',
    },
    {
      label: 'In escrow',
      value: formatSdrMoney(vitals.earningsPendingCents),
      tone: vitals.earningsPendingCents > 0 ? 'warn' : 'muted',
    },
    {
      label: 'Connect index',
      value: formatPct(vitals.connectionIndex),
      tone:
        vitals.connectionIndex != null && vitals.connectionIndex < 0.25
          ? 'warn'
          : 'accent',
    },
    {
      label: 'Rank',
      value: vitals.currentRank != null ? `#${vitals.currentRank}` : '—',
      tone: 'accent',
    },
  ];

  return (
    <div className="desk-econ-strip">
      {items.map((item) => (
        <div
          key={item.label}
          className={`desk-econ-strip__item${item.tone ? ` is-${item.tone}` : ''}`}
        >
          <span className="desk-econ-strip__label">{item.label}</span>
          <strong className="desk-econ-strip__value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

const OBJ_COLORS = [
  'var(--accent)',
  'var(--teal, #6fd4c8)',
  'var(--warn, #d4a017)',
  'color-mix(in srgb, var(--ink) 45%, transparent)',
  'var(--danger, #e25555)',
];

export function SdrEarningsVelocityChart({
  vitals,
  height = 160,
}: {
  vitals: SdrVitals;
  height?: number;
}) {
  const days = vitals.earningsSeries;
  if (!days.length) {
    return <p className="muted desk-chart__empty">No earnings yet this period.</p>;
  }

  const w = 560;
  const h = height;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = height < 120 ? 18 : 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(
    1,
    ...days.map((d) => d.cumulativeCents),
    vitals.projectedDailyCents * days.length
  );

  function point(i: number, value: number) {
    const x =
      padL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
    const y = padT + innerH - (value / maxVal) * innerH;
    return { x, y };
  }

  const pts = days.map((d, i) => point(i, d.cumulativeCents));
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area =
    pts.length > 0
      ? `${path} L${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : '';

  const projPts = days.map((_, i) =>
    point(i, vitals.projectedDailyCents * (i + 1))
  );
  const projPath = projPts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Earnings velocity"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              className="desk-chart__grid"
            />
          );
        })}
        <path d={area} fill="var(--teal, #6fd4c8)" opacity={0.16} />
        <path
          d={path}
          fill="none"
          stroke="var(--teal, #6fd4c8)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={projPath}
          fill="none"
          stroke="color-mix(in srgb, var(--ink) 40%, transparent)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        {days.map((day, i) => {
          const x =
            padL +
            (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
          return (
            <text
              key={day.key}
              x={x}
              y={h - 8}
              textAnchor="middle"
              className="desk-chart__tick"
            >
              {i % 2 === 0 || days.length < 10 ? day.label : ''}
            </text>
          );
        })}
      </svg>
      <div className="desk-chart__legend">
        <span className="desk-chart__legend-item">
          <i style={{ background: 'var(--teal, #6fd4c8)' } as CSSProperties} />
          Cumulative earned
        </span>
        <span className="desk-chart__legend-item">
          Run-rate {formatSdrMoney(vitals.projectedDailyCents)}/day
        </span>
      </div>
    </div>
  );
}

export function SdrObjectionDonut({
  vitals,
  size = 148,
  compact = false,
}: {
  vitals: SdrVitals;
  size?: number;
  compact?: boolean;
}) {
  const slices = vitals.objections;
  if (!slices.length) {
    return (
      <p className="muted desk-chart__empty" style={{ margin: 0 }}>
        No dispositions yet — dial to fill this in.
      </p>
    );
  }
  const total = slices.reduce((s, x) => s + x.count, 0) || 1;
  const r = compact ? 38 : 42;
  const stroke = compact ? 10 : 12;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={`sdr-obj${compact ? ' sdr-obj--compact' : ''}`}>
      <div className="desk-donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" role="img" aria-label="Objection breakdown">
          {slices.map((slice, i) => {
            const len = (slice.count / total) * c;
            const el = (
              <circle
                key={slice.id}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={OBJ_COLORS[i % OBJ_COLORS.length]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              >
                <title>
                  {slice.label}: {slice.count}
                </title>
              </circle>
            );
            offset += len;
            return el;
          })}
          <text x="60" y="56" textAnchor="middle" className="desk-donut__value">
            {total}
          </text>
          <text x="60" y="72" textAnchor="middle" className="desk-donut__label">
            calls
          </text>
        </svg>
      </div>
      <ul className="sdr-obj__legend">
        {slices.map((slice, i) => (
          <li key={slice.id}>
            <i
              style={
                { background: OBJ_COLORS[i % OBJ_COLORS.length] } as CSSProperties
              }
            />
            <span>{slice.label}</span>
            <strong>{Math.round((slice.count / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
      {!compact ? (
        <Link href="/practice" className="soft-link" style={{ marginTop: '0.5rem' }}>
          Practice weak objections →
        </Link>
      ) : null}
    </div>
  );
}

export function SdrRankTrackChart({
  vitals,
  height = 140,
}: {
  vitals: SdrVitals;
  height?: number;
}) {
  const points = vitals.rankTrack;
  if (!points.length) {
    return <p className="muted desk-chart__empty">Rank history coming soon.</p>;
  }

  const w = 560;
  const h = height;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = height < 120 ? 18 : 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const ranks = points.map((p) => p.rank);
  const minR = Math.min(...ranks);
  const maxR = Math.max(...ranks);
  const span = Math.max(1, maxR - minR);

  function point(i: number, rank: number) {
    const x =
      padL +
      (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    // Lower rank number = higher on chart
    const y = padT + ((rank - minR) / span) * innerH;
    return { x, y };
  }

  const pts = points.map((p, i) => point(i, p.rank));
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Leaderboard rank track"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              className="desk-chart__grid"
            />
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <circle key={points[i].key} cx={p.x} cy={p.y} r={3} fill="var(--accent)">
            <title>
              {points[i].label}: #{points[i].rank}
            </title>
          </circle>
        ))}
        {points.map((day, i) => {
          if (i % 3 !== 0 && i !== points.length - 1) return null;
          const x =
            padL +
            (points.length === 1
              ? innerW / 2
              : (i / (points.length - 1)) * innerW);
          return (
            <text
              key={day.key}
              x={x}
              y={h - 8}
              textAnchor="middle"
              className="desk-chart__tick"
            >
              {day.label}
            </text>
          );
        })}
      </svg>
      <div className="desk-chart__legend">
        <span className="desk-chart__legend-item">
          Current #{vitals.currentRank ?? '—'} · lower is better
        </span>
      </div>
    </div>
  );
}
