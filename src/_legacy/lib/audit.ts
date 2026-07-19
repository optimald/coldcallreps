import { prisma } from '@/lib/prisma';

export async function writeAudit(opts: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actorId || null,
        action: opts.action.slice(0, 120),
        targetType: opts.targetType?.slice(0, 64) || null,
        targetId: opts.targetId?.slice(0, 64) || null,
        metaJSON: JSON.stringify(opts.meta || {}),
      },
    });
  } catch (e) {
    console.error('audit write failed', e);
  }
}
