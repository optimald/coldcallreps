'use client';

import Link from 'next/link';
import type { BrandEconomics, DeskSignal, DeskTone } from '@/lib/desk-economics';
import {
  formatDays,
  formatPct,
  formatRate,
  formatUsd,
  topActions,
} from '@/lib/desk-economics';

function toneClass(tone: DeskTone) {
  return `desk-signal desk-signal--${tone}`;
}

export function DeskSignalCard({ signal }: { signal: DeskSignal }) {
  const body = (
    <>
      <div className="desk-signal__top">
        <span className="desk-signal__label">{signal.label}</span>
        <strong className="desk-signal__value">{signal.value}</strong>
      </div>
      <p className="desk-signal__detail">{signal.detail}</p>
      {signal.action ? (
        <span className="desk-signal__action">{signal.action.label} →</span>
      ) : null}
    </>
  );

  if (signal.action) {
    return (
      <Link href={signal.action.href} className={toneClass(signal.tone)}>
        {body}
      </Link>
    );
  }

  return <div className={toneClass(signal.tone)}>{body}</div>;
}

/** Founder ROI vitals — escrow efficiency, credits, conversion quality. */
export function EconomicsStatStrip({ economics }: { economics: BrandEconomics }) {
  const v = economics.vitals;
  const creditLeft = Math.max(0, v.leadCreditsAllotment - v.leadCreditsUsed);
  const items: {
    label: string;
    value: string;
    tone?: DeskTone;
  }[] = [
    {
      label: 'Cost / appt',
      value: formatUsd(v.costPerAppointmentCents),
      tone: 'accent',
    },
    {
      label: 'Escrow burn',
      value: formatUsd(v.escrowBurnCents),
      tone: 'muted',
    },
    {
      label: 'Appts booked',
      value: String(v.appointmentsBooked),
      tone: 'good',
    },
    {
      label: 'Lead credits',
      value:
        v.leadCreditsAllotment > 0
          ? `${v.leadCreditsUsed}/${v.leadCreditsAllotment}`
          : String(v.leadCreditsUsed),
      tone:
        v.leadCreditUtilization != null && v.leadCreditUtilization >= 0.9
          ? 'warn'
          : 'accent',
    },
    {
      label: 'Credit use',
      value: formatPct(v.leadCreditUtilization),
      tone:
        creditLeft <= 20 && v.leadCreditsAllotment > 0 ? 'warn' : 'muted',
    },
    {
      label: 'Connect rate',
      value: formatPct(v.connectionRate),
      tone:
        v.connectionRate != null && v.connectionRate < 0.25
          ? 'warn'
          : v.connectionRate != null && v.connectionRate >= 0.4
            ? 'good'
            : 'accent',
    },
    {
      label: 'Book rate',
      value: formatPct(v.bookRate),
      tone: 'good',
    },
    {
      label: 'Audit pass',
      value: formatPct(v.auditPassRate),
      tone:
        v.auditPassRate != null && v.auditPassRate < 0.7
          ? 'warn'
          : v.auditPassRate != null
            ? 'good'
            : 'muted',
    },
    {
      label: 'Lead runway',
      value: formatDays(economics.leadRunwayDays),
      tone:
        economics.leadRunwayDays != null && economics.leadRunwayDays < 3
          ? 'warn'
          : 'muted',
    },
    {
      label: 'Budget left',
      value:
        economics.budget.status === 'uncapped'
          ? 'Uncapped'
          : formatUsd(economics.budget.remainingCents),
      tone:
        economics.budget.status === 'exhausted'
          ? 'bad'
          : economics.budget.status === 'low' ||
              economics.budget.status === 'underused'
            ? 'warn'
            : 'good',
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

export function DeskActionsPanel({
  economics,
  title = 'Recommended actions',
  description,
  limit = 4,
}: {
  economics: BrandEconomics;
  title?: string;
  description?: string;
  limit?: number;
}) {
  const actions = topActions(economics, limit);
  if (actions.length === 0) {
    return (
      <div className="desk-actions desk-actions--empty">
        <p className="muted" style={{ margin: 0 }}>
          No urgent actions — velocity, budget, and lead runway look healthy.
        </p>
      </div>
    );
  }

  return (
    <div className="desk-actions">
      {title || description ? (
        <div className="desk-actions__head">
          {title ? <h2 className="panel__title">{title}</h2> : null}
          {description ? <p className="panel__desc">{description}</p> : null}
        </div>
      ) : null}
      <div className="desk-actions__list">
        {actions.map((signal) => (
          <DeskSignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}

export function DeskSignalGrid({
  signals,
  limit = 6,
}: {
  signals: DeskSignal[];
  limit?: number;
}) {
  return (
    <div className="desk-signal-grid">
      {signals.slice(0, limit).map((signal) => (
        <DeskSignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}

/** Kept for portfolio strips that still show velocity. */
export function EconomicsVelocityStrip({
  economics,
}: {
  economics: BrandEconomics;
}) {
  const items: { label: string; value: string; tone?: DeskTone }[] = [
    {
      label: 'Lead velocity',
      value: `${formatRate(economics.leadVelocityPerDay)}/day`,
      tone: 'accent',
    },
    {
      label: 'Goal velocity',
      value: `${formatRate(economics.goalVelocityPerDay)}/day`,
      tone: 'good',
    },
    {
      label: 'Cost / goal',
      value: formatUsd(economics.costPerGoalCents),
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
