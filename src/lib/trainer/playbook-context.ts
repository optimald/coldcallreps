import { prisma } from '@/lib/prisma';
import type { ScriptSection } from '@/lib/trainer/training-script';

export interface PlaybookStep {
  title: string;
  script: string;
  objections?: string[];
}

export interface PlaybookContent {
  steps: PlaybookStep[];
  focusAreas?: string[];
}

export function parsePlaybookContent(raw: string): PlaybookContent {
  try {
    const parsed = JSON.parse(raw || '{}');
    const stepsRaw = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: PlaybookStep[] = stepsRaw.map((s: any) => {
      if (typeof s === 'string') {
        return { title: s, script: s };
      }
      return {
        title: String(s.title || 'Step').slice(0, 120),
        script: String(s.script || s.title || '').slice(0, 2000),
        objections: Array.isArray(s.objections) ? s.objections.map(String) : undefined,
      };
    });
    return {
      steps,
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.map(String) : undefined,
    };
  } catch {
    return { steps: [] };
  }
}

/**
 * Resolve a playbook for trainer/coach use.
 * Personal + org playbooks require ownership/membership.
 * Brand playbooks are practice content — any authenticated caller may load them.
 */
export async function resolvePlaybookContext(opts: {
  userId: string;
  orgId?: string | null;
  playbookId?: string | null;
}): Promise<{ block: string; sections: ScriptSection[]; playbookId: string; title: string } | null> {
  if (!opts.playbookId) return null;

  const playbook = await prisma.playbook.findFirst({
    where: {
      id: opts.playbookId,
      OR: [
        { userId: opts.userId },
        ...(opts.orgId ? [{ orgId: opts.orgId }] : []),
        { brandId: { not: null } },
      ],
    },
  });
  if (!playbook) return null;

  const content = parsePlaybookContent(playbook.contentJSON);
  if (!content.steps.length) return null;

  const sections: ScriptSection[] = content.steps.map((s) => ({
    title: s.title,
    points: [
      s.script,
      ...(s.objections?.length ? [`Objections: ${s.objections.join(' | ')}`] : []),
    ].filter(Boolean),
  }));

  const scope = playbook.brandId ? 'BRAND' : playbook.orgId ? 'ORG' : 'PERSONAL';
  const block = `${scope} PLAYBOOK: ${playbook.title}
Follow these steps when coaching / roleplaying:
${content.steps
  .map(
    (s, i) =>
      `${i + 1}. ${s.title}: ${s.script}${
        s.objections?.length ? ` (handle: ${s.objections.join('; ')})` : ''
      }`
  )
  .join('\n')}`;

  return { block, sections, playbookId: playbook.id, title: playbook.title };
}
