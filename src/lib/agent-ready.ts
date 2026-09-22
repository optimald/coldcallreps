/**
 * Shared constants for IsItAgentReady / agent-discovery surfaces.
 * Auth is hosted on MarketPounce (Clerk); CCR is the marketing/recruiting surface.
 */

export const AGENT_SITE = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com'
).replace(/\/$/, '');

/** Product auth + Ops MCP live on MarketPounce. */
export const MARKETPOUNCE_SITE = 'https://www.marketpounce.com';

/** Clerk Frontend API host (OIDC issuer). Prefer custom domain in prod. */
export function clerkIssuer(): string {
  const explicit =
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API?.trim() ||
    process.env.CLERK_JWT_ISSUER?.trim() ||
    '';
  if (explicit) return explicit.replace(/\/$/, '');

  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || '';
  // pk_test_<base64(frontendApi$)>
  const parts = pk.split('_');
  if (parts.length >= 3) {
    const b64 = parts.slice(2).join('_');
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8').replace(/\$$/, '');
      if (decoded.includes('.')) return `https://${decoded}`;
    } catch {
      /* fall through */
    }
  }
  return 'https://clerk.marketpounce.com';
}

/** Homepage Link headers (RFC 8288) for agent discovery. */
export function agentDiscoveryLinkHeader(site = AGENT_SITE): string {
  const links = [
    `<${site}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${site}/.well-known/agent-card.json>; rel="alternate"; type="application/json"`,
    `<${site}/.well-known/mcp/server-card.json>; rel="alternate"; type="application/json"`,
    `<${site}/llms.txt>; rel="describedby"; type="text/plain"`,
    `<${site}/auth.md>; rel="describedby"; type="text/markdown"`,
  ];
  return links.join(', ');
}
