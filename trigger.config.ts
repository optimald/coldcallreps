import { defineConfig } from '@trigger.dev/sdk';
import { prismaExtension } from '@trigger.dev/build/extensions/prisma';
import { syncEnvVars } from '@trigger.dev/build/extensions/core';

/** Env keys the phone pipeline worker needs at runtime. */
const PIPELINE_ENV_KEYS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'DATABASE_URL',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'XAI_API_KEY',
  'XAI_MODEL',
  'RAPIDAPI_MAPS_KEY',
  'RAPIDAPI_MAPS_HOST',
] as const;

export default defineConfig({
  project: 'proj_oyrhiiorgnhfhddoqvia',
  runtime: 'node-22',
  logLevel: 'info',
  maxDuration: 3600,
  dirs: ['./src/trigger'],
  // Thin re-export entry files — real task() defs live in tasks.ts / example.ts
  ignorePatterns: [
    '**/scraper-task.ts',
    '**/webscan-task.ts',
    '**/enricher-task.ts',
    '**/audit-task.ts',
  ],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    // Turso / native deps must stay external for the worker image.
    external: ['@libsql/client', '@prisma/adapter-libsql', 'sharp'],
    extensions: [
      prismaExtension({
        mode: 'legacy',
        schema: './prisma/schema.prisma',
      }),
      // Push pipeline secrets into Trigger on each deploy (from local/CI env).
      syncEnvVars(async () => {
        const out: Record<string, string> = {};
        for (const key of PIPELINE_ENV_KEYS) {
          const v = process.env[key]?.trim();
          if (v) out[key] = v;
        }
        return out;
      }, { override: true }),
    ],
  },
});
