import type { NavIcon } from '@/lib/roles';

const size = 18;

/** Compact stroke icons for the app sidebar. */
export default function NavIconGlyph({ name }: { name: NavIcon }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case 'trainer':
      return (
        <svg {...common}>
          <path d="M12 3a5 5 0 015 5v2a5 5 0 01-10 0V8a5 5 0 015-5z" />
          <path d="M5 12a7 7 0 0014 0" />
          <path d="M12 19v2M8 22h8" />
        </svg>
      );
    case 'leaderboard':
      return (
        <svg {...common}>
          <path d="M8 20V10M12 20V4M16 20v-6" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'hiring':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 19a5.5 5.5 0 0111 0" />
          <path d="M17 11l2 2 3.5-3.5" />
        </svg>
      );
    case 'jobs':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
          <path d="M3 12h18" />
        </svg>
      );
    case 'gigs':
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M17 8H9.5a2.5 2.5 0 000 5H14a2.5 2.5 0 010 5H6" />
        </svg>
      );
    case 'earnings':
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h0.01M18 12h0.01" />
        </svg>
      );
    case 'campaigns':
      return (
        <svg {...common}>
          <path d="M4 5h11l5 5-5 5H4V5z" />
          <path d="M4 20h7" />
        </svg>
      );
    case 'recruiter':
      return (
        <svg {...common}>
          <circle cx="11" cy="8" r="3.5" />
          <path d="M4 19a7 7 0 0114 0" />
          <path d="M18 8v4M16 10h4" />
        </svg>
      );
    case 'brands':
      return (
        <svg {...common}>
          <path d="M4 20V9l8-5 8 5v11" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'arena':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tournaments':
      return (
        <svg {...common}>
          <path d="M8 4h8v3a4 4 0 01-4 4 4 4 0 01-4-4V4z" />
          <path d="M8 5H5a2 2 0 002 4M16 5h3a2 2 0 01-2 4" />
          <path d="M12 11v4M9 21h6M12 15a3 3 0 003 3H9a3 3 0 003-3z" />
        </svg>
      );
    case 'academy':
      return (
        <svg {...common}>
          <path d="M3 9l9-5 9 5-9 5-9-5z" />
          <path d="M7 11.5v4.5c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5" />
          <path d="M21 9v6" />
        </svg>
      );
    case 'playbooks':
      return (
        <svg {...common}>
          <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" />
          <path d="M5 17a3 3 0 013-3h12" />
        </svg>
      );
    case 'prospects':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
      );
    case 'team':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 19a5.5 5.5 0 0111 0" />
          <path d="M15 19a4 4 0 015.5-3.7" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="3.5" />
          <path d="M5 19.5c1.8-3.2 4.1-4.8 7-4.8s5.2 1.6 7 4.8" />
        </svg>
      );
    case 'integrations':
      return (
        <svg {...common}>
          <path d="M8 7h3a3 3 0 010 6H8" />
          <path d="M16 17h-3a3 3 0 010-6h3" />
          <path d="M11 10h2M11 14h2" />
        </svg>
      );
    case 'outbound':
      return (
        <svg {...common}>
          <path d="M4 15v-2a8 8 0 0116 0v2" />
          <path d="M4 15a2 2 0 002 2h1v-5H6a2 2 0 00-2 2z" />
          <path d="M20 15a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2z" />
          <path d="M14 19h-1a3 3 0 01-3-3v-1" />
        </svg>
      );
    case 'leads':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
