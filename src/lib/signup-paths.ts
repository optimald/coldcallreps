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
    tagline: 'Learn to be an expert sales development rep by putting in the reps.',
    blurb:
      'Practice with AI voice, prove your skill, then take paid outbound campaigns. Brand deals are free for reps.',
    role: 'REP',
    home: '/dashboard',
  },
  {
    id: 'brand',
    title: 'Brand',
    sublabel: 'Campaigns & leads',
    tagline: 'Hire sales reps who put in the reps.',
    blurb:
      'Post outbound campaigns, review practice-backed reps, and pay for outcomes + optional base (20% fee, capped).',
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
  if (role?.toUpperCase() === 'SUPERADMIN') return '/admin';
  return pathForRole(role)?.home || '/dashboard';
}
