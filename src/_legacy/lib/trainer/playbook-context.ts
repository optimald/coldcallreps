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
  /** Product / landing page for SDRs to review before calling. */
  productUrl?: string;
  /** Training images (https or app-relative paths). Max 8. */
  trainingImages?: string[];
  /** Training video URL (https or app-relative path). */
  trainingVideoUrl?: string;
}

const MAX_PRODUCT_URL = 500;
const MAX_MEDIA_URL = 2000;
const MAX_TRAINING_IMAGES = 8;

/** Allow https?://… or leading / paths; reject everything else. */
export function sanitizePlaybookMediaUrl(
  raw: unknown,
  maxLen: number = MAX_MEDIA_URL
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim().slice(0, maxLen);
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return undefined;
}

function sanitizeTrainingImages(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= MAX_TRAINING_IMAGES) break;
    const url = sanitizePlaybookMediaUrl(item, MAX_MEDIA_URL);
    if (url) out.push(url);
  }
  return out.length ? out : undefined;
}

/** Normalize unknown content (API body or parsed JSON) into a safe PlaybookContent. */
export function sanitizePlaybookContent(input: unknown): PlaybookContent {
  const parsed =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const stepsRaw = Array.isArray(parsed.steps) ? parsed.steps : [];
  const steps: PlaybookStep[] = stepsRaw.map((s: unknown) => {
    if (typeof s === 'string') {
      return { title: s.slice(0, 120), script: s.slice(0, 2000) };
    }
    const step = s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
    return {
      title: String(step.title || 'Step').slice(0, 120),
      script: String(step.script || step.title || '').slice(0, 2000),
      objections: Array.isArray(step.objections)
        ? step.objections.map(String).map((o) => o.slice(0, 500))
        : undefined,
    };
  });

  const productUrl = sanitizePlaybookMediaUrl(parsed.productUrl, MAX_PRODUCT_URL);
  const trainingVideoUrl = sanitizePlaybookMediaUrl(parsed.trainingVideoUrl, MAX_MEDIA_URL);
  const trainingImages = sanitizeTrainingImages(parsed.trainingImages);
  const focusAreas = Array.isArray(parsed.focusAreas)
    ? parsed.focusAreas.map(String).map((f) => f.slice(0, 120))
    : undefined;

  const content: PlaybookContent = { steps };
  if (focusAreas?.length) content.focusAreas = focusAreas;
  if (productUrl) content.productUrl = productUrl;
  if (trainingImages?.length) content.trainingImages = trainingImages;
  if (trainingVideoUrl) content.trainingVideoUrl = trainingVideoUrl;
  return content;
}

export function parsePlaybookContent(raw: string): PlaybookContent {
  try {
    return sanitizePlaybookContent(JSON.parse(raw || '{}'));
  } catch {
    return { steps: [] };
  }
}

export type ResolvedPlaybookContext = {
  block: string;
  sections: ScriptSection[];
  playbookId: string;
  title: string;
  productUrl?: string;
  trainingImages?: string[];
  trainingVideoUrl?: string;
};

/**
 * Resolve a playbook for trainer/coach use.
 * Personal + org: ownership/membership.
 * Brand: demo, practiceAllowed catalog, brand manager, or accepted campaign SDR.
 */
export async function resolvePlaybookContext(opts: {
  userId: string;
  orgId?: string | null;
  playbookId?: string | null;
}): Promise<ResolvedPlaybookContext | null> {
  if (!opts.playbookId) return null;

  const playbook = await prisma.playbook.findUnique({
    where: { id: opts.playbookId },
    include: {
      brand: { select: { id: true, slug: true, ownerId: true } },
    },
  });
  if (!playbook) return null;

  const isPersonal =
    playbook.userId === opts.userId ||
    (Boolean(opts.orgId) && playbook.orgId === opts.orgId);
  if (!isPersonal && playbook.brandId) {
    const demo = Boolean(playbook.brand?.slug?.startsWith('demo-'));
    if (!demo && !playbook.practiceAllowed) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: opts.userId },
        select: { id: true, platformRole: true, email: true },
      });
      if (!profile) return null;
      const { assertTrainerBrandAccess } = await import('@/lib/trainer-brand-access');
      const access = await assertTrainerBrandAccess(profile, playbook.brandId);
      if (!access.ok) return null;
    }
  } else if (!isPersonal) {
    return null;
  }

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
  const productLine = content.productUrl
    ? `\nProduct to review before calling: ${content.productUrl}`
    : '';
  const block = `${scope} PLAYBOOK: ${playbook.title}${productLine}
Follow these steps when coaching / roleplaying:
${content.steps
  .map(
    (s, i) =>
      `${i + 1}. ${s.title}: ${s.script}${
        s.objections?.length ? ` (handle: ${s.objections.join('; ')})` : ''
      }`
  )
  .join('\n')}`;

  return {
    block,
    sections,
    playbookId: playbook.id,
    title: playbook.title,
    productUrl: content.productUrl,
    trainingImages: content.trainingImages,
    trainingVideoUrl: content.trainingVideoUrl,
  };
}
