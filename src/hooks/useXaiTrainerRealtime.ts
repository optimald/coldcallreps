'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SAMPLE_RATE = 24000;

export interface TrainerTranscriptEntry {
    role: 'user' | 'prospect' | 'gatekeeper' | 'decision_maker';
    text: string;
    id: number;
    seq: number;
}

export type TrainerPhase = 'gatekeeper' | 'decision_maker' | 'prospect';

export interface TrainerSessionConfig {
    leadId?: string | number;
    prospectId?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    focus: string;
    voice: string;
    gatekeeperVoice?: string;
    bossVoice?: string;
    brandId?: string;
    packId?: string;
    playbookId?: string;
    userId?: string;
    orgId?: string;
    gateToken?: string;
    prospectOverride?: Record<string, unknown>;
}

interface UseXaiTrainerRealtimeOptions {
    onError?: (message: string) => void;
    onCallEnded?: (reason: string) => void;
}

function floatTo16BitPCM(float32: Float32Array): Int16Array {
    const pcm = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
}

function int16ToBase64(int16: Int16Array): string {
    const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

/**
 * Browser ↔ local/CF trainer realtime bridge.
 * Playback path aligned with the working trojan.markets (v2_engine) trainer.
 */
export function useXaiTrainerRealtime(options: UseXaiTrainerRealtimeOptions = {}) {
    const { onError, onCallEnded } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [micEnabled, setMicEnabled] = useState(true);
    const [isProspectSpeaking, setIsProspectSpeaking] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<TrainerTranscriptEntry[]>([]);
    const [phase, setPhase] = useState<TrainerPhase>('prospect');
    const [gatekeeperName, setGatekeeperName] = useState('Sarah');
    const [decisionMakerName, setDecisionMakerName] = useState('the owner');
    const [twoStage, setTwoStage] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micEnabledRef = useRef(true);
    const nextPlayTimeRef = useRef(0);
    const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
    const earlyAudioBufferRef = useRef<string[]>([]);
    const audioFlushReadyRef = useRef(false);
    const awaitingGatekeeperGreetingRef = useRef(false);
    const greetingDrainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prospectSpeakingRef = useRef(false);
    const acceptProspectAudioRef = useRef(false);
    const recordingBlobRef = useRef<Blob | null>(null);
    const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    micEnabledRef.current = micEnabled;

    const stopMediaRecorder = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                resolve(recordingBlobRef.current);
                return;
            }
            recorder.onstop = () => {
                const type = recorder.mimeType || 'audio/webm';
                const blob =
                    recordedChunksRef.current.length > 0
                        ? new Blob(recordedChunksRef.current, { type })
                        : null;
                recordingBlobRef.current = blob && blob.size > 0 ? blob : null;
                mediaRecorderRef.current = null;
                resolve(recordingBlobRef.current);
            };
            try {
                recorder.stop();
            } catch {
                resolve(recordingBlobRef.current);
            }
        });
    }, []);

    const startMediaRecorder = useCallback((stream: MediaStream) => {
        recordedChunksRef.current = [];
        recordingBlobRef.current = null;
        try {
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                  ? 'audio/webm'
                  : '';
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
            recorder.start(1000);
        } catch {
            mediaRecorderRef.current = null;
        }
    }, []);

    const interruptPlayback = useCallback(() => {
        scheduledSourcesRef.current.forEach((source) => {
            try {
                source.stop();
            } catch {
                /* already stopped */
            }
        });
        scheduledSourcesRef.current = [];
        acceptProspectAudioRef.current = false;
        if (audioContextRef.current) {
            nextPlayTimeRef.current = audioContextRef.current.currentTime;
        }
    }, []);

    const playPcm16Chunk = useCallback((base64: string) => {
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const pcm = base64ToInt16(base64);
        if (pcm.length === 0) return;

        // Use the context's actual rate for the buffer clock; PCM is 24k from xAI.
        // createBuffer(,,, SAMPLE_RATE) lets the browser resample into ctx.sampleRate.
        const buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (mixDestRef.current) {
            source.connect(mixDestRef.current);
        }

        const now = ctx.currentTime;
        const start = Math.max(now, nextPlayTimeRef.current);
        source.start(start);
        nextPlayTimeRef.current = start + buffer.duration;
        scheduledSourcesRef.current.push(source);

        source.onended = () => {
            scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
        };
    }, []);

    const stopMicCapture = useCallback(() => {
        processorRef.current?.disconnect();
        micSourceRef.current?.disconnect();
        processorRef.current = null;
        micSourceRef.current = null;
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
    }, []);

    const flushEarlyAudio = useCallback(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const buffered = earlyAudioBufferRef.current;
        earlyAudioBufferRef.current = [];
        // Discard preroll during/just after IVR — it is mostly speaker echo
        if (awaitingGatekeeperGreetingRef.current) return;
        for (const chunk of buffered) {
            ws.send(JSON.stringify({ type: 'audio', audio: chunk }));
        }
    }, []);

    /**
     * response.done / gatekeeper.ready fire when TTS bytes are *sent*, not when
     * Web Audio finished playing. Opening the mic early lets speaker echo
     * trigger barge-in and interruptPlayback() mid-greeting.
     */
    const releaseGreetingMic = useCallback(
        (pcmMsHint?: number) => {
            if (greetingDrainTimerRef.current) {
                clearTimeout(greetingDrainTimerRef.current);
                greetingDrainTimerRef.current = null;
            }

            const finish = () => {
                greetingDrainTimerRef.current = null;
                if (!awaitingGatekeeperGreetingRef.current) return;
                awaitingGatekeeperGreetingRef.current = false;
                earlyAudioBufferRef.current = [];
                audioFlushReadyRef.current = true;
                flushEarlyAudio();
            };

            const poll = () => {
                const ctx = audioContextRef.current;
                if (!ctx) {
                    finish();
                    return;
                }
                const remainingMs = Math.max(
                    0,
                    (nextPlayTimeRef.current - ctx.currentTime) * 1000
                );
                if (remainingMs <= 80 && scheduledSourcesRef.current.length === 0) {
                    finish();
                    return;
                }
                greetingDrainTimerRef.current = setTimeout(poll, 120);
            };

            // Fallback ceiling so a stuck queue can't mute the mic forever
            const ceilingMs = Math.max(3000, Math.min(10000, (pcmMsHint || 4000) + 800));
            setTimeout(() => {
                if (awaitingGatekeeperGreetingRef.current) finish();
            }, ceilingMs);

            poll();
        },
        [flushEarlyAudio]
    );

    const startMicCapture = useCallback(async () => {
        const ctx = audioContextRef.current;
        if (!ctx) return;

        stopMicCapture();
        earlyAudioBufferRef.current = [];

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });
        micStreamRef.current = stream;

        const source = ctx.createMediaStreamSource(stream);
        micSourceRef.current = source;
        if (mixDestRef.current) {
            source.connect(mixDestRef.current);
        }

        const processor = ctx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
            if (!micEnabledRef.current || prospectSpeakingRef.current) return;
            // Don't uplink or buffer during forced gatekeeper greeting
            if (awaitingGatekeeperGreetingRef.current) return;

            const input = event.inputBuffer.getChannelData(0);
            const pcm = floatTo16BitPCM(input);
            const encoded = int16ToBase64(pcm);
            const ws = wsRef.current;

            if (audioFlushReadyRef.current && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'audio', audio: encoded }));
                return;
            }

            earlyAudioBufferRef.current.push(encoded);
        };

        source.connect(processor);
        const silent = ctx.createGain();
        silent.gain.value = 0;
        processor.connect(silent);
        silent.connect(ctx.destination);
    }, [stopMicCapture]);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return stopMediaRecorder();
    }, [stopMediaRecorder]);

    const disconnect = useCallback(() => {
        if (greetingDrainTimerRef.current) {
            clearTimeout(greetingDrainTimerRef.current);
            greetingDrainTimerRef.current = null;
        }
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            try {
                recorder.stop();
            } catch {
                /* ignore */
            }
        }
        mediaRecorderRef.current = null;
        mixDestRef.current = null;
        stopMicCapture();
        interruptPlayback();

        const ws = wsRef.current;
        if (ws) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'stop' }));
                }
                ws.close();
            } catch {
                /* ignore */
            }
        }
        wsRef.current = null;
        audioFlushReadyRef.current = false;
        earlyAudioBufferRef.current = [];
        awaitingGatekeeperGreetingRef.current = false;

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }

        setIsConnected(false);
        setIsConnecting(false);
        setIsProspectSpeaking(false);
        setIsUserSpeaking(false);
        setPhase('prospect');
        setTwoStage(false);
    }, [interruptPlayback, stopMicCapture]);

    const connect = useCallback(
        async (config: TrainerSessionConfig): Promise<boolean> => {
            disconnect();
            setIsConnecting(true);
            setTranscript([]);
            recordingBlobRef.current = null;
            recordedChunksRef.current = [];

            try {
                const AudioCtx =
                    window.AudioContext ||
                    (window as unknown as { webkitAudioContext: typeof AudioContext })
                        .webkitAudioContext;
                const ctx = new AudioCtx({ sampleRate: SAMPLE_RATE });
                audioContextRef.current = ctx;
                if (ctx.state === 'suspended') {
                    await ctx.resume();
                }

                const mixDest = ctx.createMediaStreamDestination();
                mixDestRef.current = mixDest;

                await startMicCapture();
                startMediaRecorder(mixDest.stream);

                const realtimeUrl =
                    process.env.NEXT_PUBLIC_TRAINER_REALTIME_URL ||
                    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/trainer/realtime`;
                const ws = new WebSocket(realtimeUrl);
                wsRef.current = ws;

                await new Promise<void>((resolve, reject) => {
                    let settled = false;

                    const failConnect = (message: string) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeout);
                        try {
                            ws.onopen = null;
                            ws.onmessage = null;
                            ws.onerror = null;
                            ws.onclose = null;
                            if (
                                ws.readyState === WebSocket.OPEN ||
                                ws.readyState === WebSocket.CONNECTING
                            ) {
                                ws.close();
                            }
                        } catch {
                            /* ignore */
                        }
                        if (wsRef.current === ws) wsRef.current = null;
                        reject(new Error(message));
                    };

                    const timeout = setTimeout(() => {
                        failConnect(
                            process.env.NEXT_PUBLIC_TRAINER_REALTIME_URL
                                ? 'Realtime voice unavailable. Check the Cloudflare worker and NEXT_PUBLIC_TRAINER_REALTIME_URL.'
                                : 'Realtime voice unavailable. Start with "npm run dev" (node server.js).'
                        );
                    }, 8000);

                    ws.onopen = () => {
                        ws.send(JSON.stringify({ type: 'start', ...config }));
                    };

                    ws.onmessage = (event) => {
                        let msg;
                        try {
                            msg = JSON.parse(event.data);
                        } catch {
                            return;
                        }

                        switch (msg.type) {
                            case 'ready':
                                if (settled) return;
                                settled = true;
                                clearTimeout(timeout);
                                setIsConnected(true);
                                setIsConnecting(false);
                                setTwoStage(!!msg.twoStage);
                                setPhase(msg.phase || 'prospect');
                                if (msg.gatekeeperName) setGatekeeperName(msg.gatekeeperName);
                                if (msg.decisionMakerName) setDecisionMakerName(msg.decisionMakerName);
                                awaitingGatekeeperGreetingRef.current = !!msg.twoStage;
                                earlyAudioBufferRef.current = [];
                                if (!msg.twoStage) {
                                    audioFlushReadyRef.current = true;
                                }
                                // Accept greeting audio immediately (force_message may stream
                                // before response.created / prospect.speaking in some builds)
                                acceptProspectAudioRef.current = true;
                                resolve();
                                break;
                            case 'gatekeeper.ready':
                                // Prefer draining scheduled greeting audio before uplink
                                releaseGreetingMic();
                                break;
                            case 'phase':
                                setPhase(msg.phase || 'decision_maker');
                                if (msg.label) setDecisionMakerName(msg.label);
                                interruptPlayback();
                                acceptProspectAudioRef.current = true;
                                break;
                            case 'audio':
                                // Always play prospect TTS — do not drop chunks if speaking
                                // signal is slightly late (was cutting "Thank you…" mid-word).
                                if (msg.audio) {
                                    if (!prospectSpeakingRef.current) {
                                        prospectSpeakingRef.current = true;
                                        setIsProspectSpeaking(true);
                                    }
                                    acceptProspectAudioRef.current = true;
                                    playPcm16Chunk(msg.audio);
                                }
                                break;
                            case 'interrupt':
                                // Never kill the forced gatekeeper intro for echo barge-in
                                if (awaitingGatekeeperGreetingRef.current) break;
                                interruptPlayback();
                                acceptProspectAudioRef.current = false;
                                prospectSpeakingRef.current = false;
                                setIsProspectSpeaking(false);
                                break;
                            case 'prospect.speaking':
                                prospectSpeakingRef.current = true;
                                acceptProspectAudioRef.current = true;
                                setIsProspectSpeaking(true);
                                break;
                            case 'prospect.done':
                                prospectSpeakingRef.current = false;
                                // Keep accepting briefly; scheduled buffers still play out
                                setIsProspectSpeaking(false);
                                if (awaitingGatekeeperGreetingRef.current) {
                                    releaseGreetingMic(
                                        typeof msg.pcmMs === 'number' ? msg.pcmMs : undefined
                                    );
                                }
                                break;
                            case 'user.speaking':
                                if (awaitingGatekeeperGreetingRef.current) break;
                                acceptProspectAudioRef.current = false;
                                prospectSpeakingRef.current = false;
                                setIsProspectSpeaking(false);
                                setIsUserSpeaking(true);
                                break;
                            case 'user.done':
                                setIsUserSpeaking(false);
                                break;
                            case 'transcript': {
                                setTranscript((prev) => {
                                    const text = (msg.text || '').trim();
                                    if (!text) return prev;
                                    const id =
                                        typeof msg.id === 'number'
                                            ? msg.id
                                            : typeof msg.seq === 'number'
                                              ? msg.seq
                                              : prev.length + 1;

                                    if (msg.update) {
                                        const idx = prev.findIndex((entry) => entry.id === id);
                                        if (idx >= 0) {
                                            const next = [...prev];
                                            next[idx] = { role: msg.role, text, id, seq: id };
                                            return next;
                                        }
                                        return prev;
                                    }

                                    if (prev.some((entry) => entry.id === id)) return prev;

                                    const last = prev[prev.length - 1];
                                    if (last && last.role === msg.role) {
                                        const a = last.text.trim().toLowerCase().replace(/\s+/g, ' ');
                                        const b = text.toLowerCase().replace(/\s+/g, ' ');
                                        if (a === b) return prev;
                                        if (a.length > 20 && b.startsWith(a.slice(0, 30))) return prev;
                                    }

                                    return [...prev, { role: msg.role, text, id, seq: id }];
                                });
                                break;
                            }
                            case 'call.ended':
                                onCallEnded?.(msg.reason || 'ended');
                                break;
                            case 'error': {
                                const errText = msg.message || msg.error || 'Realtime session error';
                                if (/cancellation failed|no active response/i.test(String(errText))) {
                                    break;
                                }
                                if (!settled) {
                                    failConnect(errText);
                                } else {
                                    onError?.(errText);
                                }
                                break;
                            }
                            case 'closed':
                                setIsConnected(false);
                                break;
                        }
                    };

                    ws.onerror = () => {
                        failConnect(
                            'WebSocket connection failed. Use "npm run dev" (node server.js) for realtime voice.'
                        );
                    };

                    ws.onclose = () => {
                        if (!settled) {
                            failConnect(
                                process.env.NEXT_PUBLIC_TRAINER_REALTIME_URL
                                    ? 'Realtime voice unavailable. Check the Cloudflare worker.'
                                    : 'Realtime voice unavailable. Start with "npm run dev" (node server.js).'
                            );
                            return;
                        }
                        setIsConnected(false);
                        setIsConnecting(false);
                    };
                });
                return true;
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : 'Realtime voice connection failed';
                disconnect();
                setIsConnecting(false);
                onError?.(message);
                return false;
            }
        },
        [
            disconnect,
            flushEarlyAudio,
            interruptPlayback,
            onCallEnded,
            onError,
            playPcm16Chunk,
            releaseGreetingMic,
            startMediaRecorder,
            startMicCapture,
        ]
    );

    useEffect(() => () => disconnect(), [disconnect]);

    return {
        connect,
        disconnect,
        stopRecording,
        getRecordingBlob: () => recordingBlobRef.current,
        isConnected,
        isConnecting,
        micEnabled,
        setMicEnabled,
        isProspectSpeaking,
        isUserSpeaking,
        transcript,
        phase,
        twoStage,
        gatekeeperName,
        decisionMakerName,
    };
}
