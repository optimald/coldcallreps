import { prisma } from '@/lib/prisma';

/** Load CRM / coach memory as a short prompt block for live coach + scenarios. */
export async function loadCoachMemoryBlock(userId: string): Promise<string | null> {
  const memories = await prisma.coachMemory.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  });
  if (!memories.length) return null;

  const lines = memories.map((m) => {
    let value: unknown = m.valueJSON;
    try {
      value = JSON.parse(m.valueJSON);
    } catch {
      /* keep raw */
    }
    return `- ${m.key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
  });

  return `CRM / coach memory (use to personalize coaching, do not invent CRM facts):\n${lines.join('\n')}`;
}

export async function upsertCoachMemory(
  userId: string,
  key: string,
  value: Record<string, unknown> | string
) {
  const valueJSON = typeof value === 'string' ? value : JSON.stringify(value);
  return prisma.coachMemory.upsert({
    where: { userId_key: { userId, key: key.slice(0, 80) } },
    create: { userId, key: key.slice(0, 80), valueJSON },
    update: { valueJSON },
  });
}
