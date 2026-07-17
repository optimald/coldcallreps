/**
 * One-shot PostHog project bootstrap:
 * - Feature flags for safe rollouts
 * - SDR + Brand funnel insights
 * - Dashboard linking those insights
 * - Session replay / heatmaps project settings (best-effort)
 *
 * Usage:
 *   POSTHOG_PERSONAL_API_KEY=phx_... POSTHOG_PROJECT_ID=515582 npx tsx scripts/setup-posthog.ts
 *
 * Get a personal API key: PostHog → avatar → Account settings → Personal API keys
 * (scopes: feature_flag:write, insight:write, dashboard:write, project:write)
 */

const HOST = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '515582';
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

if (!API_KEY) {
  console.error(
    'Missing POSTHOG_PERSONAL_API_KEY. Create one in PostHog → Account settings → Personal API keys.'
  );
  process.exit(1);
}

async function ph<T = unknown>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return json as T;
}

function funnelInsight(name: string, events: { event: string; name: string }[]) {
  return {
    name,
    description: `Auto-created by scripts/setup-posthog.ts`,
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        series: events.map((e) => ({
          kind: 'EventsNode',
          event: e.event,
          name: e.name,
        })),
        dateRange: { date_from: '-30d' },
      },
    },
    tags: ['coldcallreps', 'auto'],
  };
}

async function ensureFlag(key: string, name: string) {
  const list = await ph<{ results?: { key: string; id: number }[] }>(
    'GET',
    `/api/projects/${PROJECT_ID}/feature_flags/?search=${encodeURIComponent(key)}`
  );
  const existing = (list.results || []).find((f) => f.key === key);
  if (existing) {
    console.log(`flag exists: ${key} (#${existing.id})`);
    return existing.id;
  }
  const created = await ph<{ id: number }>('POST', `/api/projects/${PROJECT_ID}/feature_flags/`, {
    key,
    name,
    active: false,
    filters: {
      groups: [{ properties: [], rollout_percentage: 0 }],
    },
  });
  console.log(`flag created: ${key} (#${created.id}) — inactive at 0%`);
  return created.id;
}

async function createInsight(payload: Record<string, unknown>) {
  const created = await ph<{ id: number; short_id?: string }>(
    'POST',
    `/api/projects/${PROJECT_ID}/insights/`,
    payload
  );
  console.log(`insight: ${payload.name} (#${created.id})`);
  return created;
}

async function main() {
  console.log(`Bootstrapping PostHog project ${PROJECT_ID} @ ${HOST}`);

  await ensureFlag('new-onboarding-flow', 'New onboarding flow');
  await ensureFlag('practice-gate-v2', 'Practice gate v2');
  await ensureFlag('brand-desk-v2', 'Brand desk v2');

  const sdr = await createInsight(
    funnelInsight('SDR activation funnel', [
      { event: 'profile_created', name: 'Profile created' },
      { event: 'onboarding_role_selected', name: 'Role selected' },
      { event: 'onboarding_completed', name: 'Onboarding completed' },
      { event: 'practice_session_started', name: 'Practice started' },
      { event: 'practice_session_completed', name: 'Practice completed' },
      { event: 'practice_gate_cleared', name: 'Gate cleared' },
      { event: 'campaign_applied', name: 'Applied to campaign' },
      { event: 'live_call_started', name: 'Live call started' },
      { event: 'payout_received', name: 'Payout received' },
    ])
  );

  const brand = await createInsight(
    funnelInsight('Brand activation funnel', [
      { event: 'profile_created', name: 'Profile created' },
      { event: 'onboarding_completed', name: 'Onboarding completed' },
      { event: 'campaign_created', name: 'Campaign created' },
      { event: 'campaign_published', name: 'Campaign published' },
      { event: 'escrow_funded', name: 'Escrow funded' },
      { event: 'sdr_application_received', name: 'SDR applied' },
      { event: 'sdr_application_accepted', name: 'SDR accepted' },
      { event: 'appointment_verified', name: 'Appointment verified' },
      { event: 'payout_released', name: 'Payout released' },
    ])
  );

  const dropoff = await createInsight({
    name: 'Practice abandon rate',
    description: 'Started vs abandoned practice sessions',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          { kind: 'EventsNode', event: 'practice_session_started', name: 'Started' },
          { kind: 'EventsNode', event: 'practice_session_abandoned', name: 'Abandoned' },
          { kind: 'EventsNode', event: 'practice_session_completed', name: 'Completed' },
        ],
        dateRange: { date_from: '-30d' },
        interval: 'day',
      },
    },
    tags: ['coldcallreps', 'auto'],
  });

  const dash = await ph<{ id: number; short_id?: string }>(
    'POST',
    `/api/projects/${PROJECT_ID}/dashboards/`,
    {
      name: 'Cold Call Reps — Activation',
      description: 'SDR + Brand funnels (auto-created)',
      tags: ['coldcallreps', 'auto'],
      use_template: '',
    }
  );
  console.log(`dashboard: #${dash.id}`);

  for (const insight of [sdr, brand, dropoff]) {
    try {
      await ph('PATCH', `/api/projects/${PROJECT_ID}/insights/${insight.id}/`, {
        dashboards: [dash.id],
      });
    } catch (err) {
      console.warn(`Could not attach insight ${insight.id} to dashboard:`, err);
    }
  }

  // Best-effort: enable session recording capture for all users
  try {
    await ph('PATCH', `/api/projects/${PROJECT_ID}/`, {
      session_recording_opt_in: true,
      capture_performance_opt_in: true,
      heatmaps_opt_in: true,
      autocapture_opt_out: false,
    });
    console.log('project: session recording + heatmaps opted in');
  } catch (err) {
    console.warn('Could not patch project settings (need project:write):', err);
  }

  // Drop-off survey (shown via PostHog surveys SDK — enabled client-side)
  try {
    const surveys = await ph<{ results?: { name: string; id: string }[] }>(
      'GET',
      `/api/projects/${PROJECT_ID}/surveys/`
    );
    const exists = (surveys.results || []).some((s) => s.name === 'Why did you stop practicing?');
    if (!exists) {
      await ph('POST', `/api/projects/${PROJECT_ID}/surveys/`, {
        name: 'Why did you stop practicing?',
        type: 'popover',
        questions: [
          {
            type: 'single_choice',
            question: 'What stopped you from finishing practice?',
            choices: [
              'Too confusing',
              'Mic / audio issues',
              'Ran out of time',
              'Didn’t see the value',
              'Other',
            ],
          },
        ],
        conditions: {
          url: '/cold_calls',
          events: [{ name: 'practice_session_abandoned' }],
        },
        start_date: new Date().toISOString(),
      });
      console.log('survey: practice abandon feedback created');
    } else {
      console.log('survey exists: Why did you stop practicing?');
    }
  } catch (err) {
    console.warn('Could not create survey (need survey:write):', err);
  }

  console.log('\nDone.');
  console.log(`Open: ${HOST}/project/${PROJECT_ID}/dashboard/${dash.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
