import { FOCUS_LABELS, PRODUCT, type FocusArea } from '@/lib/product';

/** Points from a completed session — sessions + score + difficulty + streak bonus */
export function computeSessionPoints(opts: {
  overallScore: number;
  difficulty: string;
  durationSeconds: number;
  focus: string;
  streakDays: number;
}): number {
  const { overallScore, difficulty, durationSeconds, focus, streakDays } = opts;
  const base = Math.max(10, Math.round(overallScore));
  const diffMult = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.85 : 1;
  const durationBonus = Math.min(20, Math.floor(durationSeconds / 60) * 2);
  const focusBonus =
    focus === 'budget_500' || focus === 'pen_pitch' || focus === 'gatekeeper' ? 10 : 0;
  const streakBonus = Math.min(50, streakDays * 5);
  return Math.round(base * diffMult + durationBonus + focusBonus + streakBonus);
}

export function badgeForSession(focus: string, score: number): string | null {
  if (score < 75) return null;
  const map: Record<string, string> = {
    gatekeeper: 'Gatekeeper Slayer',
    budget_500: '500 Closer',
    pen_pitch: 'Pen Master',
    standard: 'Rep Grinder',
    pricing: 'Price Whisperer',
    rejection: 'Comeback Kid',
  };
  return map[focus] || 'Rep Grinder';
}

export function weekStartUTC(d = new Date()): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function focusLabel(focus: string): string {
  return (FOCUS_LABELS as Record<string, string>)[focus] || focus;
}

export { PRODUCT };
