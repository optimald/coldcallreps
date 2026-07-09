/**
 * LLM Client — xAI Grok inference
 * Defaulting to grok-2-latest for high performance and native capabilities.
 *
 * Hardened with:
 * - Exponential backoff retry for 429 rate limits
 * - Token estimation guard to prevent context overflow
 * - LLM_DEEP_FREEZE error for total API failure
 */

const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.3';

const MAX_RETRIES = 3;
const MAX_ESTIMATED_TOKENS = 6000; // Leave 2k for output within 8k context

export interface LLMOptions {
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
}

/**
 * Run inference via xAI API.
 * Includes retry with exponential backoff for 429 rate limits.
 */
export async function runLLM(systemPrompt: string, userPrompt: string, options: LLMOptions = {}): Promise<string> {
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
        throw new Error('[LLM Client] XAI_API_KEY is not configured.');
    }

    // Token estimation guard — rough heuristic: 1 token ≈ 4 chars
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    if (estimatedTokens > MAX_ESTIMATED_TOKENS) {
        const maxChars = MAX_ESTIMATED_TOKENS * 4;
        userPrompt = userPrompt.slice(0, maxChars) + '\n[TRUNCATED — input exceeded context limit]';
    }

    let formatObj: { type: string } | undefined;
    if (options.jsonMode) {
        formatObj = { type: 'json_object' };
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const res = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${xaiKey}`,
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model: options.model || XAI_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: options.temperature ?? 0.1,
                    response_format: formatObj,
                })
            });
            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                return data.choices[0]?.message?.content || '';
            }

            // Handle rate limiting with exponential backoff
            if (res.status === 429) {
                const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[LLM Client] Rate limited (429). Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
            }

            // Non-retryable error
            const errText = await res.text();
            console.error(`[LLM Client] xAI API error (${res.status}):`, errText);
            throw new Error(`LLM inference failed (status ${res.status})`);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.warn(`[LLM Client] Timeout on attempt ${attempt + 1}/${MAX_RETRIES}`);
                continue;
            }
            throw err;
        }
    }

    // All retries exhausted — throw a distinguishable error
    throw new Error('LLM_DEEP_FREEZE: All retries exhausted — xAI rate limit or outage');
}
