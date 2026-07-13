/**
 * In-memory sample data for brand desk Demo mode.
 * Never written to Postgres — Live mode always uses real API/DB data.
 */

import { serializeHooksPayload, type ProspectIntel } from '@/lib/prospect-intel';

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400_000).toISOString();
}

function dayKeyOffset(daysBack: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function demoHooks(hooks: string[], intel: ProspectIntel): string {
  return serializeHooksPayload(hooks, intel);
}

export const DEMO_MSG = 'Demo mode — read-only sample';

export type DemoCampaign = {
  id: string;
  title: string;
  description: string;
  status: string;
  payoutLabel: string;
  goalLabel: string;
  applicationCount: number;
  bookingLink?: string | null;
  targetVertical?: string | null;
  targetLocation?: string | null;
  escrowLabel?: string | null;
  /** Demo progress snapshot */
  progress?: {
    targeting: number;
    conditioning: number;
    dialingReady: number;
    dialingActive: number;
    booked: number;
    dials?: number;
    maxAwards?: number | null;
  };
};

export type DemoLead = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  ownerName: string | null;
  ownerTitle?: string | null;
  ownerEmail?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  campaignId?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  enrichmentStatus?: string | null;
  scrapeStatus?: string | null;
  webScanStatus?: string | null;
  qualifyPhase1?: boolean | null;
  qualifyPhase2?: boolean | null;
  qualifyPhase3?: boolean | null;
  outreachReady?: boolean | null;
  source?: string | null;
  hooksJSON?: string | null;
  status?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DemoApplication = {
  id: string;
  status: string;
  campaignId: string;
  campaignTitle: string;
  displayName: string;
  profileSlug: string | null;
  createdAt: string;
};

export type DemoTeamMember = {
  userId: string;
  name: string;
  slug: string | null;
  campaigns: { id: string; title: string; status: string }[];
  dials: number;
  lastCallAt: string | null;
};

export type DemoPayout = {
  id: string;
  status: string;
  grossCents: number;
  campaignId: string;
  campaignTitle: string;
  sdrName: string;
  createdAt: string;
};

export type DemoKpis = {
  openCampaigns: number;
  pendingApplications: number;
  leads: number;
  callsToday: number;
  escrowBalanceCents: number;
  escrowLabel: string;
};

export type DemoUpcomingCall = {
  id: string;
  kind: 'booking' | 'callback';
  title: string;
  startsAt: string;
  endsAt: string | null;
  meetLink: string | null;
  htmlLink: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string | null;
  companyName: string | null;
  prospectId: string | null;
};

export type DemoCallRow = {
  id: string;
  status: string;
  direction: string;
  outcome: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  campaignId: string | null;
  campaignTitle: string | null;
  sdrName: string | null;
  sdrId: string;
  companyName: string | null;
  contactName: string | null;
  prospectId: string | null;
  toNumber: string | null;
  fromNumber: string | null;
};

export type DemoCallsBoard = {
  upcoming: DemoUpcomingCall[];
  active: DemoCallRow[];
  past: DemoCallRow[];
  polledAt: string;
};

export type DemoStatsRep = {
  userId: string;
  name: string;
  slug: string | null;
  verified: boolean;
  campaigns: number;
  dials: number;
  completed: number;
  meetings: number;
  payouts: number;
  payoutCents: number;
  avgDuration: number | null;
  lastAt: string | null;
  statuses: string[];
};

export type DemoStats = {
  openCount: number;
  pendingApps: number;
  activeApps: number;
  leadCount: number;
  callsToday: number;
  bookings: number;
  paidOutCents: number;
  connectRate: string;
  acceptRate: string;
  bookRate: string;
  avgLabel: string;
  campaignCount: number;
  appCount: number;
  callCount: number;
  rejectedApps: number;
  pipeline: { label: string; value: number }[];
  days: { key: string; label: string; count: number }[];
  perSdr: DemoStatsRep[];
};

export type DemoPipelineJob = {
  id: string;
  brandId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  query: string;
  location: string;
  status: string;
  savedCount: number;
  readyCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export const DEMO_PIPELINE_JOBS: DemoPipelineJob[] = [
  {
    id: 'demo-job-1',
    brandId: 'demo',
    campaignId: 'demo-camp-retail',
    campaignTitle: 'Retail partner intros · Q3',
    query: 'athletic retailers',
    location: 'Portland, OR',
    status: 'completed',
    savedCount: 8,
    readyCount: 5,
    errorMessage: null,
    createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 86400_000 + 12 * 60_000).toISOString(),
  },
  {
    id: 'demo-job-2',
    brandId: 'demo',
    campaignId: 'demo-camp-campus',
    campaignTitle: 'Campus store outreach',
    query: 'campus apparel',
    location: 'Eugene, OR',
    status: 'completed',
    savedCount: 4,
    readyCount: 3,
    errorMessage: null,
    createdAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
    completedAt: new Date(Date.now() - 1 * 86400_000 + 8 * 60_000).toISOString(),
  },
  {
    id: 'demo-job-3',
    brandId: 'demo',
    campaignId: 'demo-camp-dtc',
    campaignTitle: 'DTC gym franchise wave',
    query: 'gym franchises',
    location: 'Minneapolis, MN',
    status: 'running',
    savedCount: 2,
    readyCount: 0,
    errorMessage: null,
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    completedAt: null,
  },
  {
    id: 'demo-job-4',
    brandId: 'demo',
    campaignId: null,
    campaignTitle: null,
    query: 'sneaker boutiques',
    location: 'Los Angeles, CA',
    status: 'failed',
    savedCount: 0,
    readyCount: 0,
    errorMessage: 'Maps API rate limited — retry later',
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    completedAt: new Date(Date.now() - 5 * 86400_000 + 2 * 60_000).toISOString(),
  },
];

export const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: 'demo-camp-retail',
    title: 'Retail partner intros · Q3',
    description:
      'Book discovery calls with regional athletic retailers and specialty running shops. Target: owners / buyers with 2+ locations.',
    status: 'OPEN',
    payoutLabel: '$120',
    goalLabel: 'Booked meeting',
    applicationCount: 5,
    bookingLink: 'https://cal.com/nike-partners/intro',
    targetVertical: 'athletic retailers',
    targetLocation: 'Portland, OR',
    escrowLabel: '$1,200 locked',
    progress: {
      targeting: 2,
      conditioning: 1,
      dialingReady: 5,
      dialingActive: 3,
      booked: 2,
      dials: 47,
      maxAwards: 20,
    },
  },
  {
    id: 'demo-camp-campus',
    title: 'Campus store outreach',
    description:
      'Qualified leads for university bookstores and campus apparel programs evaluating wholesale footwear.',
    status: 'OPEN',
    payoutLabel: '$85',
    goalLabel: 'Qualified lead',
    applicationCount: 3,
    bookingLink: 'https://calendly.com/nike-campus/15min',
    targetVertical: 'campus apparel',
    targetLocation: 'Eugene, OR',
    escrowLabel: '$850 locked',
    progress: {
      targeting: 0,
      conditioning: 1,
      dialingReady: 3,
      dialingActive: 1,
      booked: 1,
      dials: 22,
      maxAwards: 15,
    },
  },
  {
    id: 'demo-camp-dtc',
    title: 'DTC gym franchise wave',
    description:
      'Paused while creative refreshes. Prior wave focused on multi-location fitness franchises.',
    status: 'PAUSED',
    payoutLabel: '$95',
    goalLabel: 'Booked meeting',
    applicationCount: 2,
    bookingLink: null,
    targetVertical: 'gym franchises',
    targetLocation: 'Minneapolis, MN',
    escrowLabel: '$0',
    progress: {
      targeting: 2,
      conditioning: 0,
      dialingReady: 0,
      dialingActive: 0,
      booked: 0,
      dials: 0,
      maxAwards: 10,
    },
  },
];

export const DEMO_LEADS: DemoLead[] = [
  {
    id: 'demo-lead-1',
    companyName: 'Fleet Feet Portland',
    phone: '+1 (503) 555-0142',
    website: 'https://fleetfeet.com',
    ownerName: 'Maya Chen',
    ownerTitle: 'Owner',
    ownerEmail: 'maya@fleetfeet.com',
    city: 'Portland',
    state: 'OR',
    industry: 'Specialty retail',
    campaignId: 'demo-camp-retail',
    reviewRating: 4.8,
    reviewCount: 312,
    enrichmentStatus: 'done',
    scrapeStatus: 'completed',
    webScanStatus: 'completed',
    qualifyPhase1: true,
    qualifyPhase2: true,
    qualifyPhase3: true,
    outreachReady: true,
    source: 'training',
    status: 'warming',
    createdAt: daysAgo(18),
    updatedAt: daysAgo(1),
    hooksJSON: demoHooks(
      [
        'Expanding to a second SE Portland location',
        'Strong running-club community nights',
        'Recently hired a wholesale buyer',
      ],
      {
        score: 78,
        health: 72,
        webEvoScore: 68,
        copyrightYear: 2024,
        cms: 'Shopify',
        signals: ['Meta Pixel', 'GA', 'Mobile'],
        lastReviewAt: daysAgo(4),
        https: true,
        mobile: true,
        hasWebsite: true,
      }
    ),
  },
  {
    id: 'demo-lead-2',
    companyName: 'Summit Athletic Co.',
    phone: '+1 (206) 555-0198',
    website: 'https://example.com/summit-athletic',
    ownerName: 'Jordan Blake',
    ownerTitle: 'Buyer',
    ownerEmail: 'jordan@summitathletic.co',
    city: 'Seattle',
    state: 'WA',
    industry: 'Multi-sport retail',
    campaignId: 'demo-camp-retail',
    reviewRating: 4.4,
    reviewCount: 89,
    enrichmentStatus: 'done',
    scrapeStatus: 'completed',
    webScanStatus: 'completed',
    qualifyPhase1: true,
    qualifyPhase2: true,
    qualifyPhase3: true,
    outreachReady: true,
    source: 'training',
    status: 'new',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(3),
    hooksJSON: demoHooks(
      ['3-store chain · Ballard flagship remodel', 'Competes with big-box on service, not price'],
      {
        score: 64,
        health: 58,
        webEvoScore: 54,
        copyrightYear: 2022,
        cms: 'WordPress',
        signals: ['Google Ads', 'Gallery'],
        lastReviewAt: daysAgo(21),
        https: true,
        mobile: true,
        hasWebsite: true,
      }
    ),
  },
  {
    id: 'demo-lead-3',
    companyName: 'Iron Range Fitness Group',
    phone: '+1 (612) 555-0177',
    website: null,
    ownerName: 'Chris Ortega',
    ownerTitle: 'Franchise GM',
    city: 'Minneapolis',
    state: 'MN',
    industry: 'Fitness franchise',
    campaignId: 'demo-camp-dtc',
    reviewRating: 4.1,
    reviewCount: 54,
    enrichmentStatus: 'none',
    scrapeStatus: 'completed',
    webScanStatus: 'queued',
    qualifyPhase1: true,
    qualifyPhase2: null,
    qualifyPhase3: null,
    outreachReady: false,
    source: 'training',
    status: 'new',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(0),
    hooksJSON: null,
  },
  {
    id: 'demo-lead-4',
    companyName: 'Campus Outfitters · UO',
    phone: '+1 (541) 555-0110',
    website: 'https://example.com/campus-uo',
    ownerName: 'Priya Nair',
    ownerTitle: 'Merchandise Dir.',
    ownerEmail: 'priya@campusuo.edu',
    city: 'Eugene',
    state: 'OR',
    industry: 'Campus retail',
    campaignId: 'demo-camp-campus',
    reviewRating: 4.6,
    reviewCount: 201,
    enrichmentStatus: 'done',
    scrapeStatus: 'completed',
    webScanStatus: 'completed',
    qualifyPhase1: true,
    qualifyPhase2: true,
    qualifyPhase3: true,
    outreachReady: true,
    source: 'training',
    status: 'dialing',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(2),
    hooksJSON: demoHooks(
      [
        'Fall rush ordering window opens in 3 weeks',
        'Asked vendors about exclusive colorways last season',
      ],
      {
        score: 71,
        health: 66,
        webEvoScore: 62,
        copyrightYear: 2025,
        cms: 'BigCommerce',
        signals: ['Schema', 'Mobile', 'OG'],
        lastReviewAt: daysAgo(9),
        https: true,
        mobile: true,
        hasWebsite: true,
      }
    ),
  },
  {
    id: 'demo-lead-5',
    companyName: 'TrailHaus Outdoor',
    phone: '+1 (303) 555-0164',
    website: 'https://example.com/trailhaus',
    ownerName: 'Sam Rivera',
    ownerTitle: 'Owner',
    ownerEmail: 'sam@trailhaus.com',
    city: 'Denver',
    state: 'CO',
    industry: 'Outdoor specialty',
    campaignId: 'demo-camp-retail',
    reviewRating: 4.9,
    reviewCount: 478,
    enrichmentStatus: 'done',
    scrapeStatus: 'completed',
    webScanStatus: 'completed',
    qualifyPhase1: true,
    qualifyPhase2: true,
    qualifyPhase3: true,
    outreachReady: true,
    source: 'training',
    status: 'done',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
    hooksJSON: demoHooks(
      [
        'High review volume · trail running focus',
        'Hosts weekly group runs sponsored by brands',
      ],
      {
        score: 86,
        health: 81,
        webEvoScore: 79,
        copyrightYear: 2025,
        cms: 'Shopify',
        signals: ['Meta Pixel', 'Booking', 'Gallery', 'Mobile'],
        lastReviewAt: daysAgo(1),
        https: true,
        mobile: true,
        bookingSystem: 'Booksy',
        hasWebsite: true,
      }
    ),
  },
  {
    id: 'demo-lead-6',
    companyName: 'Metro Kick Collective',
    phone: '+1 (213) 555-0188',
    website: 'https://example.com/metrokick',
    ownerName: 'Alex Kim',
    ownerTitle: 'Founder',
    city: 'Los Angeles',
    state: 'CA',
    industry: 'Sneaker boutique',
    campaignId: null,
    reviewRating: 4.3,
    reviewCount: 156,
    enrichmentStatus: 'failed',
    scrapeStatus: 'completed',
    webScanStatus: 'failed',
    qualifyPhase1: true,
    qualifyPhase2: false,
    qualifyPhase3: false,
    outreachReady: false,
    source: 'training',
    status: 'warming',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(6),
    notes: 'Enrich scrape timed out — retry from Live.',
    hooksJSON: null,
  },
];

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    id: 'demo-app-1',
    status: 'APPLIED',
    campaignId: 'demo-camp-retail',
    campaignTitle: 'Retail partner intros · Q3',
    displayName: 'Ava Martinez',
    profileSlug: null,
    createdAt: daysAgo(1),
  },
  {
    id: 'demo-app-2',
    status: 'APPLIED',
    campaignId: 'demo-camp-campus',
    campaignTitle: 'Campus store outreach',
    displayName: 'Noah Patel',
    profileSlug: null,
    createdAt: daysAgo(2),
  },
  {
    id: 'demo-app-3',
    status: 'ACTIVE',
    campaignId: 'demo-camp-retail',
    campaignTitle: 'Retail partner intros · Q3',
    displayName: 'Jordan Lee',
    profileSlug: null,
    createdAt: daysAgo(8),
  },
  {
    id: 'demo-app-4',
    status: 'ACCEPTED',
    campaignId: 'demo-camp-campus',
    campaignTitle: 'Campus store outreach',
    displayName: 'Sam Rivera',
    profileSlug: null,
    createdAt: daysAgo(5),
  },
  {
    id: 'demo-app-5',
    status: 'REJECTED',
    campaignId: 'demo-camp-dtc',
    campaignTitle: 'DTC gym franchise wave',
    displayName: 'Casey Brooks',
    profileSlug: null,
    createdAt: daysAgo(12),
  },
];

export const DEMO_TEAM: DemoTeamMember[] = [
  {
    userId: 'demo-user-jordan',
    name: 'Jordan Lee',
    slug: null,
    campaigns: [{ id: 'demo-camp-retail', title: 'Retail partner intros · Q3', status: 'ACTIVE' }],
    dials: 47,
    lastCallAt: daysAgo(0),
  },
  {
    userId: 'demo-user-sam',
    name: 'Sam Rivera',
    slug: null,
    campaigns: [
      { id: 'demo-camp-campus', title: 'Campus store outreach', status: 'ACCEPTED' },
      { id: 'demo-camp-retail', title: 'Retail partner intros · Q3', status: 'ACTIVE' },
    ],
    dials: 31,
    lastCallAt: daysAgo(1),
  },
  {
    userId: 'demo-user-riley',
    name: 'Riley Quinn',
    slug: null,
    campaigns: [{ id: 'demo-camp-retail', title: 'Retail partner intros · Q3', status: 'ACTIVE' }],
    dials: 18,
    lastCallAt: daysAgo(2),
  },
];

export const DEMO_PAYOUTS: DemoPayout[] = [
  {
    id: 'demo-pay-1',
    status: 'PAID',
    grossCents: 12000,
    campaignId: 'demo-camp-retail',
    campaignTitle: 'Retail partner intros · Q3',
    sdrName: 'Jordan Lee',
    createdAt: daysAgo(3),
  },
  {
    id: 'demo-pay-2',
    status: 'APPROVED',
    grossCents: 12000,
    campaignId: 'demo-camp-retail',
    campaignTitle: 'Retail partner intros · Q3',
    sdrName: 'Sam Rivera',
    createdAt: daysAgo(1),
  },
  {
    id: 'demo-pay-3',
    status: 'PENDING',
    grossCents: 8500,
    campaignId: 'demo-camp-campus',
    campaignTitle: 'Campus store outreach',
    sdrName: 'Riley Quinn',
    createdAt: daysAgo(0),
  },
];

export const DEMO_KPIS: DemoKpis = {
  openCampaigns: 2,
  pendingApplications: 2,
  leads: 6,
  callsToday: 14,
  escrowBalanceCents: 245000,
  escrowLabel: '$2,450.00',
};

export function getDemoCallsBoard(brandKey: string, brandName: string): DemoCallsBoard & {
  brand: { id: string; slug: string; name: string };
} {
  return {
    brand: { id: `demo-brand-${brandKey}`, slug: brandKey, name: brandName },
    polledAt: new Date().toISOString(),
    upcoming: [
      {
        id: 'demo-up-1',
        kind: 'booking',
        title: 'Intro · Fleet Feet Portland',
        startsAt: hoursFromNow(2.5),
        endsAt: hoursFromNow(3),
        meetLink: null,
        htmlLink: null,
        campaignId: 'demo-camp-retail',
        campaignTitle: 'Retail partner intros · Q3',
        sdrName: 'Jordan Lee',
        sdrId: 'demo-user-jordan',
        companyName: 'Fleet Feet Portland',
        prospectId: 'demo-lead-1',
      },
      {
        id: 'demo-up-2',
        kind: 'callback',
        title: 'Callback · Summit Athletic',
        startsAt: hoursFromNow(5),
        endsAt: null,
        meetLink: null,
        htmlLink: null,
        campaignId: 'demo-camp-retail',
        campaignTitle: 'Retail partner intros · Q3',
        sdrName: 'Sam Rivera',
        sdrId: 'demo-user-sam',
        companyName: 'Summit Athletic Co.',
        prospectId: 'demo-lead-2',
      },
    ],
    active: [
      {
        id: 'demo-active-1',
        status: 'in-progress',
        direction: 'outbound',
        outcome: null,
        duration: 142,
        createdAt: hoursFromNow(-0.08),
        updatedAt: hoursFromNow(-0.01),
        campaignId: 'demo-camp-campus',
        campaignTitle: 'Campus store outreach',
        sdrName: 'Riley Quinn',
        sdrId: 'demo-user-riley',
        companyName: 'Campus Outfitters · UO',
        contactName: 'Priya Nair',
        prospectId: 'demo-lead-4',
        toNumber: '+1 (541) 555-0110',
        fromNumber: '+1 (415) 555-0100',
      },
    ],
    past: [
      {
        id: 'demo-past-1',
        status: 'completed',
        direction: 'outbound',
        outcome: 'meeting_booked',
        duration: 386,
        createdAt: hoursFromNow(-3),
        updatedAt: hoursFromNow(-3),
        campaignId: 'demo-camp-retail',
        campaignTitle: 'Retail partner intros · Q3',
        sdrName: 'Jordan Lee',
        sdrId: 'demo-user-jordan',
        companyName: 'TrailHaus Outdoor',
        contactName: 'Sam Rivera',
        prospectId: 'demo-lead-5',
        toNumber: '+1 (303) 555-0164',
        fromNumber: '+1 (415) 555-0100',
      },
      {
        id: 'demo-past-2',
        status: 'completed',
        direction: 'outbound',
        outcome: 'no_answer',
        duration: 28,
        createdAt: hoursFromNow(-5),
        updatedAt: hoursFromNow(-5),
        campaignId: 'demo-camp-retail',
        campaignTitle: 'Retail partner intros · Q3',
        sdrName: 'Sam Rivera',
        sdrId: 'demo-user-sam',
        companyName: 'Iron Range Fitness Group',
        contactName: 'Chris Ortega',
        prospectId: 'demo-lead-3',
        toNumber: '+1 (612) 555-0177',
        fromNumber: '+1 (415) 555-0100',
      },
      {
        id: 'demo-past-3',
        status: 'completed',
        direction: 'outbound',
        outcome: 'interested',
        duration: 214,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        campaignId: 'demo-camp-campus',
        campaignTitle: 'Campus store outreach',
        sdrName: 'Riley Quinn',
        sdrId: 'demo-user-riley',
        companyName: 'Metro Kick Collective',
        contactName: 'Alex Kim',
        prospectId: 'demo-lead-6',
        toNumber: '+1 (213) 555-0188',
        fromNumber: '+1 (415) 555-0100',
      },
    ],
  };
}

export function getDemoStats(): DemoStats {
  const weekday = (daysBack: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  };
  const dialCounts = [9, 14, 11, 18, 15, 12, 14];
  return {
    openCount: 2,
    pendingApps: 2,
    activeApps: 3,
    leadCount: 6,
    callsToday: 14,
    bookings: 4,
    paidOutCents: 32500,
    connectRate: '42%',
    acceptRate: '60%',
    bookRate: '18%',
    avgLabel: '2m 14s',
    campaignCount: 3,
    appCount: 5,
    callCount: 93,
    rejectedApps: 1,
    pipeline: [
      { label: 'Applied', value: 2 },
      { label: 'Active', value: 3 },
      { label: 'Rejected', value: 1 },
    ],
    days: [6, 5, 4, 3, 2, 1, 0].map((back, i) => ({
      key: dayKeyOffset(back),
      label: weekday(back),
      count: dialCounts[i],
    })),
    perSdr: [
      {
        userId: 'demo-user-jordan',
        name: 'Jordan Lee',
        slug: null,
        verified: true,
        campaigns: 1,
        dials: 47,
        completed: 22,
        meetings: 3,
        payouts: 1,
        payoutCents: 12000,
        avgDuration: 148,
        lastAt: daysAgo(0),
        statuses: ['ACTIVE'],
      },
      {
        userId: 'demo-user-sam',
        name: 'Sam Rivera',
        slug: null,
        verified: true,
        campaigns: 2,
        dials: 31,
        completed: 14,
        meetings: 1,
        payouts: 1,
        payoutCents: 12000,
        avgDuration: 121,
        lastAt: daysAgo(1),
        statuses: ['ACTIVE', 'ACCEPTED'],
      },
      {
        userId: 'demo-user-riley',
        name: 'Riley Quinn',
        slug: null,
        verified: false,
        campaigns: 1,
        dials: 18,
        completed: 7,
        meetings: 0,
        payouts: 1,
        payoutCents: 8500,
        avgDuration: 96,
        lastAt: daysAgo(2),
        statuses: ['ACTIVE'],
      },
    ],
  };
}

export function isDemoEntityId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('demo-'));
}
