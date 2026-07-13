export type SignupRole = 'REP' | 'BRAND';

export type SignupPath = {
  id: 'sdr' | 'brand';
  title: string;
  /** Plain-English expansion for acronyms / unclear labels */
  sublabel?: string;
  tagline: string;
  blurb: string;
  role: SignupRole;
  home: string;
};

export const SIGNUP_HOME_KEY = 'ccr_home';
export const SIGNUP_ROLE_KEY = 'ccr_role';

export const SIGNUP_PATHS: SignupPath[] = [
  {
    id: 'sdr',
    title: 'SDR',
    sublabel: 'Sales Development Rep',
    tagline: 'Train. Prove. Get paid.',
    blurb:
      'Practice with AI voice, prove your skill, then take paid outbound campaigns. Brand deals are free for reps.',
    role: 'REP',
    home: '/dashboard',
  },
  {
    id: 'brand',
    title: 'Founder',
    sublabel: 'Brand / campaign',
    tagline: 'Post a campaign. Get dials.',
    blurb:
      'Bootstrapped founders post outbound campaigns, review practice-backed reps, and pay for results (~20% platform fee).',
    role: 'BRAND',
    home: '/dashboard',
  },
];

export const SIGNUP_ROLES = SIGNUP_PATHS.map((p) => p.role);

export function pathForRole(role: string | null | undefined): SignupPath | undefined {
  if (!role) return undefined;
  const upper = role.toUpperCase();
  // Recruiter demoted — map legacy deep-links to Brand / founder path
  if (upper === 'RECRUITER') return SIGNUP_PATHS.find((p) => p.role === 'BRAND');
  return SIGNUP_PATHS.find((p) => p.role === upper);
}

export function homeForRole(role: string | null | undefined): string {
  return pathForRole(role)?.home || '/dashboard';
}
