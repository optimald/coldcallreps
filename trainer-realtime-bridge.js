/**
 * Browser ↔ xAI Realtime bridge for the Cold Call Trainer.
 * Standard scenario: gatekeeper (Ara) → transfer → decision maker (Sal).
 */

const TRANSFER_TOOL = {
    type: 'function',
    name: 'transfer_to_decision_maker',
    description:
        'Transfer to the owner/decision-maker. NEVER call on the opening greeting or before at least 3 back-and-forth exchanges. The caller must have given their name AND a specific business reason. Say a brief hold line first, then call this function.',
    parameters: { type: 'object', properties: {} },
};

// xAI Realtime requires capitalized voice names: Ara/Eve (F), Leo/Rex/Sal (M)
const VOICES = {
    GATEKEEPER: 'Ara',
    BOSS: 'Sal',
};

function sendJson(ws, payload) {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function normalizeRealtimeVoice(voice, fallback = VOICES.GATEKEEPER) {
    const v = (voice || fallback).toLowerCase();
    const map = { ara: 'Ara', eve: 'Eve', leo: 'Leo', rex: 'Rex', sal: 'Sal' };
    return map[v] || fallback;
}

async function fetchTrainerPrompt(port, config) {
    // Match Cloudflare worker: prompt route requires Clerk session OR x-trainer-internal.
    // The bridge has no browser cookies, so auth via TRAINER_INTERNAL_SECRET / CRON_SECRET.
    const headers = { 'Content-Type': 'application/json' };
    const internal =
        process.env.TRAINER_INTERNAL_SECRET || process.env.CRON_SECRET || '';
    if (internal) {
        headers['x-trainer-internal'] = internal;
    }

    const res = await fetch(`http://127.0.0.1:${port}/api/trainer/prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Prompt fetch failed (${res.status})`);
    }
    return res.json();
}

function handleTrainerRealtime(browserWs, port, WebSocket) {
    const xaiApiKey = process.env.XAI_API_KEY;
    if (!xaiApiKey) {
        sendJson(browserWs, { type: 'error', message: 'XAI_API_KEY is not configured' });
        browserWs.close();
        return;
    }

    let xaiWs = null;
    let xaiReady = false;
    let sessionStarted = false;
    const transcript = [];
    let lastUserItemId = null;
    let lastProspectResponseId = null;
    let awaitingUserTranscript = false;
    let bufferedProspectTranscript = null;
    let nextEntryId = 0;
    let silenceTimer = null;
    let silencePromptCount = 0;
    let greetingComplete = false;
    let gatekeeperResponseCount = 0;
    let userTurnCount = 0;
    let endingCall = false;
    let pendingTransfer = null;
    let pendingBossGreeting = false;
    let pendingSilenceResponse = false;
    let sessionDifficulty = 'medium';
    let sessionHintMode = false;
    let prospectSpeaking = false;
    let audioStreamForResponse = null;
    let activeResponseId = null;
    const cancelledResponseIds = new Set();
    let audioChunksSent = 0;
    let audioPcmBytesSent = 0;
    let greetingBargeInTimer = null;

    let phase = 'prospect';
    let scenario = null;

    const SILENCE_PROMPT_MS = 9000;
    const MAX_SILENCE_PROMPTS = 2;

    function pcmMsFromBytes(bytes) {
        // pcm16 mono @ 24kHz
        return Math.round((bytes / 2 / 24000) * 1000);
    }

    function base64DecodedBytes(b64) {
        if (!b64) return 0;
        const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
    }

    function openGreetingBargeIn(pcmMs) {
        if (greetingComplete) return;
        const holdMs = Math.max(2800, Math.min(9000, (pcmMs || 0) + 600));
        console.log(
            `[Trainer Realtime] greeting audio committed — holding barge-in ${holdMs}ms (pcmMs=${pcmMs || 0})`
        );
        if (greetingBargeInTimer) clearTimeout(greetingBargeInTimer);
        greetingBargeInTimer = setTimeout(() => {
            greetingBargeInTimer = null;
            if (greetingComplete || endingCall) return;
            greetingComplete = true;
            console.log('[Trainer Realtime] greeting barge-in open');
            try {
                xaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
            } catch {
                /* ignore */
            }
            sendJson(browserWs, { type: 'gatekeeper.ready' });
            try {
                xaiWs.send(JSON.stringify({
                    type: 'session.update',
                    session: { tools: [TRANSFER_TOOL] },
                }));
            } catch {
                /* ignore */
            }
        }, holdMs);
    }

    function allocEntryId() {
        return ++nextEntryId;
    }

    function normalizeText(text) {
        return (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function wordOverlapRatio(a, b) {
        const wordsA = normalizeText(a).split(' ').filter((w) => w.length > 3);
        const wordsB = normalizeText(b).split(' ').filter((w) => w.length > 3);
        if (wordsA.length === 0 || wordsB.length === 0) return 0;
        const setB = new Set(wordsB);
        let shared = 0;
        for (const w of wordsA) {
            if (setB.has(w)) shared += 1;
        }
        return shared / Math.min(wordsA.length, wordsB.length);
    }

    function isSimilarRepeat(nextText, prevText) {
        const next = normalizeText(nextText);
        const prev = normalizeText(prevText);
        if (!next || !prev) return false;
        if (next === prev) return true;

        const openNext = next.split(' ').slice(0, 7).join(' ');
        const openPrev = prev.split(' ').slice(0, 7).join(' ');
        if (openNext.length > 20 && openNext === openPrev) return true;

        if (/\bone at a time\b/.test(next) && /\bone at a time\b/.test(prev)) return true;

        const emailCta = /\b(email|send (the )?details|put it in an email)\b/;
        if (emailCta.test(next) && emailCta.test(prev) && wordOverlapRatio(nextText, prevText) >= 0.38) {
            return true;
        }

        const tailNext = next.slice(-55);
        const tailPrev = prev.slice(-55);
        if (tailNext.length > 28 && tailPrev.length > 28) {
            const sharedTail = Math.min(tailNext.length, tailPrev.length);
            if (tailNext.slice(-sharedTail) === tailPrev.slice(-sharedTail)) return true;
        }

        return wordOverlapRatio(nextText, prevText) >= 0.55;
    }

    function displayText(text) {
        return (text || '')
            .replace(/\[[^\]]+\]/g, '')
            .replace(/<\/?[a-z-]+>/gi, '')
            .replace(/\.([A-Za-z])/g, '. $1')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function prospectRole() {
        if (!scenario?.twoStage) return 'prospect';
        return phase === 'gatekeeper' ? 'gatekeeper' : 'decision_maker';
    }

    function emitTranscript(role, text, { update = false, id = null } = {}) {
        const clean = displayText(text);
        if (!clean) return;
        sendJson(browserWs, { type: 'transcript', role, text: clean, update, id, seq: id });
    }

    function reserveUserTurn() {
        awaitingUserTranscript = true;
    }

    function upsertUserTranscript(text, itemId) {
        const normalized = normalizeText(text);
        if (!normalized) return;

        if (itemId && itemId === lastUserItemId) {
            const idx = transcript.findIndex((entry) => entry.itemId === itemId);
            if (idx >= 0) {
                transcript[idx].text = text;
                emitTranscript('user', text, { update: true, id: transcript[idx].id });
                awaitingUserTranscript = false;
                flushBufferedProspectTranscript();
                return;
            }
        }

        const lastUser = [...transcript].reverse().find((entry) => entry.role === 'user');
        if (lastUser && normalizeText(lastUser.text) === normalized) {
            awaitingUserTranscript = false;
            flushBufferedProspectTranscript();
            return;
        }

        const id = allocEntryId();
        awaitingUserTranscript = false;
        lastUserItemId = itemId || null;
        transcript.push({ role: 'user', text, id, itemId: itemId || null });
        emitTranscript('user', text, { id });
        userTurnCount += 1;
        flushBufferedProspectTranscript();
    }

    function commitProspectTranscript(text, responseId, { force = false } = {}) {
        const role = prospectRole();
        const normalized = normalizeText(text);
        if (!normalized) return;

        if (!force && awaitingUserTranscript) {
            if (sessionDifficulty === 'hard' && bufferedProspectTranscript) {
                flushBufferedProspectTranscript();
            }
            bufferedProspectTranscript = { role, text, responseId: responseId || null };
            return;
        }

        if (responseId && responseId === lastProspectResponseId) {
            const idx = transcript.findIndex((entry) => entry.responseId === responseId);
            if (idx >= 0) {
                transcript[idx].text = text;
                emitTranscript(role, text, { update: true, id: transcript[idx].id });
                return;
            }
        }

        const lastEntry = transcript[transcript.length - 1];
        if (lastEntry && lastEntry.role === role) {
            if (normalizeText(lastEntry.text) === normalized) return;
            if (isSimilarRepeat(text, lastEntry.text)) {
                const merged = text.length >= lastEntry.text.length ? text : lastEntry.text;
                lastEntry.text = merged;
                emitTranscript(role, merged, { update: true, id: lastEntry.id });
                return;
            }
        }

        const id = allocEntryId();
        lastProspectResponseId = responseId || null;
        transcript.push({ role, text, id, responseId: responseId || null });
        emitTranscript(role, text, { id });
        if (role === 'gatekeeper') gatekeeperResponseCount += 1;
    }

    function upsertProspectTranscript(text, responseId) {
        commitProspectTranscript(text, responseId);
    }

    function flushBufferedProspectTranscript() {
        if (!bufferedProspectTranscript) return;
        const { text, responseId } = bufferedProspectTranscript;
        bufferedProspectTranscript = null;
        commitProspectTranscript(text, responseId, { force: true });
    }

    function clearSilenceTimer() {
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
    }

    function endCallForSilence() {
        if (endingCall || !xaiWs || xaiWs.readyState !== WebSocket.OPEN) return;
        endingCall = true;
        clearSilenceTimer();

        const hangupLine = phase === 'gatekeeper'
            ? "[sigh] Okay, I can't hear you — I'm hanging up."
            : "[tsk] Alright, I've got to go. Goodbye.";

        xaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'force_message',
                role: 'assistant',
                interruptible: false,
                content: [{ type: 'output_text', text: hangupLine }],
            },
        }));

        sendJson(browserWs, { type: 'call.ended', reason: 'silence' });

        setTimeout(() => {
            cleanup();
            try {
                browserWs.close();
            } catch {
                /* ignore */
            }
        }, 3500);
    }

    function scheduleSilencePrompt() {
        if (awaitingUserTranscript || endingCall || pendingSilenceResponse) return;
        const lastEntry = transcript[transcript.length - 1];
        if (!lastEntry || lastEntry.role === 'user') return;
        clearSilenceTimer();
        silenceTimer = setTimeout(() => {
            if (!xaiWs || xaiWs.readyState !== WebSocket.OPEN || !xaiReady || awaitingUserTranscript) return;

            if (silencePromptCount >= MAX_SILENCE_PROMPTS) {
                endCallForSilence();
                return;
            }

            silencePromptCount += 1;
            pendingSilenceResponse = true;
            const annoyance =
                silencePromptCount >= MAX_SILENCE_PROMPTS
                    ? 'This is your last chance before you hang up.'
                    : 'Sound impatient, like you have other calls waiting.';

            xaiWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'system',
                    content: [{
                        type: 'input_text',
                        text: `The caller has gone silent. ${annoyance} One short line only — e.g. "Hello? [pause] You still there?"`,
                    }],
                },
            }));
            xaiWs.send(JSON.stringify({ type: 'response.create' }));
        }, SILENCE_PROMPT_MS);
    }

    function completeTransfer() {
        if (!pendingTransfer || !xaiWs || xaiWs.readyState !== WebSocket.OPEN) return;

        pendingTransfer = null;
        clearSilenceTimer();
        silencePromptCount = 0;
        pendingSilenceResponse = false;
        awaitingUserTranscript = false;
        bufferedProspectTranscript = null;
        lastProspectResponseId = null;

        phase = 'decision_maker';
        gatekeeperResponseCount = 0;

        sendJson(browserWs, { type: 'interrupt' });
        sendJson(browserWs, {
            type: 'phase',
            phase: 'decision_maker',
            label: scenario.decisionMakerName,
            gatekeeperVoice: scenario.gatekeeperVoice,
            bossVoice: scenario.bossVoice,
        });

        pendingBossGreeting = true;

        xaiWs.send(JSON.stringify({
            type: 'session.update',
            session: {
                instructions: scenario.bossPrompt,
                voice: normalizeRealtimeVoice(scenario.bossVoice, VOICES.BOSS),
                tools: [],
            },
        }));

        console.log('[Trainer Realtime] Transfer approved — switching to boss voice');
    }

    function playBossGreeting() {
        if (!xaiWs || xaiWs.readyState !== WebSocket.OPEN || !pendingBossGreeting) return;
        pendingBossGreeting = false;

        const bossGreeting = `Yeah, this is ${scenario.decisionMakerName}. ${scenario.gatekeeperName} said you had something — what's this about?`;
        xaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'force_message',
                role: 'assistant',
                interruptible: true,
                content: [{ type: 'output_text', text: bossGreeting }],
            },
        }));

        console.log('[Trainer Realtime] Boss pickup line sent');
    }

    function handleTransfer(callId) {
        if (!scenario?.twoStage || phase !== 'gatekeeper' || !xaiWs || xaiWs.readyState !== WebSocket.OPEN) {
            return;
        }

        // Align with prompt: ≥3 GK / ≥2 user; hint mode softens to 2 / 1
        const minGatekeeperResponses = sessionHintMode ? 2 : 3;
        const minUserTurns = sessionHintMode ? 1 : 2;
        if (gatekeeperResponseCount < minGatekeeperResponses || userTurnCount < minUserTurns) {
            console.log(
                `[Trainer Realtime] Transfer REJECTED (gatekeeper=${gatekeeperResponseCount}, user=${userTurnCount}, hint=${sessionHintMode})`
            );

            xaiWs.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({
                        success: false,
                        transferred: false,
                        reason: 'Too early — keep screening. Ask who is calling and what this is regarding.',
                    }),
                },
            }));

            xaiWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                    instructions:
                        'Stay as the gatekeeper. Do NOT transfer yet. Continue screening — ask who is calling and what this is regarding. Require their name and a specific business reason before transferring.',
                },
            }));
            return;
        }

        console.log('[Trainer Realtime] Transfer APPROVED — finishing gatekeeper line first');
        pendingTransfer = { callId };

        xaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ success: true, transferred: true }),
            },
        }));
    }

    function cleanup() {
        clearSilenceTimer();
        if (greetingBargeInTimer) {
            clearTimeout(greetingBargeInTimer);
            greetingBargeInTimer = null;
        }
        try {
            if (xaiWs?.readyState === WebSocket.OPEN) xaiWs.close();
        } catch {
            /* ignore */
        }
        xaiWs = null;
    }

    browserWs.on('message', async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (msg.type === 'stop') {
            cleanup();
            browserWs.close();
            return;
        }

        if (msg.type === 'audio' && msg.audio) {
            if (xaiReady && xaiWs?.readyState === WebSocket.OPEN) {
                if (scenario?.twoStage && !greetingComplete) return;
                // Half-duplex: never feed mic to xAI while prospect TTS is playing (prevents echo → false user turn)
                if (prospectSpeaking) return;
                xaiWs.send(JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: msg.audio,
                }));
            }
            return;
        }

        if (msg.type !== 'start' || sessionStarted) return;
        sessionStarted = true;

        const { leadId, prospectId, difficulty = 'medium', focus = 'standard', hintMode = false, voice, gatekeeperVoice: msgGatekeeperVoice, bossVoice: msgBossVoice, prospectOverride, brandId, packId, playbookId, gateToken, userId: msgUserId, orgId: msgOrgId } = msg;
        sessionDifficulty = difficulty;
        sessionHintMode = !!hintMode;

        try {
            // Enforce session gate in local bridge (parity with production worker)
            if (!gateToken) {
                sendJson(browserWs, { type: 'error', error: 'Session gate required. Refresh and try again.' });
                cleanup();
                browserWs.close();
                return;
            }
            const gateRes = await fetch(`http://127.0.0.1:${port}/api/trainer/session-gate?token=${encodeURIComponent(gateToken)}`);
            if (!gateRes.ok) {
                sendJson(browserWs, { type: 'error', error: 'No practice minutes left or gate expired. Upgrade to continue.' });
                cleanup();
                browserWs.close();
                return;
            }
            const gateData = await gateRes.json().catch(() => ({}));
            const userId = gateData.userId || msgUserId;
            const orgId = msgOrgId;

            const xaiWsPromise = new Promise((resolve, reject) => {
                const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-voice-latest', {
                    headers: {
                        Authorization: `Bearer ${xaiApiKey}`,
                        'OpenAI-Beta': 'realtime=v1',
                    },
                });
                ws.on('open', () => resolve(ws));
                ws.on('error', (err) => reject(err));
            });

            const [scenarioResult, connectedWs] = await Promise.all([
                fetchTrainerPrompt(port, {
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
                xaiWsPromise,
            ]);

            scenario = scenarioResult;
            xaiWs = connectedWs;

            const isTwoStage = focus === 'standard' || !!scenario.twoStage;
            scenario.twoStage = isTwoStage;
            scenario.gatekeeperVoice = msgGatekeeperVoice || scenario.gatekeeperVoice || 'ara';
            scenario.bossVoice = msgBossVoice || scenario.bossVoice || 'sal';

            phase = isTwoStage ? 'gatekeeper' : 'prospect';

            let startVoice;
            let startPrompt;
            if (isTwoStage) {
                startVoice = normalizeRealtimeVoice(scenario.gatekeeperVoice, VOICES.GATEKEEPER);
                startPrompt = scenario.gatekeeperPrompt || scenario.systemPrompt;
            } else if (focus === 'gatekeeper') {
                startVoice = normalizeRealtimeVoice(msgGatekeeperVoice || voice, VOICES.GATEKEEPER);
                startPrompt = scenario.systemPrompt;
            } else {
                startVoice = normalizeRealtimeVoice(msg.voice, 'Leo');
                startPrompt = scenario.systemPrompt;
            }

            console.log(`[Trainer Realtime] focus=${focus} twoStage=${isTwoStage} voice=${startVoice} gk=${scenario.gatekeeperVoice} boss=${scenario.bossVoice}`);

            let activeVoice = startVoice;

            function buildSessionConfig(instructions, voice, withTools) {
                const config = {
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

            xaiWs.send(JSON.stringify({
                type: 'session.update',
                session: buildSessionConfig(startPrompt, startVoice, false),
            }));

            xaiWs.on('message', (rawData) => {
                let event;
                try {
                    event = JSON.parse(rawData.toString());
                } catch {
                    return;
                }

                if (event.type === 'session.updated') {
                    const appliedVoice = event.session?.voice;
                    if (appliedVoice) activeVoice = appliedVoice;
                    console.log(`[Trainer Realtime] session.updated voice=${appliedVoice || 'unknown'}`);

                    if (pendingBossGreeting) {
                        playBossGreeting();
                    }

                    if (!xaiReady) {
                        xaiReady = true;

                        sendJson(browserWs, {
                            type: 'ready',
                            twoStage: isTwoStage,
                            phase: isTwoStage ? 'gatekeeper' : 'prospect',
                            gatekeeperName: scenario.gatekeeperName,
                            decisionMakerName: scenario.decisionMakerName,
                            gatekeeperVoice: scenario.gatekeeperVoice,
                            bossVoice: scenario.bossVoice,
                            activeVoice,
                        });

                        const greetingText = isTwoStage
                            ? `Thank you for calling ${scenario.companyName}, this is ${scenario.gatekeeperName}. How can I help you?`
                            : null;

                        if (isTwoStage && greetingText) {
                            xaiWs.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'force_message',
                                    role: 'assistant',
                                    // Opening IVR line must finish — barge-in was cutting "Thank you…" mid-word
                                    interruptible: false,
                                    content: [{ type: 'output_text', text: greetingText }],
                                },
                            }));
                        } else {
                            xaiWs.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'message',
                                    role: 'system',
                                    content: [{
                                        type: 'input_text',
                                        text: `A salesperson is cold-calling you right now. Answer with a brief natural greeting for ${scenario.companyName}.`,
                                    }],
                                },
                            }));
                            xaiWs.send(JSON.stringify({ type: 'response.create' }));
                        }
                    }
                    return;
                }

                if (event.type === 'response.function_call_arguments.done') {
                    if (event.name === 'transfer_to_decision_maker') {
                        handleTransfer(event.call_id);
                    }
                }

                // Prefer output_audio (current xAI/OpenAI name). Never lock out
                // output_audio just because a legacy audio.delta arrived first —
                // that dropped the rest of TTS after "Thank yo…".
                if (event.type === 'response.output_audio.delta' && event.delta) {
                    const rid = event.response_id || event.response?.id || activeResponseId;
                    if (rid && cancelledResponseIds.has(rid)) return;
                    audioStreamForResponse = 'output_audio';
                    audioChunksSent += 1;
                    audioPcmBytesSent += base64DecodedBytes(event.delta);
                    sendJson(browserWs, { type: 'audio', audio: event.delta });
                } else if (event.type === 'response.audio.delta' && event.delta) {
                    const rid = event.response_id || event.response?.id || activeResponseId;
                    if (rid && cancelledResponseIds.has(rid)) return;
                    if (audioStreamForResponse === 'output_audio') return;
                    audioStreamForResponse = 'audio';
                    audioChunksSent += 1;
                    audioPcmBytesSent += base64DecodedBytes(event.delta);
                    sendJson(browserWs, { type: 'audio', audio: event.delta });
                }

                if (event.type === 'input_audio_buffer.speech_started') {
                    // Ignore barge-in until greeting audio has had time to finish playing.
                    // response.done fires when TTS is *sent*, not when the browser finished playing —
                    // opening the mic early lets speaker echo cancel the rest of the intro.
                    if (!greetingComplete) {
                        console.log('[Trainer Realtime] speech_started ignored (greeting still playing)');
                        return;
                    }
                    console.log('[Trainer Realtime] speech_started → interrupt');
                    clearSilenceTimer();
                    silencePromptCount = 0;
                    pendingSilenceResponse = false;
                    if (activeResponseId) {
                        cancelledResponseIds.add(activeResponseId);
                        try {
                            xaiWs.send(JSON.stringify({ type: 'response.cancel' }));
                        } catch {
                            /* ignore */
                        }
                    }
                    prospectSpeaking = false;
                    audioStreamForResponse = null;
                    sendJson(browserWs, { type: 'interrupt' });
                    sendJson(browserWs, { type: 'user.speaking' });
                }

                if (event.type === 'input_audio_buffer.speech_stopped') {
                    if (!greetingComplete) return;
                    clearSilenceTimer();
                    sendJson(browserWs, { type: 'user.done' });
                    reserveUserTurn();
                }

                if (event.type === 'response.created') {
                    prospectSpeaking = true;
                    audioStreamForResponse = null;
                    audioChunksSent = 0;
                    audioPcmBytesSent = 0;
                    activeResponseId = event.response?.id || null;
                    sendJson(browserWs, { type: 'prospect.speaking' });
                    lastProspectResponseId = activeResponseId;
                }

                if (event.type === 'response.done') {
                    const doneId = event.response?.id || activeResponseId;
                    const pcmMs = pcmMsFromBytes(audioPcmBytesSent);
                    console.log(
                        `[Trainer Realtime] response.done chunks=${audioChunksSent} pcmMs=${pcmMs} stream=${audioStreamForResponse || 'none'} status=${event.response?.status || '?'}`
                    );
                    if (doneId) cancelledResponseIds.delete(doneId);
                    activeResponseId = null;
                    prospectSpeaking = false;
                    sendJson(browserWs, { type: 'prospect.done', pcmMs });
                    if (pendingTransfer) {
                        completeTransfer();
                    }
                    if (isTwoStage && phase === 'gatekeeper' && !greetingComplete && !greetingBargeInTimer) {
                        openGreetingBargeIn(pcmMs);
                    }
                    if (greetingComplete && !awaitingUserTranscript && !endingCall && !pendingSilenceResponse) {
                        const lastCommitted = transcript[transcript.length - 1];
                        const isSilenceNudge =
                            lastCommitted &&
                            lastCommitted.role !== 'user' &&
                            /\b(hello\?|you still there|still on the line|can't hear you)\b/i.test(lastCommitted.text);
                        if (!isSilenceNudge) {
                            scheduleSilencePrompt();
                        }
                    }
                }

                if (event.type === 'response.audio_transcript.done' && event.transcript) {
                    const rid = event.response_id || event.response?.id || null;
                    if (rid && cancelledResponseIds.has(rid)) return;
                    upsertProspectTranscript(event.transcript, rid);
                    if (pendingSilenceResponse) pendingSilenceResponse = false;
                }

                if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
                    upsertUserTranscript(event.transcript, event.item_id || null);
                }

                if (event.type === 'error') {
                    const errMsg = event.error?.message || 'xAI realtime error';
                    // Benign: we sometimes cancel after the response already finished (greeting barge-in echo).
                    if (/cancellation failed|no active response/i.test(errMsg)) {
                        console.log('[Trainer Realtime] ignoring benign cancel error:', errMsg);
                        return;
                    }
                    console.error('[Trainer Realtime] xAI error:', JSON.stringify(event.error));
                    sendJson(browserWs, {
                        type: 'error',
                        message: errMsg,
                    });
                }
            });

            xaiWs.on('close', () => {
                sendJson(browserWs, { type: 'closed' });
            });

            xaiWs.on('error', (err) => {
                console.error('[Trainer Realtime] xAI WS error:', err.message);
                sendJson(browserWs, { type: 'error', message: err.message });
            });
        } catch (err) {
            console.error('[Trainer Realtime] Setup failed:', err.message);
            sendJson(browserWs, { type: 'error', message: err.message });
            cleanup();
            browserWs.close();
        }
    });

    browserWs.on('close', cleanup);
    browserWs.on('error', cleanup);
}

module.exports = { handleTrainerRealtime };
