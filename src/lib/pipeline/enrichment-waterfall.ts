/**
 * Phase 3 — phone-first enrichment waterfall.
 * Drops corporate email verification; focuses on direct lines + decision-maker titles.
 */

import { runLLM } from '@/lib/llm-client';
import { scrapeWebsiteHooks } from '@/lib/maps/scraper';
import { computeTrojanScore, serializeHooksPayload } from '@/lib/prospect-intel';
import { fetchAndScanWebsite } from '@/lib/pipeline/webscan-phones';

export type EnrichmentWaterfallResult = {
  phone: string | null;
  ownerName: string | null;
  ownerTitle: string | null;
  hooks: string[];
  hooksJSON: string;
  bookingUrlFound: string | null;
  confidence: number;
  stage: 'regex' | 'scrape' | 'llm' | 'exhausted';
};

async function llmPhoneEnrich(opts: {
  companyName: string;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  existingPhone?: string | null;
  pageSnippet?: string;
}): Promise<{ phone: string | null; ownerName: string | null; ownerTitle: string | null; hooks: string[] }> {
  if (!process.env.XAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return { phone: opts.existingPhone || null, ownerName: null, ownerTitle: null, hooks: [] };
  }

  try {
    // Prefer OpenRouter when set (handoff), else xAI via runLLM
    if (process.env.OPENROUTER_API_KEY) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com',
          'X-Title': 'ColdCallReps Enricher',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-70b-instruct',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Extract direct business phone lines, mobile routing hints, extensions, and decision-maker name/title for cold calling. Ignore email. Return JSON: { phone, ownerName, ownerTitle, hooks: string[] }',
            },
            {
              role: 'user',
              content: `Company: ${opts.companyName}
Location: ${[opts.city, opts.state].filter(Boolean).join(', ') || 'n/a'}
Website: ${opts.website || 'n/a'}
Known phone: ${opts.existingPhone || 'n/a'}
Page snippet:
${(opts.pageSnippet || '').slice(0, 4000)}`,
            },
          ],
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
        return {
          phone: parsed.phone ? String(parsed.phone) : opts.existingPhone || null,
          ownerName: parsed.ownerName ? String(parsed.ownerName) : null,
          ownerTitle: parsed.ownerTitle ? String(parsed.ownerTitle) : null,
          hooks: Array.isArray(parsed.hooks) ? parsed.hooks.map(String).slice(0, 5) : [],
        };
      }
    }

    const raw = await runLLM(
      'Extract direct business phone lines and decision-maker name/title for cold calling. Ignore email. Return JSON only.',
      `Company: ${opts.companyName}
Location: ${[opts.city, opts.state].filter(Boolean).join(', ') || 'n/a'}
Website: ${opts.website || 'n/a'}
Known phone: ${opts.existingPhone || 'n/a'}
Page snippet:
${(opts.pageSnippet || '').slice(0, 4000)}

Return: {"phone":string|null,"ownerName":string|null,"ownerTitle":string|null,"hooks":string[]}`,
      { jsonMode: true, temperature: 0.1 }
    );
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return {
      phone: parsed.phone ? String(parsed.phone) : opts.existingPhone || null,
      ownerName: parsed.ownerName ? String(parsed.ownerName) : null,
      ownerTitle: parsed.ownerTitle ? String(parsed.ownerTitle) : null,
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks.map(String).slice(0, 5) : [],
    };
  } catch {
    return { phone: opts.existingPhone || null, ownerName: null, ownerTitle: null, hooks: [] };
  }
}

export async function runEnrichmentWaterfall(opts: {
  companyName: string;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  existingPhone?: string | null;
  reviewCount?: number | null;
  reviewRating?: number | null;
}): Promise<EnrichmentWaterfallResult> {
  let phone = opts.existingPhone || null;
  let ownerName: string | null = null;
  let ownerTitle: string | null = null;
  let hooks: string[] = [];
  let bookingUrlFound: string | null = null;
  let stage: EnrichmentWaterfallResult['stage'] = 'exhausted';
  let confidence = 20;

  // Layer 1+2: phone webscan + existing CCR scrape hooks
  if (opts.website) {
    const scan = await fetchAndScanWebsite(opts.website);
    if (!phone && scan.phones[0]) {
      phone = scan.phones[0];
      stage = 'regex';
      confidence = 55;
    }
    bookingUrlFound = scan.bookingUrls[0] || null;
    if (scan.ownerTitleHint) ownerTitle = scan.ownerTitleHint;

    try {
      const scraped = await scrapeWebsiteHooks(opts.website, {
        reviewCount: opts.reviewCount,
        reviewRating: opts.reviewRating,
      });
      hooks = scraped.hooks.slice(0, 6);
      if (!phone && scraped.phones?.[0]) {
        phone = scraped.phones[0];
        stage = 'scrape';
        confidence = 65;
      }
      const intel = scraped.intel || {
        health: 0,
        score: computeTrojanScore(opts.reviewCount, 0, opts.reviewRating),
      };
      const llm = await llmPhoneEnrich({
        companyName: opts.companyName,
        website: opts.website,
        city: opts.city,
        state: opts.state,
        existingPhone: phone,
        pageSnippet: scraped.hooks.join('\n'),
      });
      if (llm.phone) {
        phone = llm.phone;
        stage = 'llm';
        confidence = Math.max(confidence, 78);
      }
      if (llm.ownerName) ownerName = llm.ownerName;
      if (llm.ownerTitle) ownerTitle = llm.ownerTitle;
      if (llm.hooks.length) hooks = [...new Set([...hooks, ...llm.hooks])].slice(0, 8);

      return {
        phone,
        ownerName,
        ownerTitle,
        hooks,
        hooksJSON: serializeHooksPayload(hooks, intel),
        bookingUrlFound,
        confidence,
        stage,
      };
    } catch {
      /* fall through */
    }
  }

  const llm = await llmPhoneEnrich({
    companyName: opts.companyName,
    website: opts.website,
    city: opts.city,
    state: opts.state,
    existingPhone: phone,
  });
  if (llm.phone) {
    phone = llm.phone;
    stage = 'llm';
    confidence = 70;
  }
  ownerName = llm.ownerName;
  ownerTitle = llm.ownerTitle;
  hooks = llm.hooks.length
    ? llm.hooks
    : [
        phone
          ? 'Direct line on file — confirm decision-maker on connect.'
          : 'No direct line yet — ask gatekeeper for the owner’s cell or best number.',
      ];

  return {
    phone,
    ownerName,
    ownerTitle,
    hooks,
    hooksJSON: serializeHooksPayload(hooks, {
      hasWebsite: Boolean(opts.website),
      health: phone ? 50 : 20,
      score: computeTrojanScore(opts.reviewCount, phone ? 50 : 20, opts.reviewRating),
      signals: phone ? ['Phone'] : ['No phone'],
    }),
    bookingUrlFound,
    confidence,
    stage: phone ? stage : 'exhausted',
  };
}
