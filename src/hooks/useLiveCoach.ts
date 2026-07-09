'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrainerPhase, TrainerTranscriptEntry } from '@/hooks/useXaiTrainerRealtime';
import { getCoachForwardFallback, getInstantSayNext } from '@/lib/trainer/gatekeeper-hints';

export interface CoachLogEntry {
    atSeconds: number;
    prospectEntryId: number;
    prospectText: string;
    suggestion: string;
    source: 'instant' | 'llm';
}

export interface UseLiveCoachOptions {
    enabled: boolean;
    active: boolean;
    transcript: TrainerTranscriptEntry[];
    phase: TrainerPhase;
    gatekeeperName: string;
    decisionMakerName: string;
    companyName: string;
    difficulty: string;
    isProspectSpeaking: boolean;
    isUserSpeaking: boolean;
    callTimer?: number;
    onSuggestion?: (entry: CoachLogEntry) => void;
}

function stripQuotes(text: string): string {
    return text.replace(/^["']|["']$/g, '').trim();
}

function wordOverlap(a: string, b: string): number {
    const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    if (!wordsA.length || !wordsB.size) return 0;
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared += 1;
    return shared / Math.min(wordsA.length, wordsB.size);
}

export function useLiveCoach(options: UseLiveCoachOptions) {
    const {
        enabled,
        active,
        transcript,
        phase,
        gatekeeperName,
        decisionMakerName,
        companyName,
        difficulty,
        isProspectSpeaking,
        isUserSpeaking,
        callTimer = 0,
        onSuggestion,
    } = options;

    const [sayNext, setSayNext] = useState('');
    const lockedEntryIdRef = useRef<number | null>(null);
    const lockedInstantRef = useRef('');
    const priorSuggestionsRef = useRef<string[]>([]);
    const onSuggestionRef = useRef(onSuggestion);
    const abortRef = useRef<AbortController | null>(null);
    onSuggestionRef.current = onSuggestion;

    const fetchLlmHint = useCallback(
        async (entryId: number, snapshot: TrainerTranscriptEntry[], instantLine: string) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch('/api/trainer/hint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        transcript: snapshot.map((e) => ({ role: e.role, text: e.text })),
                        phase,
                        gatekeeperName,
                        decisionMakerName,
                        companyName: companyName || 'the business',
                        difficulty,
                        priorSuggestions: priorSuggestionsRef.current.slice(-4),
                    }),
                });

                const data = await res.json();
                if (!res.ok || controller.signal.aborted) return;
                if (lockedEntryIdRef.current !== entryId) return;

                const line = stripQuotes(String(data.hint?.sayNext || ''));
                if (!line) return;

                const lastUser = [...snapshot].reverse().find((e) => e.role === 'user')?.text || '';
                if (lastUser && wordOverlap(line, lastUser) >= 0.35) return;
                if (wordOverlap(line, instantLine) >= 0.45) return;

                setSayNext(line);
                onSuggestionRef.current?.({
                    atSeconds: callTimer,
                    prospectEntryId: entryId,
                    prospectText: snapshot[snapshot.length - 1]?.text || '',
                    suggestion: line,
                    source: 'llm',
                });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
            }
        },
        [phase, gatekeeperName, decisionMakerName, companyName, difficulty, callTimer]
    );

    useEffect(() => {
        if (!enabled || !active) {
            abortRef.current?.abort();
            lockedEntryIdRef.current = null;
            priorSuggestionsRef.current = [];
            setSayNext('');
            return;
        }

        if (isProspectSpeaking || isUserSpeaking) return;

        const last = transcript[transcript.length - 1];
        if (!last || last.role === 'user') return;
        if (last.id === lockedEntryIdRef.current) return;

        lockedEntryIdRef.current = last.id;

        const instant = getInstantSayNext({
            phase,
            transcript,
            gatekeeperName,
            decisionMakerName,
            companyName: companyName || undefined,
            priorSuggestions: priorSuggestionsRef.current,
        });

        const lastUser = transcript.filter((e) => e.role === 'user').pop()?.text || '';
        const instantEchoesUser = lastUser && wordOverlap(instant, lastUser) >= 0.42;
        const suggestion = instantEchoesUser
            ? getCoachForwardFallback({
                  gatekeeperName,
                  decisionMakerName,
                  companyName: companyName || undefined,
              })
            : instant;

        lockedInstantRef.current = suggestion;
        priorSuggestionsRef.current.push(suggestion);
        setSayNext(suggestion);
        onSuggestionRef.current?.({
            atSeconds: callTimer,
            prospectEntryId: last.id,
            prospectText: last.text,
            suggestion,
            source: 'instant',
        });

        if (instantEchoesUser) {
            void fetchLlmHint(last.id, transcript, suggestion);
        }
    }, [
        enabled,
        active,
        transcript,
        phase,
        gatekeeperName,
        decisionMakerName,
        companyName,
        difficulty,
        isProspectSpeaking,
        isUserSpeaking,
        callTimer,
        fetchLlmHint,
    ]);

    useEffect(() => () => abortRef.current?.abort(), []);

    return {
        sayNext: active ? sayNext : '',
        visible: active && !!sayNext && !isProspectSpeaking,
    };
}
