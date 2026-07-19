/** Map scorecard improvement text → suggested practice focus drill. */
export function suggestDrillFromImprovements(
  improvements: string[] | undefined,
  currentFocus?: string
): { focus: string; label: string; reason: string } | null {
  const blob = (improvements || []).join(' ').toLowerCase();
  if (!blob.trim()) return null;

  const drills: { focus: string; label: string; needles: string[] }[] = [
    {
      focus: 'standard',
      label: 'Gatekeeper → Decision Maker',
      needles: ['gatekeeper', 'transfer', 'receptionist', 'screen'],
    },
    {
      focus: 'pricing',
      label: 'Pricing objection',
      needles: ['price', 'budget', 'cost', 'expensive', 'roi'],
    },
    {
      focus: 'rejection',
      label: 'Rejection recovery',
      needles: ['reject', 'no interest', 'not interested', 'hang up', 'brush'],
    },
    {
      focus: 'budget_500',
      label: '$500 website pitch',
      needles: ['value', 'pitch', 'offer', 'close', 'ask'],
    },
  ];

  for (const d of drills) {
    if (d.focus === currentFocus) continue;
    if (d.needles.some((n) => blob.includes(n))) {
      return {
        focus: d.focus,
        label: d.label,
        reason: `Based on feedback mentioning ${d.needles.find((n) => blob.includes(n))}.`,
      };
    }
  }

  if (currentFocus !== 'standard') {
    return {
      focus: 'standard',
      label: 'Gatekeeper → Decision Maker',
      reason: 'Strengthen the opener and transfer path.',
    };
  }
  return {
    focus: 'pricing',
    label: 'Pricing objection',
    reason: 'Practice holding value under pushback.',
  };
}
