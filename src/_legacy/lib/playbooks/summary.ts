import { parsePlaybookContent } from '@/lib/trainer/playbook-context';

export type PlaybookSummary = {
  stepCount: number;
  objectionCount: number;
  stepTitles: string[];
  productUrl: string | null;
  hasTrainingMedia: boolean;
};

export function summarizePlaybookContent(contentJSON: string | null | undefined): PlaybookSummary {
  const content = parsePlaybookContent(contentJSON || '{}');
  const steps = content.steps || [];
  let objectionCount = 0;
  for (const step of steps) {
    objectionCount += step.objections?.length ?? 0;
  }
  return {
    stepCount: steps.length,
    objectionCount,
    stepTitles: steps.slice(0, 4).map((s) => s.title || 'Step'),
    productUrl: content.productUrl || null,
    hasTrainingMedia: Boolean(
      content.trainingVideoUrl || (content.trainingImages && content.trainingImages.length > 0)
    ),
  };
}
