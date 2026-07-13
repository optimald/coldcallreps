/**
 * Trainer voice cast.
 * `id` is the provider voice key sent on the wire; `label` is the CCR-facing name
 * shown in UI (do not surface provider stock names).
 */
export const TRAINER_VOICES = [
  { id: 'ara', label: 'Wren', hint: 'Friendly F' },
  { id: 'eve', label: 'Nora', hint: 'Warm F' },
  { id: 'leo', label: 'Miles', hint: 'Pro M' },
  { id: 'rex', label: 'Holt', hint: 'Authority M' },
  { id: 'sal', label: 'Remy', hint: 'Energy M' },
] as const;

export type TrainerVoiceId = (typeof TRAINER_VOICES)[number]['id'];

export function trainerVoiceLabel(id: string): string {
  const hit = TRAINER_VOICES.find((v) => v.id === id);
  return hit ? hit.label : id;
}

export function trainerVoiceSummary(id: string): string {
  const hit = TRAINER_VOICES.find((v) => v.id === id);
  return hit ? `${hit.label} · ${hit.hint}` : id;
}
