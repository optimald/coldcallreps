export type IntegrityFlag = {
  code: string;
  detail: string;
};

function countRole(lines: string[], pattern: RegExp): number {
  return lines.filter((l) => pattern.test(l)).length;
}

/** Lightweight anti-abuse signals stored on TrainerSession.integrityFlags */
export function computeIntegrityFlags(opts: {
  transcript: string;
  durationSeconds: number;
  overallScore: number;
  coachLogCount?: number;
}): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  const lines = opts.transcript
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const userLines = lines.filter((l) => /^USER:/i.test(l));
  const prospectLines = lines.filter((l) =>
    /^(PROSPECT|GATEKEEPER|DECISION_MAKER):/i.test(l)
  );

  if (opts.durationSeconds < 20) {
    flags.push({ code: 'short_duration', detail: 'Call under 20 seconds' });
  }
  if (userLines.length < 2) {
    flags.push({ code: 'thin_transcript', detail: 'Fewer than 2 trainee turns' });
  }
  if (prospectLines.length < 1) {
    flags.push({ code: 'no_prospect_speech', detail: 'No prospect turns captured' });
  }
  if (opts.overallScore >= 95 && opts.durationSeconds < 45) {
    flags.push({
      code: 'high_score_short_call',
      detail: 'Very high score on a short call',
    });
  }

  // Talk-ratio gaming: trainee dumps a monologue with almost no prospect dialogue
  if (userLines.length >= 4 && prospectLines.length > 0) {
    const userChars = userLines.reduce((n, l) => n + l.length, 0);
    const prospectChars = prospectLines.reduce((n, l) => n + l.length, 0);
    if (prospectChars > 0 && userChars / prospectChars > 8 && opts.overallScore >= 80) {
      flags.push({
        code: 'talk_ratio_skew',
        detail: 'Trainee talk ratio extremely high vs prospect',
      });
    }
  }

  // Duplicate / copy-paste turns
  const userTexts = userLines.map((l) =>
    l.replace(/^USER:\s*/i, '').trim().toLowerCase()
  );
  const unique = new Set(userTexts.filter((t) => t.length > 12));
  if (userTexts.length >= 3 && unique.size <= 1) {
    flags.push({
      code: 'repeated_user_turns',
      detail: 'Trainee repeated the same line across turns',
    });
  }

  // Suspiciously perfect score with thin dialogue
  if (
    opts.overallScore >= 90 &&
    (userLines.length < 3 || prospectLines.length < 2 || opts.durationSeconds < 60)
  ) {
    flags.push({
      code: 'inflated_score_thin_call',
      detail: 'High score with thin dialogue or short duration',
    });
  }

  // Unused but kept for future coach-log correlation
  void opts.coachLogCount;
  void countRole;

  return flags;
}
