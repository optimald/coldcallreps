export type DefaultPlaybookStep = {
  title: string;
  script: string;
  objections: string[];
};

export type DefaultPlaybookTemplate = {
  key: string;
  title: string;
  description: string;
  steps: DefaultPlaybookStep[];
};

/** @deprecated Prefer DEFAULT_PLAYBOOKS[0].title or getDefaultPlaybook('foundation') */
export const DEFAULT_PLAYBOOK_TITLE = 'Cold call foundation';

const FOUNDATION_STEPS: DefaultPlaybookStep[] = [
  {
    title: 'Open',
    script:
      'Name + reason for the call in under 10 seconds. Confirm you’re speaking with the right person before pitching.',
    objections: ['Who is this?', 'We’re not interested.', 'Just send an email.'],
  },
  {
    title: 'Qualify',
    script:
      'Ask one discovery question that surfaces a gap before you pitch. Listen, then mirror their words back.',
    objections: ['We already have a vendor.', 'No budget this quarter.', 'I’m busy — call later.'],
  },
  {
    title: 'Pitch',
    script:
      'Tie your value to the specific gap they named. One clear outcome, one proof point, no feature dump.',
    objections: ['Too expensive.', 'We tried something like this.', 'Need to think about it.'],
  },
  {
    title: 'Close',
    script:
      'Clear ask with two time options. Confirm next step and owner before hanging up.',
    objections: ['Send me info first.', 'I need to check with my partner.', 'Not a priority right now.'],
  },
];

/** @deprecated Prefer getDefaultPlaybook('foundation').steps */
export const DEFAULT_PLAYBOOK_STEPS = FOUNDATION_STEPS;

export const DEFAULT_PLAYBOOKS: DefaultPlaybookTemplate[] = [
  {
    key: 'foundation',
    title: DEFAULT_PLAYBOOK_TITLE,
    description: 'Core open → qualify → pitch → close skeleton for cold outbound.',
    steps: FOUNDATION_STEPS,
  },
  {
    key: 'gatekeeper',
    title: 'Gatekeeper transfer',
    description: 'Get past the front desk and earn a warm handoff to the decision maker.',
    steps: [
      {
        title: 'Open',
        script:
          'Friendly, brief, and specific: “Hi — this is [Name] with [Company]. I’m hoping to catch [Decision Maker] for thirty seconds about [one outcome]. Are they around?” Sound like you belong on the calendar, not like a cold pitch.',
        objections: [
          'Who are you with?',
          'What’s this regarding?',
          'They’re in a meeting / not available.',
        ],
      },
      {
        title: 'Qualify',
        script:
          'Treat the gatekeeper as an ally. Ask who owns [problem], when they’re usually free, and whether email or a callback works better. Mirror their language and thank them by name.',
        objections: [
          'They don’t take unsolicited calls.',
          'You’ll need to email instead.',
          'We already have someone for that.',
        ],
      },
      {
        title: 'Pitch',
        script:
          'One-line value for the DM, not a full pitch: “It’s about cutting [pain] for teams like yours — I only need a quick yes/no if it’s even relevant.” Offer a short callback window so they can transfer cleanly.',
        objections: [
          'Just send me something and I’ll pass it along.',
          'They’re not interested.',
          'Call back next quarter.',
        ],
      },
      {
        title: 'Close',
        script:
          'Ask for the transfer or a concrete next step: “Could you put me through for 20 seconds, or book me for Tuesday 10 or Thursday 2?” Confirm spelling of the DM’s name and best direct line before hanging up.',
        objections: [
          'I can’t transfer you.',
          'Leave a message and they’ll call back.',
          'Their calendar is full this month.',
        ],
      },
    ],
  },
  {
    key: 'pricing',
    title: 'Pricing objection handling',
    description: 'Reframe cost objections around ROI, risk, and timing — not discounts.',
    steps: [
      {
        title: 'Open',
        script:
          'Acknowledge the money concern without defending: “Totally fair — price only matters if the outcome isn’t clear. Mind if I ask what you’re comparing us to?” Stay curious, not defensive.',
        objections: [
          'It’s too expensive.',
          'Your competitor is cheaper.',
          'We don’t have budget.',
        ],
      },
      {
        title: 'Qualify',
        script:
          'Separate price from priority. “Is it the number itself, or that you’re not sure it’ll pay for itself?” Dig into current cost of the problem (time, lost deals, churn) before talking packages.',
        objections: [
          'We need to see numbers first.',
          'Finance has to approve anything over $X.',
          'We’re locked into a contract.',
        ],
      },
      {
        title: 'Pitch',
        script:
          'Anchor on outcome math: “If this saves [hours/deals] per month, the plan pays for itself in [timeframe]. Here’s the proof from a similar team.” Offer a smaller starter path only after value is clear — never lead with a discount.',
        objections: [
          'Can you do it for less?',
          'We’ll wait until next fiscal year.',
          'I need to think about it.',
        ],
      },
      {
        title: 'Close',
        script:
          'Propose a low-risk next step: pilot, phased rollout, or two calendar options for a short ROI review with the budget owner. Confirm what would make the number feel fair before you hang up.',
        objections: [
          'Send a proposal and I’ll review.',
          'I need three other quotes.',
          'Not a priority until Q4.',
        ],
      },
    ],
  },
  {
    key: 'website',
    title: '$500 website / no-website pitch',
    description: 'Local-business motion for shops with a weak site, Facebook-only presence, or no site at all.',
    steps: [
      {
        title: 'Open',
        script:
          'Lead with what you noticed, not a pitch: “Hey [Name] — I looked you up and [you’re on Facebook only / the site doesn’t load on mobile / no Google listing]. I help local businesses get a simple $500 site so people can find you and call. Got 30 seconds?”',
        objections: [
          'Who is this?',
          'We’re fine with Facebook.',
          'We already have a guy for that.',
        ],
      },
      {
        title: 'Qualify',
        script:
          'Ask how customers find them today and what happens when someone Googles the business. “When someone searches [category] near [city], do they land on you or a competitor?” Confirm they own decisions on marketing spend.',
        objections: [
          'Most of our business is walk-in / word of mouth.',
          'We’re not taking new customers.',
          'I don’t handle that — talk to my [spouse/partner].',
        ],
      },
      {
        title: 'Pitch',
        script:
          'Keep it concrete: “For $500 you get a clean one-pager — hours, services, map, click-to-call — live in a few days. No monthly retainer unless you want hosting later. Neighboring [shop type]s use this to stop losing calls to Google.”',
        objections: [
          'Five hundred is a lot for a website.',
          'I can do it myself on Wix.',
          'We tried a site and got nothing from it.',
        ],
      },
      {
        title: 'Close',
        script:
          'Soft close with proof: “I can text you three live examples and a one-page brief. If it looks right, we kick off this week — Tuesday or Thursday work for a 10-minute walkthrough?” Collect email/text and confirm who signs off.',
        objections: [
          'Just email me something.',
          'Call me back after busy season.',
          'I need to check with my partner.',
        ],
      },
    ],
  },
  {
    key: 'sell-me-this-pen',
    title: 'Sell-me-this-pen / discovery close',
    description: 'Product-fit drill: discover need first, then close — classic pen exercise remixed for any offer.',
    steps: [
      {
        title: 'Open',
        script:
          'Don’t pitch the pen (or product). Open with curiosity: “Before I tell you anything about this, can I ask — when was the last time you needed to [write something down / solve X] and what went wrong?” Frame it as a short discovery, not a demo.',
        objections: [
          'Just tell me the price.',
          'I already know what a pen does.',
          'This feels like a gimmick.',
        ],
      },
      {
        title: 'Qualify',
        script:
          'Stack 2–3 discovery questions: Who uses it? How often? What do they use today? What’s frustrating about that? Mirror their words. Only move on once you’ve named a specific gap in their language.',
        objections: [
          'I don’t really need one.',
          'Any pen works fine.',
          'I’m not the buyer for this.',
        ],
      },
      {
        title: 'Pitch',
        script:
          'Sell the gap they named, not features: “You said you lose track of [notes / follow-ups]. This solves that because [one benefit tied to their words].” One proof point, then stop talking.',
        objections: [
          'That’s a stretch.',
          'I’ve heard that pitch before.',
          'Still not convinced I need it.',
        ],
      },
      {
        title: 'Close',
        script:
          'Trial close on fit, then ask: “Based on what you shared, does this solve the [gap] — yes or no? If yes, let’s pick a next step: try it now, or schedule [demo/order] for [option A] or [option B].” Confirm ownership of the decision.',
        objections: [
          'Let me think about it.',
          'Maybe later.',
          'I’d only buy if it were free / cheaper.',
        ],
      },
    ],
  },
];

export function getDefaultPlaybook(key: string): DefaultPlaybookTemplate | undefined {
  const normalized = key.trim().toLowerCase();
  return DEFAULT_PLAYBOOKS.find((p) => p.key === normalized);
}

export function defaultPlaybookContent(key = 'foundation') {
  const template = getDefaultPlaybook(key) ?? DEFAULT_PLAYBOOKS[0];
  return { steps: template.steps };
}

export function defaultPlaybookTitle(key = 'foundation') {
  const template = getDefaultPlaybook(key) ?? DEFAULT_PLAYBOOKS[0];
  return template.title;
}
