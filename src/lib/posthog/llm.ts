import 'server-only';

import { randomUUID } from 'crypto';
import { captureServerEvent } from '@/lib/posthog/server';

export type AiGenerationInput = {
  distinctId?: string | null;
  traceId?: string;
  spanName?: string;
  model: string;
  provider?: string;
  latencySeconds: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Prefer short/redacted content — avoid full PII transcripts. */
  inputPreview?: string;
  outputPreview?: string;
  success?: boolean;
  error?: string;
  extra?: Record<string, unknown>;
};

/** Manual `$ai_generation` capture for raw fetch-based LLM clients (xAI). */
export function captureAiGeneration(opts: AiGenerationInput) {
  const distinctId = opts.distinctId || 'anonymous';
  captureServerEvent(distinctId, '$ai_generation', {
    $ai_trace_id: opts.traceId || randomUUID(),
    $ai_span_name: opts.spanName || 'llm_call',
    $ai_model: opts.model,
    $ai_provider: opts.provider || 'xai',
    $ai_latency: opts.latencySeconds,
    $ai_input_tokens: opts.inputTokens ?? undefined,
    $ai_output_tokens: opts.outputTokens ?? undefined,
    $ai_input: opts.inputPreview
      ? [{ role: 'user', content: opts.inputPreview }]
      : undefined,
    $ai_output_choices: opts.outputPreview
      ? [{ role: 'assistant', content: opts.outputPreview }]
      : undefined,
    $ai_http_status: opts.success === false ? 500 : 200,
    $ai_is_error: opts.success === false,
    $ai_error: opts.error,
    ...opts.extra,
  });
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function previewText(text: string, max = 400): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}
