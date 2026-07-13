'use client';

import type { CSSProperties } from 'react';

export type ChartDay = {
  key: string;
  label: string;
  leads: number;
  goals: number;
  dials: number;
  spendCents: number;
};

type SeriesKey = 'leads' | 'goals' | 'dials' | 'spendCents';

const SERIES_META: Record<
  SeriesKey,
  { label: string; color: string; format?: (n: number) => string }
> = {
  leads: { label: 'Leads', color: 'var(--accent)' },
  goals: { label: 'Goals', color: 'var(--teal, #6fd4c8)' },
  dials: { label: 'Dials', color: 'color-mix(in srgb, var(--ink) 55%, transparent)' },
  spendCents: {
    label: 'Spend',
    color: 'color-mix(in srgb, var(--warn, #d4a017) 85%, white)',
    format: (n) => `$${Math.round(n / 100)}`,
  },
};

/** Grouped vertical bars for 1–3 series over days. */
export function DeskGroupedBars({
  days,
  series,
  height = 180,
  ariaLabel,
}: {
  days: ChartDay[];
  series: SeriesKey[];
  height?: number;
  ariaLabel: string;
}) {
  if (!days.length) {
    return <p className="muted desk-chart__empty">No data yet for this period.</p>;
  }

  const w = 560;
  const h = height;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const groupGap = 10;
  const groupW = (innerW - groupGap * (days.length - 1)) / days.length;
  const barGap = 2;
  const barW = Math.max(4, (groupW - barGap * (series.length - 1)) / series.length);

  const maxVal = Math.max(
    1,
    ...days.flatMap((d) =>
      series.map((key) => (key === 'spendCents' ? d.spendCents / 100 : d[key]))
    )
  );

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={ariaLabel}
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
          const gx = padL + i * (groupW + groupGap);
          return (
            <g key={day.key}>
              {series.map((key, si) => {
                const raw = key === 'spendCents' ? day.spendCents / 100 : day[key];
                const barH = Math.max(raw > 0 ? 3 : 0, (raw / maxVal) * innerH);
                const x = gx + si * (barW + barGap);
                const y = padT + innerH - barH;
                const meta = SERIES_META[key];
                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={2}
                    fill={meta.color}
                    opacity={0.92}
                  >
                    <title>
                      {day.label}: {meta.label}{' '}
                      {meta.format ? meta.format(day[key]) : raw}
                    </title>
                  </rect>
                );
              })}
              <text
                x={gx + groupW / 2}
                y={h - 8}
                textAnchor="middle"
                className="desk-chart__tick"
              >
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="desk-chart__legend">
        {series.map((key) => (
          <span key={key} className="desk-chart__legend-item">
            <i style={{ background: SERIES_META[key].color } as CSSProperties} />
            {SERIES_META[key].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dual-line SVG for leads vs goals (or dials vs goals). */
export function DeskTrendLines({
  days,
  series,
  height = 180,
  ariaLabel,
}: {
  days: ChartDay[];
  series: SeriesKey[];
  height?: number;
  ariaLabel: string;
}) {
  if (!days.length) {
    return <p className="muted desk-chart__empty">No data yet for this period.</p>;
  }

  const w = 560;
  const h = height;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(
    1,
    ...days.flatMap((d) =>
      series.map((key) => (key === 'spendCents' ? d.spendCents / 100 : d[key]))
    )
  );

  function point(i: number, value: number) {
    const x = padL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
    const y = padT + innerH - (value / maxVal) * innerH;
    return { x, y };
  }

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={ariaLabel}
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
        {series.map((key) => {
          const meta = SERIES_META[key];
          const pts = days.map((d, i) => {
            const raw = key === 'spendCents' ? d.spendCents / 100 : d[key];
            return point(i, raw);
          });
          const path = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');
          const area =
            pts.length > 0
              ? `${path} L${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
              : '';
          return (
            <g key={key}>
              <path d={area} fill={meta.color} opacity={0.12} />
              <path
                d={path}
                fill="none"
                stroke={meta.color}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((p, i) => (
                <circle key={days[i].key} cx={p.x} cy={p.y} r={3.2} fill={meta.color}>
                  <title>
                    {days[i].label}: {meta.label}{' '}
                    {meta.format
                      ? meta.format(days[i][key])
                      : key === 'spendCents'
                        ? days[i].spendCents / 100
                        : days[i][key]}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {days.map((day, i) => {
          const x =
            padL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
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
        {series.map((key) => (
          <span key={key} className="desk-chart__legend-item">
            <i style={{ background: SERIES_META[key].color } as CSSProperties} />
            {SERIES_META[key].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut for budget spent vs remaining. */
export function BudgetDonut({
  budgetCents,
  spentCents,
  size = 148,
}: {
  budgetCents: number | null;
  spentCents: number;
  size?: number;
}) {
  const uncapped = budgetCents == null || budgetCents <= 0;
  const budget = uncapped ? Math.max(spentCents, 1) : budgetCents;
  const spent = Math.min(Math.max(0, spentCents), budget);
  const remaining = Math.max(0, budget - spent);
  const pct = uncapped ? 0 : spent / budget;

  const r = 42;
  const c = 2 * Math.PI * r;
  const spentLen = uncapped ? 0 : pct * c;

  return (
    <div className="desk-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" role="img" aria-label="Budget utilization">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--border) 90%, transparent)"
          strokeWidth="12"
        />
        {!uncapped ? (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={
              pct >= 1
                ? 'var(--danger, #e25555)'
                : pct >= 0.85
                  ? 'var(--warn, #d4a017)'
                  : 'var(--accent)'
            }
            strokeWidth="12"
            strokeDasharray={`${spentLen} ${c - spentLen}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        ) : null}
        <text x="60" y="56" textAnchor="middle" className="desk-donut__value">
          {uncapped ? '∞' : `${Math.round(pct * 100)}%`}
        </text>
        <text x="60" y="72" textAnchor="middle" className="desk-donut__label">
          {uncapped ? 'Uncapped' : 'spent'}
        </text>
      </svg>
      <div className="desk-donut__meta">
        <span>
          Spent <strong>${Math.round(spent / 100).toLocaleString()}</strong>
        </span>
        <span>
          Left{' '}
          <strong>
            {uncapped ? '—' : `$${Math.round(remaining / 100).toLocaleString()}`}
          </strong>
        </span>
      </div>
    </div>
  );
}

/** Horizontal comparison bars across brands. */
export function BrandCompareBars({
  rows,
  valueLabel,
  formatValue = (n) => String(Math.round(n * 10) / 10),
  ariaLabel,
  maxHint,
}: {
  rows: { id: string; label: string; value: number; tone?: 'good' | 'warn' | 'bad' | 'accent' }[];
  valueLabel: string;
  formatValue?: (n: number) => string;
  ariaLabel: string;
  maxHint?: number;
}) {
  if (!rows.length) {
    return <p className="muted desk-chart__empty">No brands to compare yet.</p>;
  }

  const maxVal = Math.max(maxHint || 0, 1, ...rows.map((r) => r.value));
  const rowH = 28;
  const padL = 88;
  const padR = 52;
  const padT = 8;
  const padB = 8;
  const w = 560;
  const h = padT + padB + rows.length * rowH;
  const barMax = w - padL - padR;

  return (
    <div className="desk-chart desk-chart--compare">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {rows.map((row, i) => {
          const y = padT + i * rowH + 4;
          const barW = Math.max(row.value > 0 ? 4 : 0, (row.value / maxVal) * barMax);
          const fill =
            row.tone === 'bad'
              ? 'var(--danger, #e25555)'
              : row.tone === 'warn'
                ? 'var(--warn, #d4a017)'
                : row.tone === 'good'
                  ? 'var(--teal, #6fd4c8)'
                  : 'var(--accent)';
          return (
            <g key={row.id}>
              <text
                x={padL - 8}
                y={y + 12}
                textAnchor="end"
                className="desk-chart__tick desk-chart__tick--brand"
              >
                {row.label.length > 12 ? `${row.label.slice(0, 11)}…` : row.label}
              </text>
              <rect
                x={padL}
                y={y}
                width={barMax}
                height={16}
                rx={3}
                fill="color-mix(in srgb, var(--border) 55%, transparent)"
              />
              <rect x={padL} y={y} width={barW} height={16} rx={3} fill={fill}>
                <title>
                  {row.label}: {formatValue(row.value)} {valueLabel}
                </title>
              </rect>
              <text
                x={padL + barMax + 8}
                y={y + 12}
                className="desk-chart__tick"
              >
                {formatValue(row.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="desk-chart__legend">
        <span className="desk-chart__legend-item">{valueLabel}</span>
      </div>
    </div>
  );
}

/** Horizontal meter for lead runway days. */
export function RunwayMeter({
  days,
  dialReady,
  avgCallsPerDay,
}: {
  days: number | null;
  dialReady: number;
  avgCallsPerDay: number;
}) {
  const max = 14;
  const value = days == null ? 0 : Math.min(max, days);
  const pct = (value / max) * 100;
  const tone =
    days == null || days < 1.5 ? 'bad' : days < 3 ? 'warn' : days < 7 ? 'accent' : 'good';

  return (
    <div className={`desk-meter desk-meter--${tone}`}>
      <div className="desk-meter__head">
        <span className="desk-meter__label">Lead runway</span>
        <strong className="desk-meter__value">
          {days == null ? '—' : days < 1 ? '<1 day' : `${days.toFixed(days < 10 ? 1 : 0)} days`}
        </strong>
      </div>
      <div className="desk-meter__track" aria-hidden>
        <div className="desk-meter__fill" style={{ width: `${pct}%` }} />
        <span className="desk-meter__mark" style={{ left: `${(3 / max) * 100}%` }} />
        <span className="desk-meter__mark" style={{ left: `${(7 / max) * 100}%` }} />
      </div>
      <p className="desk-meter__detail">
        {dialReady} dial-ready · ~{Math.round(avgCallsPerDay)} dials/day
      </p>
    </div>
  );
}

/** Classic conversion funnel — enriched → dials → connections → appointments. */
export function PipelineFunnel({
  stages,
  height = 168,
}: {
  stages: { id: string; label: string; value: number }[];
  height?: number;
}) {
  if (!stages.length) {
    return <p className="muted desk-chart__empty">No funnel data yet.</p>;
  }

  const maxVal = Math.max(1, ...stages.map((s) => s.value));
  const w = 560;
  const h = height;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 8;
  const rowH = (h - padT - padB) / stages.length;
  const colors = [
    'var(--accent)',
    'color-mix(in srgb, var(--ink) 45%, transparent)',
    'var(--teal, #6fd4c8)',
    'color-mix(in srgb, var(--accent) 70%, white)',
  ];

  return (
    <div className="desk-chart desk-chart--funnel">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Pipeline conversion funnel"
        preserveAspectRatio="xMidYMid meet"
      >
        {stages.map((stage, i) => {
          const y = padT + i * rowH;
          const barW = Math.max(stage.value > 0 ? 24 : 0, (stage.value / maxVal) * (w - padL - padR - 120));
          const inset = ((w - padL - padR - 120) - barW) / 2;
          const x = padL + 100 + inset;
          const prev = i > 0 ? stages[i - 1].value : null;
          const drop =
            prev != null && prev > 0
              ? `${Math.round((stage.value / prev) * 100)}%`
              : null;
          return (
            <g key={stage.id}>
              <text
                x={padL + 92}
                y={y + rowH * 0.55}
                textAnchor="end"
                className="desk-chart__tick desk-chart__tick--brand"
              >
                {stage.label}
              </text>
              <rect
                x={x}
                y={y + 4}
                width={barW}
                height={Math.max(14, rowH - 10)}
                rx={4}
                fill={colors[i % colors.length]}
                opacity={0.9}
              >
                <title>
                  {stage.label}: {stage.value}
                  {drop ? ` (${drop} of prior)` : ''}
                </title>
              </rect>
              <text
                x={x + barW + 8}
                y={y + rowH * 0.55}
                className="desk-chart__tick"
              >
                {stage.value}
                {drop && i > 0 ? ` · ${drop}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Escrow burn velocity — cumulative spend + projected runway to $0. */
export function EscrowBurnChart({
  days,
  budgetCents,
  spentCents,
  height = 160,
}: {
  days: ChartDay[];
  budgetCents: number | null;
  spentCents: number;
  height?: number;
}) {
  if (!days.length) {
    return <p className="muted desk-chart__empty">No burn data yet.</p>;
  }

  let running = 0;
  const cumulative = days.map((d) => {
    running += d.spendCents;
    return { ...d, cumulative: running };
  });

  const budget = budgetCents != null && budgetCents > 0 ? budgetCents : null;
  const last = cumulative[cumulative.length - 1]?.cumulative || 0;
  const burnPerDay = days.length > 0 ? last / days.length : 0;
  const remaining = budget != null ? Math.max(0, budget - Math.max(spentCents, last)) : null;
  const daysToEmpty =
    remaining != null && burnPerDay > 0 ? remaining / burnPerDay : null;

  const w = 560;
  const h = height;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(
    1,
    ...cumulative.map((d) => d.cumulative),
    budget || 0
  );

  function point(i: number, value: number) {
    const x =
      padL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
    const y = padT + innerH - (value / maxVal) * innerH;
    return { x, y };
  }

  const pts = cumulative.map((d, i) => point(i, d.cumulative));
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area =
    pts.length > 0
      ? `${path} L${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : '';

  const budgetY =
    budget != null ? padT + innerH - (budget / maxVal) * innerH : null;

  return (
    <div className="desk-chart">
      <svg
        className="desk-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Escrow burn velocity"
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
        {budgetY != null ? (
          <line
            x1={padL}
            x2={w - padR}
            y1={budgetY}
            y2={budgetY}
            stroke="var(--warn, #d4a017)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.85}
          />
        ) : null}
        <path d={area} fill="var(--accent)" opacity={0.14} />
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <circle key={days[i].key} cx={p.x} cy={p.y} r={3} fill="var(--accent)">
            <title>
              {days[i].label}: ${Math.round(cumulative[i].cumulative / 100)} burned
            </title>
          </circle>
        ))}
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
              {day.label}
            </text>
          );
        })}
      </svg>
      <div className="desk-chart__legend">
        <span className="desk-chart__legend-item">
          <i style={{ background: 'var(--accent)' } as CSSProperties} />
          Cumulative burn
        </span>
        {budget != null ? (
          <span className="desk-chart__legend-item">
            Budget ${Math.round(budget / 100).toLocaleString()}
            {daysToEmpty != null
              ? ` · ~${daysToEmpty < 1 ? '<1' : daysToEmpty.toFixed(0)}d to empty`
              : ''}
          </span>
        ) : (
          <span className="desk-chart__legend-item">Uncapped escrow</span>
        )}
      </div>
    </div>
  );
}

