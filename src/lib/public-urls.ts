/** Canonical public profile URL (vanity root). */
export function repPublicPath(slug: string): string {
  return `/${slug}`;
}

/** Canonical public team URL (vanity root). */
export function teamPublicPath(slug: string): string {
  return `/${slug}`;
}

/** Legacy prefixes kept as redirects. */
export function legacyRepPath(slug: string): string {
  return `/${slug}`;
}

export function legacyTeamPath(slug: string): string {
  return `/${slug}`;
}
