'use client';

import { useEffect } from 'react';

type ToolExecuteResult = { content: Array<{ type: 'text'; text: string }> };

/**
 * WebMCP (navigator.modelContext) — registers discovery tools for agent browsers.
 * Safe no-op when the API is unavailable.
 */
export default function WebMcpBootstrap() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      modelContext?: {
        registerTool: (tool: {
          name: string;
          description: string;
          inputSchema: Record<string, unknown>;
          execute: (input: Record<string, unknown>) => Promise<ToolExecuteResult>;
        }) => void | (() => void);
      };
    };
    if (!nav.modelContext?.registerTool) return;

    const cleanups: Array<void | (() => void)> = [];

    const register = (
      name: string,
      description: string,
      inputSchema: Record<string, unknown>,
      execute: (input: Record<string, unknown>) => Promise<ToolExecuteResult>
    ) => {
      try {
        const maybeCleanup = nav.modelContext!.registerTool({
          name,
          description,
          inputSchema,
          execute,
        });
        cleanups.push(maybeCleanup);
      } catch {
        /* API shape may differ across browsers */
      }
    };

    register(
      'ccr_overview',
      'Return Cold Call Reps product overview URLs for agents.',
      { type: 'object', properties: {} },
      async () => ({
        content: [
          {
            type: 'text',
            text: [
              'Cold Call Reps is the human SDR recruiting marketplace for cold outreach.',
              'Docs: https://coldcallreps.com/llms.txt',
              'Reps path: https://coldcallreps.com/for/reps',
              'Hire / get hired: https://coldcallreps.com/hire-cold-callers',
              'Guides: https://coldcallreps.com/guides',
              'Signup (MarketPounce Clerk): https://www.marketpounce.com/sign-up?role=REP&from=ccr',
            ].join('\n'),
          },
        ],
      })
    );

    register(
      'find_guide',
      'Find a Cold Call Reps guide by topic keyword.',
      {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic keyword (e.g. hire, gigs, practice, approval)',
          },
        },
        required: ['topic'],
      },
      async (input) => {
        const topic = String(input.topic || '').toLowerCase();
        const hub = 'https://coldcallreps.com/guides';
        const mp = 'https://www.marketpounce.com/guides';
        const map: Record<string, string> = {
          hire: 'https://coldcallreps.com/hire-cold-callers',
          gig: `${hub}/cold-calling-gigs`,
          practice: `${hub}/ai-cold-call-practice`,
          approval: `${hub}/sdr-applications-and-approval`,
          paid: `${hub}/get-paid-per-meeting-cold-calling`,
          fee: `${mp}/platform-fees-and-payouts`,
          escrow: `${mp}/campaign-escrow-and-claims`,
          campaign: `${mp}/how-campaigns-work`,
        };
        const hit = Object.entries(map).find(([k]) => topic.includes(k));
        return {
          content: [
            {
              type: 'text',
              text: hit ? `Guide: ${hit[1]}` : `Browse guides: ${hub}`,
            },
          ],
        };
      }
    );

    return () => {
      for (const c of cleanups) {
        if (typeof c === 'function') c();
      }
    };
  }, []);

  return null;
}
