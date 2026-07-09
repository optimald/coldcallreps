/**
 * xAI expressive speech tags for Voice Agent / TTS.
 * @see https://docs.x.ai/developers/model-capabilities/audio/text-to-speech#inline-tags
 */

/** Inline tags — insert at a point in the line for a vocal expression */
export const INLINE_SPEECH_TAGS = [
    '[pause]',
    '[long-pause]',
    '[hum-tune]',
    '[laugh]',
    '[chuckle]',
    '[giggle]',
    '[cry]',
    '[tsk]',
    '[tongue-click]',
    '[lip-smack]',
    '[breath]',
    '[inhale]',
    '[exhale]',
    '[sigh]',
] as const;

/** Wrapping tags — wrap a phrase to change delivery style */
export const WRAPPING_SPEECH_TAGS = [
    'whisper',
    'soft',
    'loud',
    'slow',
    'fast',
    'lower-pitch',
    'higher-pitch',
    'emphasis',
    'build-intensity',
    'decrease-intensity',
    'laugh-speak',
    'sing-song',
    'singing',
] as const;

export function stripSpeechTags(text: string): string {
    return (text || '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/<\/?[a-z-]+>/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function speechTagGuide(): string {
    return `Expressive voice (xAI speech tags — spoken aloud, stripped from transcript):
INLINE — place where the expression occurs:
  ${INLINE_SPEECH_TAGS.join(', ')}

WRAPPING — wrap a complete phrase:
  ${WRAPPING_SPEECH_TAGS.map((t) => `<${t}>...</${t}>`).join(', ')}

Tips (per xAI docs):
- Place inline tags where the expression naturally occurs; combine with punctuation.
- Use [pause] or [long-pause] for timing; don't stack too many tags.
- Wrapping tags work best around full phrases, not single words.
- For impatient gatekeepers: "[sigh] What is this regarding?" or "<fast>Look, I've got other lines.</fast>"
- For annoyed owners: "[tsk] <loud>I'm busy.</loud> Make it quick."`;
}
