/**
 * Browser ↔ xAI Realtime bridge (Cloudflare Durable Object).
 * One DO instance per training call.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

const TRANSFER_TOOL = {
  type: 'function',
  name: 'transfer_to_decision_maker',
  description:
    'Transfer to the owner/decision-maker. NEVER call on the opening greeting or before at least 3 back-and-forth exchanges. The caller must have given their name AND a specific business reason. Say a brief hold line first, then call this function.',
  parameters: { type: 'object', properties: {} },
};

const VOICES = {
  GATEKEEPER: 'Ara',
  BOSS: 'Sal',
} as const;

const XAI_REALTIME_URL = 'https://api.x.ai/v1/realtime?model=grok-voice-latest';

type Scenario = {
  twoStage?: boolean;
  systemPrompt?: string;
  gatekeeperPrompt?: string;
  bossPrompt?: string;
  companyName?: string;
  gatekeeperName?: string;
  decisionMakerName?: string;
  gatekeeperVoice?: string;
  bossVoice?: string;
};

type TranscriptEntry = {
  role: string;
  text: string;
  id: number;
  itemId?: string | null;
  responseId?: string | null;
};

function sendJson(ws: WebSocket, payload: unknown) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function normalizeRealtimeVoice(voice: string | undefined, fallback: string) {
  const v = (voice || fallback).toLowerCase();
  const map: Record<string, string> = {
    ara: 'Ara',
    eve: 'Eve',
    leo: 'Leo',
    rex: 'Rex',
    sal: 'Sal',
  };
  return map[v] || fallback;
}

async function connectXaiRealtime(apiKey: string): Promise<WebSocket> {
  const resp = await fetch(XAI_REALTIME_URL, {
    headers: {
      Upgrade: 'websocket',
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });
  const ws = resp.webSocket;
  if (!ws) {
    throw new Error(`xAI realtime handshake failed (${resp.status})`);
  }
  ws.accept();
  return ws;
}

export class TrainerSession extends DurableObject<Env> {
  private browserWs: WebSocket | null = null;
  private xaiWs: WebSocket | null = null;
  private xaiReady = false;
  private sessionStarted = false;
  private transcript: TranscriptEntry[] = [];
  private lastUserItemId: string | null = null;
  private lastProspectResponseId: string | null = null;
  private awaitingUserTranscript = false;
  private bufferedProspectTranscript: {
    role: string;
    text: string;
    responseId: string | null;
  } | null = null;
  private nextEntryId = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silencePromptCount = 0;
  private greetingComplete = false;
  private gatekeeperResponseCount = 0;
  private userTurnCount = 0;
  private endingCall = false;
  private pendingTransfer: { callId: string } | null = null;
  private pendingBossGreeting = false;
  private pendingSilenceResponse = false;
  private sessionDifficulty = 'medium';
  private hintMode = false;
  private prospectSpeaking = false;
  private audioStreamForResponse: string | null = null;
  private activeResponseId: string | null = null;
  private cancelledResponseIds = new Set<string>();
  private phase = 'prospect';
  private scenario: Scenario | null = null;

  private readonly SILENCE_PROMPT_MS = 9000;
  private readonly MAX_SILENCE_PROMPTS = 2;

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    if (!this.env.XAI_API_KEY) {
      return new Response('XAI_API_KEY is not configured', { status: 500 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    this.browserWs = server;

    server.addEventListener('message', (event: MessageEvent) => {
      void this.onBrowserMessage(event.data);
    });
    server.addEventListener('close', () => this.cleanup());
    server.addEventListener('error', () => this.cleanup());

    return new Response(null, { status: 101, webSocket: client });
  }

  private allocEntryId() {
    return ++this.nextEntryId;
  }

  private normalizeText(text: string) {
    return (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private wordOverlapRatio(a: string, b: string) {
    const wordsA = this.normalizeText(a)
      .split(' ')
      .filter((w) => w.length > 3);
    const wordsB = this.normalizeText(b)
      .split(' ')
      .filter((w) => w.length > 3);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;
    const setB = new Set(wordsB);
    let shared = 0;
    for (const w of wordsA) {
      if (setB.has(w)) shared += 1;
    }
    return shared / Math.min(wordsA.length, wordsB.length);
  }

  private isSimilarRepeat(nextText: string, prevText: string) {
    const next = this.normalizeText(nextText);
    const prev = this.normalizeText(prevText);
    if (!next || !prev) return false;
    if (next === prev) return true;

    const openNext = next.split(' ').slice(0, 7).join(' ');
    const openPrev = prev.split(' ').slice(0, 7).join(' ');
    if (openNext.length > 20 && openNext === openPrev) return true;

    if (/\bone at a time\b/.test(next) && /\bone at a time\b/.test(prev)) return true;

    const emailCta = /\b(email|send (the )?details|put it in an email)\b/;
    if (
      emailCta.test(next) &&
      emailCta.test(prev) &&
      this.wordOverlapRatio(nextText, prevText) >= 0.38
    ) {
      return true;
    }

    const tailNext = next.slice(-55);
    const tailPrev = prev.slice(-55);
    if (tailNext.length > 28 && tailPrev.length > 28) {
      const sharedTail = Math.min(tailNext.length, tailPrev.length);
      if (tailNext.slice(-sharedTail) === tailPrev.slice(-sharedTail)) return true;
    }

    return this.wordOverlapRatio(nextText, prevText) >= 0.55;
  }

  private displayText(text: string) {
    return (text || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/<\/?[a-z-]+>/gi, '')
      .replace(/\.([A-Za-z])/g, '. $1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private prospectRole() {
    if (!this.scenario?.twoStage) return 'prospect';
    return this.phase === 'gatekeeper' ? 'gatekeeper' : 'decision_maker';
  }

  private emitTranscript(
    role: string,
    text: string,
    { update = false, id = null as number | null } = {}
  ) {
    const clean = this.displayText(text);
    if (!clean || !this.browserWs) return;
    sendJson(this.browserWs, {
      type: 'transcript',
      role,
      text: clean,
      update,
      id,
      seq: id,
    });
  }

  private reserveUserTurn() {
    this.awaitingUserTranscript = true;
  }

  private upsertUserTranscript(text: string, itemId: string | null) {
    const normalized = this.normalizeText(text);
    if (!normalized) return;

    if (itemId && itemId === this.lastUserItemId) {
      const idx = this.transcript.findIndex((entry) => entry.itemId === itemId);
      if (idx >= 0) {
        this.transcript[idx].text = text;
        this.emitTranscript('user', text, {
          update: true,
          id: this.transcript[idx].id,
        });
        this.awaitingUserTranscript = false;
        this.flushBufferedProspectTranscript();
        return;
      }
    }

    const lastUser = [...this.transcript].reverse().find((entry) => entry.role === 'user');
    if (lastUser && this.normalizeText(lastUser.text) === normalized) {
      this.awaitingUserTranscript = false;
      this.flushBufferedProspectTranscript();
      return;
    }

    const id = this.allocEntryId();
    this.awaitingUserTranscript = false;
    this.lastUserItemId = itemId || null;
    this.transcript.push({ role: 'user', text, id, itemId: itemId || null });
    this.emitTranscript('user', text, { id });
    this.userTurnCount += 1;
    this.flushBufferedProspectTranscript();
  }

  private commitProspectTranscript(
    text: string,
    responseId: string | null,
    { force = false } = {}
  ) {
    const role = this.prospectRole();
    const normalized = this.normalizeText(text);
    if (!normalized) return;

    if (!force && this.awaitingUserTranscript) {
      if (this.sessionDifficulty === 'hard' && this.bufferedProspectTranscript) {
        this.flushBufferedProspectTranscript();
      }
      this.bufferedProspectTranscript = {
        role,
        text,
        responseId: responseId || null,
      };
      return;
    }

    if (responseId && responseId === this.lastProspectResponseId) {
      const idx = this.transcript.findIndex((entry) => entry.responseId === responseId);
      if (idx >= 0) {
        this.transcript[idx].text = text;
        this.emitTranscript(role, text, {
          update: true,
          id: this.transcript[idx].id,
        });
        return;
      }
    }

    const lastEntry = this.transcript[this.transcript.length - 1];
    if (lastEntry && lastEntry.role === role) {
      if (this.normalizeText(lastEntry.text) === normalized) return;
      if (this.isSimilarRepeat(text, lastEntry.text)) {
        const merged = text.length >= lastEntry.text.length ? text : lastEntry.text;
        lastEntry.text = merged;
        this.emitTranscript(role, merged, { update: true, id: lastEntry.id });
        return;
      }
    }

    const id = this.allocEntryId();
    this.lastProspectResponseId = responseId || null;
    this.transcript.push({ role, text, id, responseId: responseId || null });
    this.emitTranscript(role, text, { id });
    if (role === 'gatekeeper') this.gatekeeperResponseCount += 1;
  }

  private upsertProspectTranscript(text: string, responseId: string | null) {
    this.commitProspectTranscript(text, responseId);
  }

  private flushBufferedProspectTranscript() {
    if (!this.bufferedProspectTranscript) return;
    const { text, responseId } = this.bufferedProspectTranscript;
    this.bufferedProspectTranscript = null;
    this.commitProspectTranscript(text, responseId, { force: true });
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private endCallForSilence() {
    if (
      this.endingCall ||
      !this.xaiWs ||
      this.xaiWs.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    this.endingCall = true;
    this.clearSilenceTimer();

    const hangupLine =
      this.phase === 'gatekeeper'
        ? "[sigh] Okay, I can't hear you — I'm hanging up."
        : "[tsk] Alright, I've got to go. Goodbye.";

    this.xaiWs.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'force_message',
          role: 'assistant',
          interruptible: false,
          content: [{ type: 'output_text', text: hangupLine }],
        },
      })
    );

    if (this.browserWs) {
      sendJson(this.browserWs, { type: 'call.ended', reason: 'silence' });
    }

    setTimeout(() => {
      this.cleanup();
      try {
        this.browserWs?.close();
      } catch {
        /* ignore */
      }
    }, 3500);
  }

  private scheduleSilencePrompt() {
    if (
      this.awaitingUserTranscript ||
      this.endingCall ||
      this.pendingSilenceResponse
    ) {
      return;
    }
    const lastEntry = this.transcript[this.transcript.length - 1];
    if (!lastEntry || lastEntry.role === 'user') return;
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (
        !this.xaiWs ||
        this.xaiWs.readyState !== WebSocket.OPEN ||
        !this.xaiReady ||
        this.awaitingUserTranscript
      ) {
        return;
      }

      if (this.silencePromptCount >= this.MAX_SILENCE_PROMPTS) {
        this.endCallForSilence();
        return;
      }

      this.silencePromptCount += 1;
      this.pendingSilenceResponse = true;
      const annoyance =
        this.silencePromptCount >= this.MAX_SILENCE_PROMPTS
          ? 'This is your last chance before you hang up.'
          : 'Sound impatient, like you have other calls waiting.';

      this.xaiWs.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: `The caller has gone silent. ${annoyance} One short line only — e.g. "Hello? [pause] You still there?"`,
              },
            ],
          },
        })
      );
      this.xaiWs.send(JSON.stringify({ type: 'response.create' }));
    }, this.SILENCE_PROMPT_MS);
  }

  private completeTransfer() {
    if (
      !this.pendingTransfer ||
      !this.xaiWs ||
      this.xaiWs.readyState !== WebSocket.OPEN ||
      !this.scenario
    ) {
      return;
    }

    this.pendingTransfer = null;
    this.clearSilenceTimer();
    this.silencePromptCount = 0;
    this.pendingSilenceResponse = false;
    this.awaitingUserTranscript = false;
    this.bufferedProspectTranscript = null;
    this.lastProspectResponseId = null;

    this.phase = 'decision_maker';
    this.gatekeeperResponseCount = 0;

    if (this.browserWs) {
      sendJson(this.browserWs, { type: 'interrupt' });
      sendJson(this.browserWs, {
        type: 'phase',
        phase: 'decision_maker',
        label: this.scenario.decisionMakerName,
        gatekeeperVoice: this.scenario.gatekeeperVoice,
        bossVoice: this.scenario.bossVoice,
      });
    }

    this.pendingBossGreeting = true;

    this.xaiWs.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          instructions: this.scenario.bossPrompt,
          voice: normalizeRealtimeVoice(this.scenario.bossVoice, VOICES.BOSS),
          tools: [],
        },
      })
    );
  }

  private playBossGreeting() {
    if (
      !this.xaiWs ||
      this.xaiWs.readyState !== WebSocket.OPEN ||
      !this.pendingBossGreeting ||
      !this.scenario
    ) {
      return;
    }
    this.pendingBossGreeting = false;

    const bossGreeting = `Yeah, this is ${this.scenario.decisionMakerName}. ${this.scenario.gatekeeperName} said you had something — what's this about?`;
    this.xaiWs.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'force_message',
          role: 'assistant',
          interruptible: true,
          content: [{ type: 'output_text', text: bossGreeting }],
        },
      })
    );
  }

  private handleTransfer(callId: string) {
    if (
      !this.scenario?.twoStage ||
      this.phase !== 'gatekeeper' ||
      !this.xaiWs ||
      this.xaiWs.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    // Align with prompt + TRANSFER_TOOL: ≥3 gatekeeper exchanges and ≥2 user turns.
    // Hint mode softens to 2 GK / 1 user (matches scenario-prompt HINT MODE).
    const minGatekeeperResponses = this.hintMode ? 2 : 3;
    const minUserTurns = this.hintMode ? 1 : 2;
    if (
      this.gatekeeperResponseCount < minGatekeeperResponses ||
      this.userTurnCount < minUserTurns
    ) {
      this.xaiWs.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({
              success: false,
              transferred: false,
              reason:
                'Too early — keep screening. Ask who is calling and what this is regarding.',
            }),
          },
        })
      );

      this.xaiWs.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions:
              'Stay as the gatekeeper. Do NOT transfer yet. Continue screening — ask who is calling and what this is regarding. Require their name and a specific business reason before transferring.',
          },
        })
      );
      return;
    }

    this.pendingTransfer = { callId };

    this.xaiWs.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ success: true, transferred: true }),
        },
      })
    );
  }

  private cleanup() {
    this.clearSilenceTimer();
    try {
      if (this.xaiWs?.readyState === WebSocket.OPEN) this.xaiWs.close();
    } catch {
      /* ignore */
    }
    this.xaiWs = null;
    this.xaiReady = false;
  }

  private async fetchTrainerPrompt(config: Record<string, unknown>) {
    const origin = (this.env.APP_ORIGIN || '').replace(/\/$/, '');
    if (!origin) throw new Error('APP_ORIGIN is not configured');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.env.TRAINER_INTERNAL_SECRET) {
      headers['x-trainer-internal'] = this.env.TRAINER_INTERNAL_SECRET;
    }
    const res = await fetch(`${origin}/api/trainer/prompt`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `Prompt fetch failed (${res.status})`);
    }
    return (await res.json()) as Scenario;
  }

  private buildSessionConfig(
    instructions: string,
    voice: string,
    withTools: boolean
  ) {
    const config: Record<string, unknown> = {
      instructions,
      voice,
      reasoning: { effort: 'none' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 200,
        silence_duration_ms: 400,
        create_response: true,
      },
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'grok-latest' },
    };
    if (withTools) config.tools = [TRANSFER_TOOL];
    return config;
  }

  private onXaiMessage(rawData: string | ArrayBuffer) {
    if (!this.browserWs || !this.xaiWs || !this.scenario) return;

    let event: Record<string, unknown>;
    try {
      const text =
        typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData);
      event = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = event.type as string;
    const isTwoStage = !!this.scenario.twoStage;

    if (type === 'session.updated') {
      const session = event.session as { voice?: string } | undefined;
      const appliedVoice = session?.voice;

      if (this.pendingBossGreeting) {
        this.playBossGreeting();
      }

      if (!this.xaiReady) {
        this.xaiReady = true;

        sendJson(this.browserWs, {
          type: 'ready',
          twoStage: isTwoStage,
          phase: isTwoStage ? 'gatekeeper' : 'prospect',
          gatekeeperName: this.scenario.gatekeeperName,
          decisionMakerName: this.scenario.decisionMakerName,
          gatekeeperVoice: this.scenario.gatekeeperVoice,
          bossVoice: this.scenario.bossVoice,
          activeVoice: appliedVoice,
        });

        const greetingText = isTwoStage
          ? `Thank you for calling ${this.scenario.companyName}, this is ${this.scenario.gatekeeperName}. How can I help you?`
          : null;

        if (isTwoStage && greetingText) {
          this.xaiWs.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'force_message',
                role: 'assistant',
                interruptible: true,
                content: [{ type: 'output_text', text: greetingText }],
              },
            })
          );
        } else {
          this.xaiWs.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'system',
                content: [
                  {
                    type: 'input_text',
                    text: `A salesperson is cold-calling you right now. Answer with a brief natural greeting for ${this.scenario.companyName}.`,
                  },
                ],
              },
            })
          );
          this.xaiWs.send(JSON.stringify({ type: 'response.create' }));
        }
      }
      return;
    }

    if (type === 'response.function_call_arguments.done') {
      if (event.name === 'transfer_to_decision_maker') {
        this.handleTransfer(event.call_id as string);
      }
    }

    if (type === 'response.output_audio.delta' && event.delta) {
      const rid =
        (event.response_id as string) ||
        ((event.response as { id?: string } | undefined)?.id) ||
        this.activeResponseId;
      if (rid && this.cancelledResponseIds.has(rid)) return;
      if (this.audioStreamForResponse === 'audio') return;
      this.audioStreamForResponse = 'output_audio';
      sendJson(this.browserWs, { type: 'audio', audio: event.delta });
    }

    if (type === 'response.audio.delta' && event.delta) {
      const rid =
        (event.response_id as string) ||
        ((event.response as { id?: string } | undefined)?.id) ||
        this.activeResponseId;
      if (rid && this.cancelledResponseIds.has(rid)) return;
      if (this.audioStreamForResponse) return;
      this.audioStreamForResponse = 'audio';
      sendJson(this.browserWs, { type: 'audio', audio: event.delta });
    }

    if (type === 'input_audio_buffer.speech_started') {
      this.clearSilenceTimer();
      this.silencePromptCount = 0;
      this.pendingSilenceResponse = false;
      if (this.activeResponseId) {
        this.cancelledResponseIds.add(this.activeResponseId);
        try {
          this.xaiWs.send(JSON.stringify({ type: 'response.cancel' }));
        } catch {
          /* ignore */
        }
      }
      this.prospectSpeaking = false;
      this.audioStreamForResponse = null;
      sendJson(this.browserWs, { type: 'interrupt' });
      sendJson(this.browserWs, { type: 'user.speaking' });
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      if (!this.greetingComplete) return;
      this.clearSilenceTimer();
      sendJson(this.browserWs, { type: 'user.done' });
      this.reserveUserTurn();
    }

    if (type === 'response.created') {
      this.prospectSpeaking = true;
      this.audioStreamForResponse = null;
      this.activeResponseId =
        ((event.response as { id?: string } | undefined)?.id) || null;
      sendJson(this.browserWs, { type: 'prospect.speaking' });
      this.lastProspectResponseId = this.activeResponseId;
    }

    if (type === 'response.done') {
      const doneId =
        ((event.response as { id?: string } | undefined)?.id) ||
        this.activeResponseId;
      if (doneId) this.cancelledResponseIds.delete(doneId);
      this.activeResponseId = null;
      this.prospectSpeaking = false;
      sendJson(this.browserWs, { type: 'prospect.done' });
      if (this.pendingTransfer) {
        this.completeTransfer();
      }
      if (isTwoStage && this.phase === 'gatekeeper' && !this.greetingComplete) {
        this.greetingComplete = true;
        sendJson(this.browserWs, { type: 'gatekeeper.ready' });
        this.xaiWs.send(
          JSON.stringify({
            type: 'session.update',
            session: { tools: [TRANSFER_TOOL] },
          })
        );
      }
      if (
        this.greetingComplete &&
        !this.awaitingUserTranscript &&
        !this.endingCall &&
        !this.pendingSilenceResponse
      ) {
        const lastCommitted = this.transcript[this.transcript.length - 1];
        const isSilenceNudge =
          lastCommitted &&
          lastCommitted.role !== 'user' &&
          /\b(hello\?|you still there|still on the line|can't hear you)\b/i.test(
            lastCommitted.text
          );
        if (!isSilenceNudge) {
          this.scheduleSilencePrompt();
        }
      }
    }

    if (type === 'response.audio_transcript.done' && event.transcript) {
      const rid =
        (event.response_id as string) ||
        ((event.response as { id?: string } | undefined)?.id) ||
        null;
      if (rid && this.cancelledResponseIds.has(rid)) return;
      this.upsertProspectTranscript(event.transcript as string, rid);
      if (this.pendingSilenceResponse) this.pendingSilenceResponse = false;
    }

    if (
      type === 'conversation.item.input_audio_transcription.completed' &&
      event.transcript
    ) {
      this.upsertUserTranscript(
        event.transcript as string,
        (event.item_id as string) || null
      );
    }

    if (type === 'error') {
      const err = event.error as { message?: string } | undefined;
      console.error('[Trainer Realtime] xAI error:', JSON.stringify(err));
      sendJson(this.browserWs, {
        type: 'error',
        message: err?.message || 'xAI realtime error',
      });
    }
  }

  private async onBrowserMessage(raw: string | ArrayBuffer) {
    if (!this.browserWs) return;

    let msg: Record<string, unknown>;
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }

    if (msg.type === 'stop') {
      this.cleanup();
      this.browserWs.close();
      return;
    }

    if (msg.type === 'audio' && msg.audio) {
      if (this.xaiReady && this.xaiWs?.readyState === WebSocket.OPEN) {
        if (this.scenario?.twoStage && !this.greetingComplete) return;
        if (this.prospectSpeaking) return;
        this.xaiWs.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: msg.audio,
          })
        );
      }
      return;
    }

    if (msg.type !== 'start' || this.sessionStarted) return;
    this.sessionStarted = true;

    const leadId = msg.leadId;
    const prospectId = msg.prospectId;
    const difficulty = (msg.difficulty as string) || 'medium';
    const focus = (msg.focus as string) || 'standard';
    const hintMode = !!msg.hintMode;
    const voice = msg.voice as string | undefined;
    const msgGatekeeperVoice = msg.gatekeeperVoice as string | undefined;
    const msgBossVoice = msg.bossVoice as string | undefined;
    const brandId = msg.brandId as string | undefined;
    const packId = msg.packId as string | undefined;
    const playbookId = msg.playbookId as string | undefined;
    const gateToken = msg.gateToken as string | undefined;
    let userId = msg.userId as string | undefined;
    let orgId = msg.orgId as string | undefined;
    const prospectOverride = msg.prospectOverride as
      | Record<string, unknown>
      | undefined;
    this.sessionDifficulty = difficulty;
    this.hintMode = hintMode;

    try {
      // Minutes hard-stop: require a signed gate token verified against the Next.js app
      if (!gateToken) {
        sendJson(this.browserWs, {
          type: 'error',
          error: 'Session gate required. Refresh and try again.',
        });
        this.cleanup();
        this.browserWs.close();
        return;
      }
      const origin = (this.env.APP_ORIGIN || '').replace(/\/$/, '');
      if (!origin) {
        sendJson(this.browserWs, {
          type: 'error',
          error: 'Voice worker misconfigured (APP_ORIGIN). Contact support.',
        });
        this.cleanup();
        this.browserWs.close();
        return;
      }
      const gateRes = await fetch(
        `${origin}/api/trainer/session-gate?token=${encodeURIComponent(gateToken)}`
      );
      if (!gateRes.ok) {
        sendJson(this.browserWs, {
          type: 'error',
          error: 'No practice minutes left or gate expired. Upgrade to continue.',
        });
        this.cleanup();
        this.browserWs.close();
        return;
      }
      const gateData = (await gateRes.json().catch(() => ({}))) as {
        userId?: string;
        minutesRemaining?: number;
      };
      // Prefer signed gate identity over client-supplied userId
      if (gateData.userId) userId = gateData.userId;

      const [scenarioResult, connectedWs] = await Promise.all([
        this.fetchTrainerPrompt({
          leadId,
          prospectId: prospectId || leadId,
          difficulty,
          focus,
          hintMode,
          prospectOverride,
          brandId,
          packId,
          playbookId,
          userId,
          orgId,
        }),
        connectXaiRealtime(this.env.XAI_API_KEY),
      ]);

      this.scenario = scenarioResult;
      this.xaiWs = connectedWs;

      const isTwoStage = focus === 'standard' || !!this.scenario.twoStage;
      this.scenario.twoStage = isTwoStage;
      this.scenario.gatekeeperVoice =
        msgGatekeeperVoice || this.scenario.gatekeeperVoice || 'ara';
      this.scenario.bossVoice = msgBossVoice || this.scenario.bossVoice || 'sal';

      this.phase = isTwoStage ? 'gatekeeper' : 'prospect';

      let startVoice: string;
      let startPrompt: string;
      if (isTwoStage) {
        startVoice = normalizeRealtimeVoice(
          this.scenario.gatekeeperVoice,
          VOICES.GATEKEEPER
        );
        startPrompt =
          this.scenario.gatekeeperPrompt || this.scenario.systemPrompt || '';
      } else if (focus === 'gatekeeper') {
        startVoice = normalizeRealtimeVoice(
          msgGatekeeperVoice || voice,
          VOICES.GATEKEEPER
        );
        startPrompt = this.scenario.systemPrompt || '';
      } else {
        startVoice = normalizeRealtimeVoice(voice, 'Leo');
        startPrompt = this.scenario.systemPrompt || '';
      }

      this.xaiWs.send(
        JSON.stringify({
          type: 'session.update',
          session: this.buildSessionConfig(startPrompt, startVoice, false),
        })
      );

      this.xaiWs.addEventListener('message', (event: MessageEvent) => {
        this.onXaiMessage(event.data as string | ArrayBuffer);
      });
      this.xaiWs.addEventListener('close', () => {
        if (this.browserWs) sendJson(this.browserWs, { type: 'closed' });
      });
      this.xaiWs.addEventListener('error', () => {
        if (this.browserWs) {
          sendJson(this.browserWs, {
            type: 'error',
            message: 'xAI WebSocket error',
          });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Trainer Realtime] Setup failed:', message);
      sendJson(this.browserWs, { type: 'error', message });
      this.cleanup();
      this.browserWs.close();
    }
  }
}
