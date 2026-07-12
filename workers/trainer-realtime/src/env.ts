export interface Env {
  TRAINER_SESSION: DurableObjectNamespace;
  XAI_API_KEY: string;
  /** Next.js app origin, e.g. https://coldcallreps.com or https://xxx.vercel.app */
  APP_ORIGIN: string;
  /** Shared secret for /api/trainer/prompt (optional but recommended) */
  TRAINER_INTERNAL_SECRET?: string;
}
