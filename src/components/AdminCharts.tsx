'use client';

import type { CSSProperties } from 'react';

export type LiquidityDay = {
  key: string;
  label: string;
  leads: number;
  dials: number;
};

/** Dual-axis: bars = new leads, line = dials (marketplace liquidity). */
export function AdminLiquidityChart({
  days,
  height = 200,
}: {
  days: LiquidityDay[];
  height?: number;
}) {
  if (!days.length) {
    return <p className="muted desk-chart__empty">No liquidity data yet.</p>;
  }

  const w = 640;
  const h = height;
  const padL = 32;
  const padR = 32;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxLeads = Math.max(1, ...days.map((d) => d.leads));
  const maxDials = Math.max(1, ...days.map((d) => d.dials));
  const groupGap = 3;
  const barW = Math.max(3, (innerW - groupGap * (days.length - 1)) / days.length);

  const leadColor = 'var(--accent)';
  const dialColor = 'color-mix(in srgb, var(--ink) 55%, transparent)';

  const dialPoints = days.map((d, i) => {
    const x = padL + i * (barW + groupGap) + barW / 2;
    const y = padT + innerH - (d.dials / maxDials) * innerH;
    return { x, y, d };
  });
  const dialPath = dialPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  // Show ~8 x labels
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Leads saved versus dials placed over 30 days"
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
        {days.map((day, i) => {
          const x = padL + i * (barW + groupGap);
          const barH = Math.max(day.leads > 0 ? 2 : 0, (day.leads / maxLeads) * innerH);
          return (
            <g key={day.key}>
              <rect
                x={x}
                y={padT + innerH - barH}
                width={barW}
                height={barH}
                rx={1.5}
                fill={leadColor}
                opacity={0.85}
              >
                <title>
                  {day.label}: {day.leads} leads · {day.dials} dials
                </title>
              </rect>
              {i % labelEvery === 0 ? (
                <text
                  x={x + barW / 2}
                  y={h - 8}
                  textAnchor="middle"
                  className="desk-chart__tick"
                >
                  {day.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <path
          d={dialPath}
          fill="none"
          stroke={dialColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {dialPoints.map((p) => (
          <circle key={p.d.key} cx={p.x} cy={p.y} r={2.4} fill={dialColor} />
        ))}
      </svg>
      <div className="desk-chart__legend">
        <span className="desk-chart__legend-item">
          <i style={{ background: leadColor } as CSSProperties} />
          New leads
        </span>
        <span className="desk-chart__legend-item">
          <i style={{ background: dialColor } as CSSProperties} />
          Dials
        </span>
      </div>
    </div>
  );
}

export type FraudPoint = {
  repUserId: string;
  name: string;
  bookings: number;
  failRatePct: number;
  failed: number;
};

/** Scatter: bookings (x) vs AI audit fail rate (y). */
export function AdminFraudScatter({
  points,
  height = 200,
}: {
  points: FraudPoint[];
  height?: number;
}) {
  if (!points.length) {
    return (
      <p className="muted desk-chart__empty">
        No appointment claims in the last 30 days.
      </p>
    );
  }

  const w = 420;
  const h = height;
  const padL = 36;
  const padR = 16;
  const padT = 14;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxX = Math.max(1, ...points.map((p) => p.bookings));
  const maxY = 100;

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="SDR bookings versus AI audit fail rate"
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
        {/* High-risk quadrant hint */}
        <rect
          x={padL + innerW * 0.5}
          y={padT}
          width={innerW * 0.5}
          height={innerH * 0.5}
          fill="color-mix(in srgb, var(--bad, #c44) 12%, transparent)"
        />
        {points.map((p) => {
          const x = padL + (p.bookings / maxX) * innerW;
          const y = padT + innerH - (p.failRatePct / maxY) * innerH;
          const hot = p.bookings >= maxX * 0.5 && p.failRatePct >= 50;
          return (
            <circle
              key={p.repUserId}
              cx={x}
              cy={y}
              r={hot ? 6 : 4.5}
              fill={
                hot
                  ? 'var(--bad, #c44)'
                  : 'color-mix(in srgb, var(--accent) 80%, white)'
              }
              opacity={0.9}
            >
              <title>
                {p.name}: {p.bookings} bookings · {p.failRatePct}% fail ({p.failed}{' '}
                failed)
              </title>
            </circle>
          );
        })}
        <text x={padL} y={h - 10} className="desk-chart__tick">
          ← volume
        </text>
        <text
          x={w - padR}
          y={h - 10}
          textAnchor="end"
          className="desk-chart__tick"
        >
          bookings →
        </text>
        <text
          x={12}
          y={padT + 8}
          className="desk-chart__tick"
          transform={`rotate(-90 12 ${padT + innerH / 2})`}
        >
          fail %
        </text>
      </svg>
      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
        Upper-right = high volume + high rejection — review first.
      </p>
    </div>
  );
}
