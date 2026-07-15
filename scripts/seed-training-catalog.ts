import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import {
  ensureTrainingLeadsAvailable,
  TARGET_TRAINING_LEADS,
  TRAINING_LEAD_CATALOG,
} from '../src/lib/training-leads';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('catalog size', TRAINING_LEAD_CATALOG.length, 'target', TARGET_TRAINING_LEADS);
  const before = await prisma.prospect.count({ where: { source: 'training' } });
  console.log('before', before);
  const result = await ensureTrainingLeadsAvailable();
  const after = await prisma.prospect.count({ where: { source: 'training' } });
  console.log('ensure', result);
  console.log('after', after);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
