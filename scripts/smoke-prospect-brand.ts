/**
 * Smoke: same prisma singleton + outbound findMany shapes must accept brandId.
 * Run: npx tsx scripts/smoke-prospect-brand.ts
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { TRAINING_SOURCE } from '../src/lib/training-leads';

async function main() {
  console.log('ProspectScalarFieldEnum.brandId =', Prisma.ProspectScalarFieldEnum.brandId);
  console.log('using Turso:', Boolean(process.env.TURSO_DATABASE_URL?.trim()));

  const personal = await prisma.prospect.findMany({
    where: {
      userId: 'smoke_test_nonexistent',
      brandId: null,
      NOT: { source: TRAINING_SOURCE },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      companyName: true,
      phone: true,
      ownerName: true,
      city: true,
      status: true,
      brandId: true,
    },
  });
  console.log('OK personal-shaped findMany', personal.length);

  const brandLeads = await prisma.prospect.findMany({
    where: {
      OR: [
        { campaignId: { in: ['nonexistent'] } },
        { brandId: { in: ['nonexistent'] }, campaignId: null },
      ],
      NOT: { source: TRAINING_SOURCE },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, brandId: true, campaignId: true },
  });
  console.log('OK brandLeads-shaped findMany', brandLeads.length);

  const training = await prisma.prospect.findMany({
    where: { source: TRAINING_SOURCE },
    orderBy: [{ brandId: 'asc' }, { companyName: 'asc' }],
    take: 3,
    select: {
      id: true,
      companyName: true,
      brandId: true,
      campaignId: true,
      enrichmentStatus: true,
      brand: { select: { id: true, name: true, slug: true } },
    },
  });
  console.log('OK training-shaped findMany count', training.length);
  if (training[0]) console.log('sample', training[0]);

  const cols = (await prisma.$queryRawUnsafe<
    Array<{ name: string }>
  >('PRAGMA table_info(Prospect)')).map((c) => c.name);
  console.log('DB Prospect columns:', cols.join(', '));
  for (const need of ['brandId', 'campaignId', 'enrichmentStatus']) {
    if (!cols.includes(need)) throw new Error(`DB missing column ${need}`);
  }
  console.log('SMOKE PASS');
}

main()
  .catch((e) => {
    console.error('SMOKE FAIL', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
