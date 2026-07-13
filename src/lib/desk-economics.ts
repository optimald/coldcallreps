/**
 * Pure desk economics — velocity, cost/goal, runway, budget health, and actions.
 * Used by brand home (cockpit) and portfolio home (exception command center).
 */

export type DeskTone = 'good' | 'warn' | 'bad' | 'accent' | 'muted';

export type DeskAction = {
  label: string;
  href: string;
};

export type DeskSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DeskTone;
  priority: number;
  action?: DeskAction;
};

export type BudgetHealth = {
  budgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
  utilization: number | null;
  status: 'ok' | 'low' | 'exhausted' | 'underused' | 'uncapped';
};

export type BrandEconomics = {
  periodDays: number;
  leadVelocityPerDay: number;
  goalVelocityPerDay: number;
  costPerGoalCents: number | null;
  leadsPerGoal: number | null;
  dialReadyLeads: number;
  avgCallsPerDay: number;
  leadRunwayDays: number | null;
  goalsInPeriod: number;
  leadsCreatedInPeriod: number;
  spendInPeriodCents: number;
  budget: BudgetHealth;
  signals: DeskSignal[];
  /** Daily series for charts (oldest → newest). */
  series: DeskDayPoint[];
  /** Founder ROI vitals — escrow, credits, conversion. */
  vitals: BrandVitals;
};

export type FunnelStage = {
  id: string;
  label: string;
  value: number;
};

/** Brand founder ROI vitals (separate from portfolio velocity). */
export type BrandVitals = {
  escrowBurnCents: number;
  appointmentsBooked: number;
  costPerAppointmentCents: number | null;
  leadCreditsUsed: number;
  leadCreditsAllotment: number;
  leadCreditUtilization: number | null;
  dials: number;
  connections: number;
  connectionRate: number | null;
  bookRate: number | null;
  /** AI audit pass among claims (quality proxy until show/close tracking ships). */
  auditPassRate: number | null;
  funnel: FunnelStage[];
};

export type DeskDayPoint = {
  key: string;
  label: string;
  leads: number;
  goals: number;
  dials: number;
  spendCents: number;
};

export type BrandEconomicsInput = {
  brandKey: string;
  periodDays?: number;
  leadsCreatedInPeriod: number;
  goalsInPeriod: number;
  spendInPeriodCents: number;
  dialReadyLeads: number;
  callsInPeriod: number;
  activeSdrs: number;
  pendingApplications: number;
  openCampaigns: number;
  budgetCents: number | null;
  spentCents: number;
  primaryCampaignId?: string | null;
  series?: DeskDayPoint[];
  /** Optional vitals; defaults derived from period inputs when omitted. */
  vitals?: Partial<BrandVitals> & {
    connections?: number;
    leadCreditsUsed?: number;
    leadCreditsAllotment?: number;
    auditPassed?: number;
    auditTotal?: number;
    enrichedLeads?: number;
  };
};

export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(Math.abs(dollars) >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}

export function formatRate(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function formatDays(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1) return '<1 day';
  if (n >= 30) return `${Math.round(n)} days`;
  return `${n.toFixed(n < 10 ? 1 : 0)} days`;
}

function budgetHealth(
  budgetCents: number | null,
  spentCents: number
): BudgetHealth {
  const spent = Math.max(0, spentCents);
  if (budgetCents == null || budgetCents <= 0) {
    return {
      budgetCents: null,
      spentCents: spent,
      remainingCents: null,
      utilization: null,
      status: 'uncapped',
    };
  }
  const remaining = Math.max(0, budgetCents - spent);
  const utilization = Math.min(1, spent / budgetCents);
  let status: BudgetHealth['status'] = 'ok';
  if (remaining <= 0) status = 'exhausted';
  else if (remaining / budgetCents <= 0.15) status = 'low';
  else if (utilization < 0.3) status = 'underused';
  return {
    budgetCents,
    spentCents: spent,
    remainingCents: remaining,
    utilization,
    status,
  };
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

export function formatPct(n: number | null, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function buildVitals(
  input: BrandEconomicsInput,
  goalsInPeriod: number,
  spendInPeriodCents: number
): BrandVitals {
  const dials = input.callsInPeriod;
  const connections = Math.min(
    dials,
    input.vitals?.connections ?? Math.round(dials * 0.42)
  );
  const appointmentsBooked = goalsInPeriod;
  const escrowBurnCents = spendInPeriodCents;
  const leadCreditsUsed = input.vitals?.leadCreditsUsed ?? 0;
  const leadCreditsAllotment = Math.max(
    0,
    input.vitals?.leadCreditsAllotment ?? 0
  );
  const enrichedLeads =
    input.vitals?.enrichedLeads ??
    Math.max(input.leadsCreatedInPeriod, input.dialReadyLeads);
  const auditPassed = input.vitals?.auditPassed;
  const auditTotal = input.vitals?.auditTotal;
  const auditPassRate =
    auditPassed != null && auditTotal != null && auditTotal > 0
      ? auditPassed / auditTotal
      : input.vitals?.auditPassRate ?? null;

  const connectionRate = rate(connections, dials);
  const bookRate = rate(appointmentsBooked, Math.max(connections, 1));

  return {
    escrowBurnCents,
    appointmentsBooked,
    costPerAppointmentCents:
      appointmentsBooked > 0
        ? Math.round(escrowBurnCents / appointmentsBooked)
        : null,
    leadCreditsUsed,
    leadCreditsAllotment,
    leadCreditUtilization: rate(leadCreditsUsed, leadCreditsAllotment),
    dials,
    connections,
    connectionRate,
    bookRate: appointmentsBooked > 0 ? bookRate : rate(0, connections),
    auditPassRate,
    funnel: [
      { id: 'enriched', label: 'Enriched leads', value: enrichedLeads },
      { id: 'dials', label: 'Dials', value: dials },
      { id: 'connections', label: 'Connections', value: connections },
      { id: 'booked', label: 'Appointments', value: appointmentsBooked },
    ],
  };
}

/**
 * Build economics + ranked actionable signals for one brand.
 */
export function buildBrandEconomics(input: BrandEconomicsInput): BrandEconomics {
  const periodDays = Math.max(1, input.periodDays ?? 7);
  const leadVelocityPerDay = input.leadsCreatedInPeriod / periodDays;
  const goalVelocityPerDay = input.goalsInPeriod / periodDays;
  const avgCallsPerDay = input.callsInPeriod / periodDays;
  const costPerGoalCents =
    input.goalsInPeriod > 0
      ? Math.round(input.spendInPeriodCents / input.goalsInPeriod)
      : null;
  const leadsPerGoal =
    input.goalsInPeriod > 0
      ? input.leadsCreatedInPeriod / input.goalsInPeriod
      : null;
  const leadRunwayDays =
    avgCallsPerDay > 0 ? input.dialReadyLeads / avgCallsPerDay : null;
  const budget = budgetHealth(input.budgetCents, input.spentCents);
  const vitals = buildVitals(input, input.goalsInPeriod, input.spendInPeriodCents);

  const key = input.brandKey;
  const campaignHref = input.primaryCampaignId
    ? `/brands/${key}/campaigns/${input.primaryCampaignId}`
    : `/brands/${key}/campaigns`;
  const leadsHref = `/brands/${key}/leads`;
  const pipelineHref = `/brands/${key}/pipeline`;
  const appsHref = `/brands/${key}/sdrs/applications`;
  const teamHref = `/brands/${key}/sdrs/team`;
  const fundHref = `/brands/${key}/settings`;

  const signals: DeskSignal[] = [];

  if (budget.status === 'exhausted') {
    signals.push({
      id: 'budget-exhausted',
      label: 'Budget',
      value: 'Exhausted',
      detail: 'Open campaigns cannot award new goals until you fund more.',
      tone: 'bad',
      priority: 100,
      action: { label: 'Adjust budget', href: campaignHref },
    });
  } else if (budget.status === 'low') {
    signals.push({
      id: 'budget-low',
      label: 'Budget',
      value: `${formatUsd(budget.remainingCents)} left`,
      detail: `${Math.round((budget.utilization || 0) * 100)}% spent — raise the cap before dials stall.`,
      tone: 'warn',
      priority: 90,
      action: { label: 'Fund campaign', href: campaignHref },
    });
  } else if (budget.status === 'underused' && input.openCampaigns > 0) {
    signals.push({
      id: 'budget-underused',
      label: 'Budget',
      value: `${Math.round((budget.utilization || 0) * 100)}% used`,
      detail:
        input.activeSdrs === 0
          ? 'Capital is sitting idle — hire SDRs or raise pay per goal.'
          : input.dialReadyLeads === 0
            ? 'Budget ready but the dial queue is empty — add leads.'
            : 'Spend is trailing capacity — raise pay per goal or push more dials.',
      tone: 'warn',
      priority: 70,
      action:
        input.activeSdrs === 0
          ? { label: 'Review applications', href: appsHref }
          : input.dialReadyLeads === 0
            ? { label: 'Add leads', href: pipelineHref }
            : { label: 'Adjust pay / goal', href: campaignHref },
    });
  } else if (budget.status === 'ok' && budget.remainingCents != null) {
    signals.push({
      id: 'budget-ok',
      label: 'Budget',
      value: `${formatUsd(budget.remainingCents)} left`,
      detail: `${formatUsd(budget.spentCents)} of ${formatUsd(budget.budgetCents)} spent.`,
      tone: 'good',
      priority: 20,
      action: { label: 'Campaign settings', href: campaignHref },
    });
  }

  if (leadRunwayDays != null && leadRunwayDays < 3 && input.dialReadyLeads >= 0) {
    signals.push({
      id: 'lead-runway',
      label: 'Lead runway',
      value: formatDays(leadRunwayDays),
      detail: `${input.dialReadyLeads} dial-ready · ~${formatRate(avgCallsPerDay, 0)} dials/day.`,
      tone: leadRunwayDays < 1.5 ? 'bad' : 'warn',
      priority: leadRunwayDays < 1.5 ? 95 : 80,
      action: { label: 'Add leads', href: pipelineHref },
    });
  } else if (input.dialReadyLeads === 0 && input.openCampaigns > 0) {
    signals.push({
      id: 'no-ready-leads',
      label: 'Lead runway',
      value: 'Empty queue',
      detail: 'No outreach-ready leads — SDRs have nothing to dial.',
      tone: 'bad',
      priority: 95,
      action: { label: 'Add leads', href: pipelineHref },
    });
  } else if (leadRunwayDays != null) {
    signals.push({
      id: 'lead-runway-ok',
      label: 'Lead runway',
      value: formatDays(leadRunwayDays),
      detail: `${input.dialReadyLeads} dial-ready at ~${formatRate(avgCallsPerDay, 0)} dials/day.`,
      tone: 'good',
      priority: 15,
      action: { label: 'View leads', href: leadsHref },
    });
  }

  signals.push({
    id: 'lead-velocity',
    label: 'Lead velocity',
    value: `${formatRate(leadVelocityPerDay)}/day`,
    detail: `${input.leadsCreatedInPeriod} new leads in the last ${periodDays} days.`,
    tone: leadVelocityPerDay < 1 && input.openCampaigns > 0 ? 'warn' : 'accent',
    priority: leadVelocityPerDay < 1 && input.openCampaigns > 0 ? 65 : 25,
    action: {
      label: leadVelocityPerDay < 1 ? 'Generate leads' : 'Lead pipeline',
      href: pipelineHref,
    },
  });

  signals.push({
    id: 'goal-velocity',
    label: 'Goal velocity',
    value: `${formatRate(goalVelocityPerDay)}/day`,
    detail: `${input.goalsInPeriod} verified goals in the last ${periodDays} days.`,
    tone:
      goalVelocityPerDay < 0.3 &&
      input.dialReadyLeads > 0 &&
      input.activeSdrs > 0
        ? 'warn'
        : 'good',
    priority:
      goalVelocityPerDay < 0.3 &&
      input.dialReadyLeads > 0 &&
      input.activeSdrs > 0
        ? 75
        : 30,
    action: {
      label:
        goalVelocityPerDay < 0.3 && input.activeSdrs > 0
          ? 'Adjust pay / goal'
          : 'View campaigns',
      href: campaignHref,
    },
  });

  if (costPerGoalCents != null) {
    signals.push({
      id: 'cost-per-goal',
      label: 'Cost / goal',
      value: formatUsd(costPerGoalCents),
      detail: `${formatUsd(input.spendInPeriodCents)} spent · ${input.goalsInPeriod} goals.`,
      tone: 'accent',
      priority: 35,
      action: { label: 'Tune payout', href: campaignHref },
    });
  } else if (input.spendInPeriodCents > 0) {
    signals.push({
      id: 'cost-per-goal',
      label: 'Cost / goal',
      value: '—',
      detail: 'Spend recorded but no verified goals yet this period.',
      tone: 'warn',
      priority: 55,
      action: { label: 'Review campaign', href: campaignHref },
    });
  }

  if (leadsPerGoal != null) {
    signals.push({
      id: 'leads-per-goal',
      label: 'Leads / goal',
      value: formatRate(leadsPerGoal, leadsPerGoal >= 10 ? 0 : 1),
      detail: 'New leads required per verified goal this period.',
      tone: leadsPerGoal > 20 ? 'warn' : 'muted',
      priority: leadsPerGoal > 20 ? 60 : 22,
      action: {
        label: leadsPerGoal > 20 ? 'Improve conversion' : 'View leads',
        href: leadsPerGoal > 20 ? campaignHref : leadsHref,
      },
    });
  }

  if (input.pendingApplications > 0) {
    signals.push({
      id: 'pending-apps',
      label: 'Hiring',
      value: `${input.pendingApplications} pending`,
      detail: 'Applications waiting on a decision.',
      tone: 'warn',
      priority: 50,
      action: { label: 'Review apps', href: appsHref },
    });
  } else if (input.activeSdrs === 0 && input.openCampaigns > 0) {
    signals.push({
      id: 'no-sdrs',
      label: 'Team',
      value: 'No active SDRs',
      detail: 'Open campaigns need accepted reps before dials start.',
      tone: 'bad',
      priority: 85,
      action: { label: 'Open hiring', href: appsHref },
    });
  } else if (input.activeSdrs > 0 && input.activeSdrs < 2 && budget.status !== 'exhausted') {
    signals.push({
      id: 'thin-team',
      label: 'Team',
      value: `${input.activeSdrs} SDR${input.activeSdrs === 1 ? '' : 's'}`,
      detail: 'Thin bench — add reps if lead runway and budget allow.',
      tone: 'muted',
      priority: 28,
      action: { label: 'Add SDRs', href: appsHref },
    });
  } else if (input.activeSdrs >= 2) {
    signals.push({
      id: 'team-ok',
      label: 'Team',
      value: `${input.activeSdrs} SDRs`,
      detail: 'Active accepted reps on this brand.',
      tone: 'good',
      priority: 12,
      action: { label: 'View team', href: teamHref },
    });
  }

  if (budget.status === 'uncapped' && input.openCampaigns > 0) {
    signals.push({
      id: 'set-budget',
      label: 'Budget',
      value: 'Uncapped',
      detail: 'Set a spend cap so runway and cost/goal stay predictable.',
      tone: 'muted',
      priority: 40,
      action: { label: 'Set budget', href: campaignHref },
    });
  }

  // Wallet fund shortcut when exhausted and settings is useful
  if (budget.status === 'exhausted') {
    signals.push({
      id: 'fund-wallet',
      label: 'Wallet',
      value: 'Needs funds',
      detail: 'Top up escrow so new awards can clear.',
      tone: 'warn',
      priority: 88,
      action: { label: 'Fund wallet', href: fundHref },
    });
  }

  signals.sort((a, b) => b.priority - a.priority);

  return {
    periodDays,
    leadVelocityPerDay,
    goalVelocityPerDay,
    costPerGoalCents,
    leadsPerGoal,
    dialReadyLeads: input.dialReadyLeads,
    avgCallsPerDay,
    leadRunwayDays,
    goalsInPeriod: input.goalsInPeriod,
    leadsCreatedInPeriod: input.leadsCreatedInPeriod,
    spendInPeriodCents: input.spendInPeriodCents,
    budget,
    signals,
    series: input.series || [],
    vitals,
  };
}

export function riskScore(economics: BrandEconomics): number {
  return economics.signals
    .filter((s) => s.tone === 'bad' || s.tone === 'warn')
    .reduce((sum, s) => sum + s.priority, 0);
}

export function topActions(economics: BrandEconomics, limit = 4): DeskSignal[] {
  return economics.signals
    .filter((s) => s.action && (s.tone === 'bad' || s.tone === 'warn' || s.priority >= 50))
    .slice(0, limit);
}
