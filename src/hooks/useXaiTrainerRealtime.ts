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
    hintMode?: boolean;
    brandId?: string;
    packId?: string;
    playbookId?: string;
    /** Clerk user id — required for playbook/memory resolution via worker internal prompt fetch */
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
    const prospectSpeakingRef = useRef(false);
    const acceptProspectAudioRef = useRef(false);
    const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingBlobRef = useRef<Blob | null>(null);

    micEnabledRef.current = micEnabled;

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
        const buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (mixDestRef.current) source.connect(mixDestRef.current);

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
        for (const chunk of buffered) {
            ws.send(JSON.stringify({ type: 'audio', audio: chunk }));
        }
    }, []);

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

        const processor = ctx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
            // Half-duplex: don't uplink while prospect is speaking (prevents speaker bleed → false VAD turn)
            if (!micEnabledRef.current || prospectSpeakingRef.current) return;
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
        if (mixDestRef.current) source.connect(mixDestRef.current);
        const silent = ctx.createGain();
        silent.gain.value = 0;
        processor.connect(silent);
        silent.connect(ctx.destination);
    }, [stopMicCapture]);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                resolve(recordingBlobRef.current);
                return;
            }
            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, {
                    type: recorder.mimeType || 'audio/webm',
                });
                recordingBlobRef.current = blob.size > 0 ? blob : null;
                recordedChunksRef.current = [];
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

    const disconnect = useCallback(() => {
        void stopRecording();
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
        mixDestRef.current = null;

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
    }, [interruptPlayback, stopMicCapture, stopRecording]);

    const connect = useCallback(
        async (config: TrainerSessionConfig): Promise<boolean> => {
            disconnect();
            setIsConnecting(true);
            setTranscript([]);

            try {
                const AudioCtx =
                    window.AudioContext ||
                    (window as unknown as { webkitAudioContext: typeof AudioContext })
                        .webkitAudioContext;
                const ctx = new AudioCtx({ sampleRate: SAMPLE_RATE });
                audioContextRef.current = ctx;
                // iOS / Safari often start suspended until a user gesture — resume aggressively
                if (ctx.state === 'suspended') {
                    try {
                        await ctx.resume();
                    } catch {
                        /* ignore */
                    }
                }
                const unlock = () => {
                    if (audioContextRef.current?.state === 'suspended') {
                        void audioContextRef.current.resume();
                    }
                };
                window.addEventListener('touchstart', unlock, { once: true, passive: true });
                window.addEventListener('click', unlock, { once: true });

                // Mixed recording destination for highlight clips (mic + prospect playback)
                recordingBlobRef.current = null;
                recordedChunksRef.current = [];
                const mixDest = ctx.createMediaStreamDestination();
                mixDestRef.current = mixDest;
                try {
                    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                        ? 'audio/webm;codecs=opus'
                        : 'audio/webm';
                    const recorder = new MediaRecorder(mixDest.stream, { mimeType: mime });
                    mediaRecorderRef.current = recorder;
                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
                    };
                    recorder.start(1000);
                } catch {
                    mediaRecorderRef.current = null;
                }

                // Parallel init: start mic capture before WebSocket is ready (xAI best practice)
                await startMicCapture();

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
                            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
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
                                ? 'Realtime voice unavailable. Check the Cloudflare Durable Object worker is deployed and NEXT_PUBLIC_TRAINER_REALTIME_URL is correct.'
                                : 'Realtime voice unavailable. Start with "npm run dev" (node server.js), or set NEXT_PUBLIC_TRAINER_REALTIME_URL to the Cloudflare worker.'
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
                                if (!msg.twoStage) {
                                    audioFlushReadyRef.current = true;
                                    flushEarlyAudio();
                                }
                                resolve();
                                break;
                            case 'gatekeeper.ready':
                                awaitingGatekeeperGreetingRef.current = false;
                                audioFlushReadyRef.current = true;
                                flushEarlyAudio();
                                break;
                            case 'phase':
                                setPhase(msg.phase || 'decision_maker');
                                if (msg.label) setDecisionMakerName(msg.label);
                                interruptPlayback();
                                break;
                            case 'audio':
                                if (msg.audio && acceptProspectAudioRef.current) playPcm16Chunk(msg.audio);
                                break;
                            case 'interrupt':
                                interruptPlayback();
                                acceptProspectAudioRef.current = false;
                                prospectSpeakingRef.current = false;
                                break;
                            case 'prospect.speaking':
                                prospectSpeakingRef.current = true;
                                acceptProspectAudioRef.current = true;
                                setIsProspectSpeaking(true);
                                break;
                            case 'prospect.done':
                                prospectSpeakingRef.current = false;
                                acceptProspectAudioRef.current = false;
                                setIsProspectSpeaking(false);
                                if (awaitingGatekeeperGreetingRef.current) {
                                    awaitingGatekeeperGreetingRef.current = false;
                                    audioFlushReadyRef.current = true;
                                    flushEarlyAudio();
                                }
                                break;
                            case 'user.speaking':
                                acceptProspectAudioRef.current = false;
                                prospectSpeakingRef.current = false;
                                setIsUserSpeaking(true);
                                break;
                            case 'user.done':
                                setIsUserSpeaking(false);
                                break;
                            case 'transcript': {
                                setTranscript((prev) => {
                                    const text = (msg.text || '').trim();
                                    if (!text) return prev;
                                    const id = typeof msg.id === 'number' ? msg.id : typeof msg.seq === 'number' ? msg.seq : prev.length + 1;

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
                                        if (/\bone at a time\b/.test(a) && /\bone at a time\b/.test(b)) return prev;
                                        const emailCta = /\b(email|send (the )?details)\b/;
                                        if (emailCta.test(a) && emailCta.test(b)) {
                                            const wordsA = a.split(' ').filter((w: string) => w.length > 3);
                                            const wordsB = new Set(b.split(' ').filter((w: string) => w.length > 3));
                                            const shared = wordsA.filter((w: string) => wordsB.has(w)).length;
                                            if (shared / Math.min(wordsA.length, wordsB.size) >= 0.38) return prev;
                                        }
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
                                    ? 'Realtime voice unavailable. Check the Cloudflare Durable Object worker is deployed and NEXT_PUBLIC_TRAINER_REALTIME_URL is correct.'
                                    : 'Realtime voice unavailable. Start with "npm run dev" (node server.js), or set NEXT_PUBLIC_TRAINER_REALTIME_URL to the Cloudflare worker.'
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
                // Do not rethrow — callers surface via onError / return value
                return false;
            }
        },
        [disconnect, flushEarlyAudio, interruptPlayback, onCallEnded, onError, playPcm16Chunk, startMicCapture]
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
