export interface Env {
  TRAINER_SESSION: DurableObjectNamespace;
  XAI_API_KEY: string;
  /** Next.js app origin, e.g. https://coldcallreps.com or https://xxx.vercel.app */
  APP_ORIGIN: string;
}
